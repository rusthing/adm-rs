//! # 树形实体删除预检与引用保护
//!
//! 树形实体删除会级联整棵子树。本模块提供两件事：
//!
//! 1. **删除预检**：给前端返回「将同时删除 N 个子节点」及名称清单，前端确认
//!    后才调用删除接口；数量与清单全部来自数据库，不靠前端估算。
//! 2. **引用保护**：任何被其它实体引用的节点（含子孙）都拒绝删除，返回明确
//!    错误；策略是「拒绝并提示先解除关联」，而不是静默删掉关联记录——角色、
//!    权限、组织归属都是授权数据，静默删除会让权限语义在用户不知情时改变。
//!
//! 本模块只做业务侧编排；通用树结构（前缀查询、级联删除、同父前移）在
//! `robotech::dao::sort`，业务实体通过 `#[sortable(..., guard = "...")]` 接入。

use crate::svc::{SORT_MENU, SORT_ORG, SORT_PERM_GROUP, SORT_ROLE_GROUP};
use anyhow::anyhow;
use robotech::api::U64;
use robotech::dao::sort::{tree_subtree, TreeSort};
use robotech::dao::DaoError;
use robotech::db::get_db_conn;
use robotech::svc::SvcError;
use sea_orm::{ConnectionTrait, DatabaseBackend, QueryResult, Statement, Value};
use serde::Serialize;

/// 一处外部引用：引用表、引用列、提示用名称
struct TreeReference {
    table: &'static str,
    col: &'static str,
    label: &'static str,
}

const MENU_REFS: &[TreeReference] = &[
    TreeReference {
        table: "adm_role_menu",
        col: "menu_id",
        label: "角色菜单绑定",
    },
    TreeReference {
        table: "adm_menu_perm",
        col: "menu_id",
        label: "菜单权限绑定",
    },
];

const ROLE_GROUP_REFS: &[TreeReference] = &[TreeReference {
    table: "adm_role",
    col: "group_id",
    label: "角色",
}];

const PERM_GROUP_REFS: &[TreeReference] = &[TreeReference {
    table: "adm_perm",
    col: "group_id",
    label: "权限",
}];

const ORG_REFS: &[TreeReference] = &[
    TreeReference {
        table: "adm_org_user",
        col: "org_id",
        label: "人员组织归属",
    },
    TreeReference {
        table: "adm_realm_org",
        col: "org_id",
        label: "领域组织绑定",
    },
    TreeReference {
        table: "adm_role_scope",
        col: "org_id",
        label: "角色数据范围",
    },
];

/// 删除预检中的一个子节点
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TreeDeletePreviewItem {
    /// 子节点 ID（按字符串序列化，避免 JS 大整数精度丢失）
    pub id: U64,
    /// 子节点名称
    pub name: String,
}

/// 树形节点删除预检结果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TreeDeletePreview {
    /// 将随节点一起删除的子孙数量
    pub count: u64,
    /// 子孙清单（按树编码前序）
    pub items: Vec<TreeDeletePreviewItem>,
    /// 是否存在引用阻塞（为 `true` 时删除会被拒绝）
    pub blocked: bool,
    /// 阻塞原因（多个用「；」连接）
    pub block_reason: Option<String>,
}

struct TreeDeleteTarget {
    spec: TreeSort,
    table: &'static str,
    name_col: &'static str,
    refs: &'static [TreeReference],
}

fn target(prefix: &str) -> Option<TreeDeleteTarget> {
    match prefix {
        "menu" => Some(TreeDeleteTarget {
            spec: SORT_MENU,
            table: "adm_menu",
            name_col: "name",
            refs: MENU_REFS,
        }),
        "role-group" => Some(TreeDeleteTarget {
            spec: SORT_ROLE_GROUP,
            table: "adm_role_group",
            name_col: "name",
            refs: ROLE_GROUP_REFS,
        }),
        "perm-group" => Some(TreeDeleteTarget {
            spec: SORT_PERM_GROUP,
            table: "adm_perm_group",
            name_col: "name",
            refs: PERM_GROUP_REFS,
        }),
        "org" => Some(TreeDeleteTarget {
            spec: SORT_ORG,
            table: "adm_org",
            name_col: "name",
            refs: ORG_REFS,
        }),
        _ => None,
    }
}

async fn query_all<C>(db: &C, sql: &str, values: Vec<Value>) -> Result<Vec<QueryResult>, SvcError>
where
    C: ConnectionTrait,
{
    db.query_all_raw(Statement::from_sql_and_values(
        DatabaseBackend::Postgres,
        sql,
        values,
    ))
    .await
    .map_err(|err| SvcError::from(DaoError::parse_db_err(err)))
}

fn ids_clause(ids: &[u64], start: usize) -> (String, Vec<Value>) {
    let placeholders = ids
        .iter()
        .enumerate()
        .map(|(index, _)| format!("${}", start + index))
        .collect::<Vec<_>>()
        .join(",");
    let values = ids
        .iter()
        .map(|id| Value::BigInt(Some(*id as i64)))
        .collect();
    (placeholders, values)
}

/// 返回子树中每个被引用节点的提示文案（空表示没有引用阻塞）
async fn reference_violations<C>(
    db: &C,
    target: &TreeDeleteTarget,
    ids: &[u64],
) -> Result<Vec<String>, SvcError>
where
    C: ConnectionTrait,
{
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let (placeholders, values) = ids_clause(ids, 1);
    let mut messages = Vec::new();
    for reference in target.refs {
        let sql = format!(
            "SELECT t.{name_col} AS name, COUNT(*) AS cnt
             FROM {table} t
             JOIN {ref_table} r ON r.{ref_col} = t.id
             WHERE t.id IN ({placeholders})
             GROUP BY t.id, t.{name_col}
             ORDER BY t.{name_col}",
            name_col = target.name_col,
            table = target.table,
            ref_table = reference.table,
            ref_col = reference.col,
        );
        for row in query_all(db, &sql, values.clone()).await? {
            let name: String = row.try_get("", "name").map_err(|err| {
                SvcError::from(DaoError::parse_db_err(err))
            })?;
            let count: i64 = row.try_get("", "cnt").map_err(|err| {
                SvcError::from(DaoError::parse_db_err(err))
            })?;
            messages.push(format!(
                "「{name}」仍被{}引用（{count} 条）",
                reference.label
            ));
        }
    }
    Ok(messages)
}

async fn subtree_or_error<C>(
    db: &C,
    target: &TreeDeleteTarget,
    id: u64,
) -> Result<Vec<robotech::dao::sort::TreeSubtreeNode>, SvcError>
where
    C: ConnectionTrait + Sync,
{
    tree_subtree(db, &target.spec, id)
        .await?
        .ok_or_else(|| SvcError::NotFound(id.to_string()))
}

/// # 删除前校验：子树内任一节点被引用则拒绝
///
/// 作为 `#[sortable(guard = "...")]` 的回调，在级联删除之前执行。
async fn assert_tree_delete_allowed<C>(
    db: &C,
    target: &TreeDeleteTarget,
    id: u64,
) -> Result<(), SvcError>
where
    C: ConnectionTrait + Sync,
{
    let subtree = subtree_or_error(db, target, id).await?;
    let ids = subtree.iter().map(|node| node.id).collect::<Vec<_>>();
    let violations = reference_violations(db, target, &ids).await?;
    if violations.is_empty() {
        return Ok(());
    }
    Err(SvcError::Runtime(anyhow!(format!(
        "无法删除：{}。请先解除关联后再删除。",
        violations.join("；")
    ))))
}

/// # 菜单删除引用保护
pub async fn menu_delete_guard<C>(db: &C, id: u64) -> Result<(), SvcError>
where
    C: ConnectionTrait + Sync,
{
    let target = target("menu").expect("menu target");
    assert_tree_delete_allowed(db, &target, id).await
}

/// # 角色分组删除引用保护
pub async fn role_group_delete_guard<C>(db: &C, id: u64) -> Result<(), SvcError>
where
    C: ConnectionTrait + Sync,
{
    let target = target("role-group").expect("role-group target");
    assert_tree_delete_allowed(db, &target, id).await
}

/// # 权限分组删除引用保护
pub async fn perm_group_delete_guard<C>(db: &C, id: u64) -> Result<(), SvcError>
where
    C: ConnectionTrait + Sync,
{
    let target = target("perm-group").expect("perm-group target");
    assert_tree_delete_allowed(db, &target, id).await
}

/// # 组织删除引用保护
pub async fn org_delete_guard<C>(db: &C, id: u64) -> Result<(), SvcError>
where
    C: ConnectionTrait + Sync,
{
    let target = target("org").expect("org target");
    assert_tree_delete_allowed(db, &target, id).await
}

/// # 删除预检（使用全局连接）
pub async fn tree_delete_preview(prefix: &str, id: u64) -> Result<TreeDeletePreview, SvcError> {
    let db = get_db_conn()?;
    tree_delete_preview_with_db(db.as_ref(), prefix, id).await
}

/// # 删除预检（指定连接/事务）
///
/// 返回子孙数量、名称清单，以及是否因外部引用被阻塞。
pub async fn tree_delete_preview_with_db<C>(
    db: &C,
    prefix: &str,
    id: u64,
) -> Result<TreeDeletePreview, SvcError>
where
    C: ConnectionTrait + Sync,
{
    let target = target(prefix)
        .ok_or_else(|| SvcError::Runtime(anyhow!("不支持的树形实体前缀：{prefix}")))?;
    let subtree = subtree_or_error(db, &target, id).await?;
    let descendants = subtree.iter().skip(1).cloned().collect::<Vec<_>>();
    let ids = subtree.iter().map(|node| node.id).collect::<Vec<_>>();
    let violations = reference_violations(db, &target, &ids).await?;

    let mut names = std::collections::HashMap::new();
    if !descendants.is_empty() {
        let (placeholders, values) = ids_clause(
            &descendants.iter().map(|node| node.id).collect::<Vec<_>>(),
            1,
        );
        let sql = format!(
            "SELECT id AS id, {name_col} AS name FROM {table} WHERE id IN ({placeholders})",
            name_col = target.name_col,
            table = target.table,
        );
        for row in query_all(db, &sql, values).await? {
            let node_id = row
                .try_get::<i64>("", "id")
                .map_err(|err| SvcError::from(DaoError::parse_db_err(err)))? as u64;
            let name = row
                .try_get::<String>("", "name")
                .map_err(|err| SvcError::from(DaoError::parse_db_err(err)))?;
            names.insert(node_id, name);
        }
    }

    let items = descendants
        .iter()
        .map(|node| TreeDeletePreviewItem {
            id: U64::from(node.id),
            name: names
                .get(&node.id)
                .cloned()
                .unwrap_or_else(|| node.code.clone()),
        })
        .collect::<Vec<_>>();

    Ok(TreeDeletePreview {
        count: items.len() as u64,
        items,
        blocked: !violations.is_empty(),
        block_reason: if violations.is_empty() {
            None
        } else {
            Some(format!("{}。请先解除关联后再删除。", violations.join("；")))
        },
    })
}
