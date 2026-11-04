//! # 统一排序（框架能力接入）
//!
//! 排序算法已上移到 `robotech::dao::sort`：平铺实体的 `max+1` 分配、`1..n` 重排、
//! 删除自动紧凑、改分组新旧两组重算，以及树形编码生成、同父重排、子树级联、
//! 改父新旧重算，全部由框架按「表名 / 分组列 / 编码列」生成 SQL。
//!
//! 本模块只保留两件事：
//! 1. 本服务各实体的排序元信息常量（唯一事实来源，实体 `#[sortable]` 与控制器共用）；
//! 2. 重排接口的事务封装（开事务 → 调框架 → 提交），本身不含排序逻辑。

use robotech::dao::sort::{
    reorder_flat as framework_reorder_flat, reorder_tree as framework_reorder_tree, FlatSort,
    TreeSort,
};
use robotech::dao::{begin_transaction, commit_transaction};
use robotech::db::get_db_conn;
use robotech::svc::SvcError;

/// 领域：全局一组
pub const SORT_REALM: FlatSort = FlatSort::new("adm_realm");
/// 应用：按领域隔离
pub const SORT_APP: FlatSort = FlatSort::new("adm_app").with_group("realm_id");
/// 角色：按角色分组隔离
pub const SORT_ROLE: FlatSort = FlatSort::new("adm_role").with_group("group_id");
/// 权限：按权限分组隔离
pub const SORT_PERM: FlatSort = FlatSort::new("adm_perm").with_group("group_id");
/// 操作类型：全局一组
pub const SORT_OP_TYPE: FlatSort = FlatSort::new("adm_op_type");
/// 组织类型：全局一组
pub const SORT_ORG_TYPE: FlatSort = FlatSort::new("adm_org_type");
/// 人员编码类型：全局一组
pub const SORT_PERSON_CODE_TYPE: FlatSort = FlatSort::new("adm_person_code_type");

/// 菜单：按应用隔离的树
pub const SORT_MENU: TreeSort = TreeSort::new("adm_menu").with_scope("app_id");
/// 角色分组：按领域隔离的树
pub const SORT_ROLE_GROUP: TreeSort = TreeSort::new("adm_role_group").with_scope("realm_id");
/// 权限分组：按领域隔离的树
pub const SORT_PERM_GROUP: TreeSort = TreeSort::new("adm_perm_group").with_scope("realm_id");
/// 组织：全局一棵树
pub const SORT_ORG: TreeSort = TreeSort::new("adm_org");

/// # 平铺实体重排
///
/// 提交的 id 必须恰好覆盖同一分组的全部记录，事务内按提交顺序写回 `1..n`。
pub async fn reorder_flat(
    spec: &FlatSort,
    ids: Vec<u64>,
    operator_id: u64,
) -> Result<u64, SvcError> {
    let db = get_db_conn()?;
    let tx = begin_transaction(db.as_ref()).await?;
    let affected = framework_reorder_flat(&tx, spec, &ids, Some(operator_id)).await?;
    commit_transaction(tx).await?;
    Ok(affected)
}

/// # 树形实体重排
///
/// 提交的 id 必须恰好覆盖同一父节点下的全部兄弟，事务内按提交顺序重排编码。
pub async fn reorder_tree(
    spec: &TreeSort,
    ids: Vec<u64>,
    operator_id: u64,
) -> Result<u64, SvcError> {
    let db = get_db_conn()?;
    let tx = begin_transaction(db.as_ref()).await?;
    let affected = framework_reorder_tree(&tx, spec, &ids, Some(operator_id)).await?;
    commit_transaction(tx).await?;
    Ok(affected)
}
