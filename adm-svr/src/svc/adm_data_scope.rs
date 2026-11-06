//! # 角色可见范围：请求上下文与强制过滤策略
//!
//! 三张表各自是一条独立的轴，都是**可见范围白名单**，不管功能权限：
//!
//! | 表 | 管什么 |
//! |---|---|
//! | `adm_role_realm_scope` | 能看哪些领域（进而看这些领域里的用户/组织） |
//! | `adm_role_org_scope`   | 能看哪些组织（含子孙组织） |
//! | `adm_role_app_scope`   | 能进哪些应用（进而看这些应用下的菜单） |
//!
//! ## 白名单语义
//!
//! - 一个角色**三张表都没有行** ⇒ 三个维度全量可见（配了才限制）。
//! - 配了任意行 ⇒ 只对「配置过的范围」取并集；没配的那条轴不贡献"全量"，
//!   否则 org 范围会被空 realm 范围稀释掉。
//! - 多个角色取并集；当前用户自己始终可见，避免受限管理员把自己过滤掉。
//!
//! ## 生效路径
//!
//! [`with_scope`] 由 `require_auth` 中间件把一次请求的上下文包进 `task_local`，
//! 之后 [`AdmDataScope::condition`] 被 `robotech::dao` 的 `#[dao]` 宏在所有
//! 读写查询里同步调用——因此列表、单条读、改、删、KPI 统计都被同一套条件覆盖。
//! 没有上下文的后台任务（启动装配、登录链路）一律视为不受限。

use crate::mo::{
    adm_app, adm_menu, adm_org, adm_org_user, adm_person, adm_realm, adm_realm_org,
    adm_realm_user, adm_role, adm_role_app_scope, adm_role_org_scope, adm_role_realm_scope,
    adm_role_user, adm_user,
};
use robotech::dao::{DaoError, DataScope};
use robotech::db::get_db_conn;
use robotech::svc::SvcError;
use sea_orm::{ColumnTrait, Condition, EntityTrait, QueryFilter};
use std::collections::HashSet;
use std::future::Future;

tokio::task_local! {
    /// 请求级数据范围上下文；未设置时视为不受限（后台任务 / 登录链路）
    static REQUEST_SCOPE: AdmScopeCtx;
}

/// 各维度的可见 ID 集合。`None` = 该维度没有限制（全量可见）。
#[derive(Debug, Clone, Default)]
pub struct AdmScopeSets {
    /// 可见领域；`Some` 时 `adm_realm` 受限
    pub realm_ids: Option<Vec<i64>>,
    /// 可见组织（已展开子树）；`Some` 时 `adm_org` / `adm_org_user` 受限
    pub org_ids: Option<Vec<i64>>,
    /// 可见用户；`Some` 时 `adm_user` 受限
    pub user_ids: Option<Vec<i64>>,
    /// 可见人员；`Some` 时 `adm_person` 受限
    pub person_ids: Option<Vec<i64>>,
    /// 可见应用；`Some` 时 `adm_app` / `adm_menu` 受限
    pub app_ids: Option<Vec<i64>>,
}

/// 一次请求的完整上下文
#[derive(Debug, Clone)]
pub struct AdmScopeCtx {
    pub user_id: u64,
    pub sets: AdmScopeSets,
}

/// # 读取当前请求的上下文
///
/// 没有上下文（启动装配、登录、token 校验链路）时返回 `None`，即不限制。
pub fn current_scope() -> Option<AdmScopeCtx> {
    REQUEST_SCOPE.try_with(|ctx| ctx.clone()).ok()
}

/// # 在指定上下文内执行 future
///
/// 由 `require_auth` 中间件调用，作用域覆盖整个下游 handler。
pub async fn with_scope<F>(ctx: AdmScopeCtx, future: F) -> F::Output
where
    F: Future,
{
    REQUEST_SCOPE.scope(ctx, future).await
}

/// # 计算某个用户的可见范围
///
/// 只在中间件里算一次，后续所有 DAO 查询直接读缓存的 ID 集合，
/// 不会每条 SQL 都回查三张 scope 表。
pub async fn load_scope_ctx(user_id: u64) -> Result<AdmScopeCtx, SvcError> {
    let db = get_db_conn()?;
    let conn = db.as_ref();

    let role_ids: Vec<i64> = adm_role_user::Entity::find()
        .filter(adm_role_user::Column::UserId.eq(user_id as i64))
        .all(conn)
        .await
        .map_err(DaoError::parse_db_err)?
        .into_iter()
        .map(|link| link.role_id)
        .collect();
    if role_ids.is_empty() {
        return Ok(AdmScopeCtx { user_id, sets: AdmScopeSets::default() });
    }

    // 停用角色的授权不生效
    let active_role_ids: Vec<i64> = adm_role::Entity::find()
        .filter(adm_role::Column::Id.is_in(role_ids))
        .filter(adm_role::Column::Enabled.eq(true))
        .all(conn)
        .await
        .map_err(DaoError::parse_db_err)?
        .into_iter()
        .map(|role| role.id)
        .collect();
    if active_role_ids.is_empty() {
        return Ok(AdmScopeCtx { user_id, sets: AdmScopeSets::default() });
    }

    let realm_ids: Vec<i64> = adm_role_realm_scope::Entity::find()
        .filter(adm_role_realm_scope::Column::RoleId.is_in(active_role_ids.clone()))
        .all(conn)
        .await
        .map_err(DaoError::parse_db_err)?
        .into_iter()
        .map(|row| row.realm_id)
        .collect();
    let org_roots: Vec<i64> = adm_role_org_scope::Entity::find()
        .filter(adm_role_org_scope::Column::RoleId.is_in(active_role_ids.clone()))
        .all(conn)
        .await
        .map_err(DaoError::parse_db_err)?
        .into_iter()
        .map(|row| row.org_id)
        .collect();
    let app_ids: Vec<i64> = adm_role_app_scope::Entity::find()
        .filter(adm_role_app_scope::Column::RoleId.is_in(active_role_ids))
        .all(conn)
        .await
        .map_err(DaoError::parse_db_err)?
        .into_iter()
        .map(|row| row.app_id)
        .collect();

    let mut sets = AdmScopeSets {
        realm_ids: non_empty(realm_ids.clone()),
        app_ids: non_empty(app_ids),
        ..Default::default()
    };
    // 一条范围都没配 ⇒ 全量可见，后面的查询都不必再打
    if realm_ids.is_empty() && org_roots.is_empty() {
        return Ok(AdmScopeCtx { user_id, sets });
    }

    // 领域轴 → 用户 / 组织
    let mut org_ids: HashSet<i64> = HashSet::new();
    let mut user_ids: HashSet<i64> = HashSet::new();
    if !realm_ids.is_empty() {
        let realm_users = adm_realm_user::Entity::find()
            .filter(adm_realm_user::Column::RealmId.is_in(realm_ids.clone()))
            .all(conn)
            .await
            .map_err(DaoError::parse_db_err)?;
        for row in realm_users {
            user_ids.insert(row.user_id);
        }
        let realm_orgs = adm_realm_org::Entity::find()
            .filter(adm_realm_org::Column::RealmId.is_in(realm_ids.clone()))
            .all(conn)
            .await
            .map_err(DaoError::parse_db_err)?;
        for row in realm_orgs {
            org_ids.insert(row.org_id);
        }
    }

    // 组织轴 → 展开子树（tree_code 每 3 位一层）
    if !org_roots.is_empty() {
        let all_orgs = adm_org::Entity::find()
            .all(conn)
            .await
            .map_err(DaoError::parse_db_err)?;
        let prefixes: Vec<String> = all_orgs
            .iter()
            .filter(|org| org_roots.contains(&org.id))
            .map(|org| org.tree_code.clone())
            .collect();
        for org in &all_orgs {
            if prefixes.iter().any(|prefix| is_in_subtree(&org.tree_code, prefix)) {
                org_ids.insert(org.id);
            }
        }
    }

    // 组织范围里的用户
    if !org_ids.is_empty() {
        let org_id_list: Vec<i64> = org_ids.iter().copied().collect();
        let org_users = adm_org_user::Entity::find()
            .filter(adm_org_user::Column::OrgId.is_in(org_id_list.clone()))
            .all(conn)
            .await
            .map_err(DaoError::parse_db_err)?;
        for row in org_users {
            user_ids.insert(row.user_id);
        }
        sets.org_ids = non_empty(org_id_list);
    } else {
        // 配了范围但没有命中任何组织（含"只配了领域但该领域下无组织"）：
        // 不能退化成全量，否则组织列表会把范围外数据漏出来
        sets.org_ids = Some(vec![-1]);
    }

    // 当前用户自己始终可见
    user_ids.insert(user_id as i64);
    let visible_users: Vec<i64> = user_ids.into_iter().collect();
    sets.user_ids = non_empty(visible_users.clone());

    // 人员随用户：person_id ← adm_user
    let person_ids: Vec<i64> = adm_user::Entity::find()
        .filter(adm_user::Column::Id.is_in(visible_users))
        .all(conn)
        .await
        .map_err(DaoError::parse_db_err)?
        .into_iter()
        .filter_map(|user| user.person_id)
        .collect();
    sets.person_ids = Some(empty_matches_nothing(person_ids));

    Ok(AdmScopeCtx { user_id, sets })
}

/// 判断 `code` 是否在以 `prefix` 为根的整棵子树中（含根自身）
fn is_in_subtree(code: &str, prefix: &str) -> bool {
    code.starts_with(prefix) && (code.len() - prefix.len()) % 3 == 0
}

/// 空集合转成"匹配不到任何行"的哨兵，避免 `IN ()` 生成非法 SQL
fn empty_matches_nothing(mut ids: Vec<i64>) -> Vec<i64> {
    if ids.is_empty() {
        ids.push(-1);
    }
    ids
}

fn non_empty(ids: Vec<i64>) -> Option<Vec<i64>> {
    if ids.is_empty() { None } else { Some(ids) }
}

fn only<C>(expr: C) -> Condition
where
    C: Into<Condition>,
{
    Condition::all().add(expr)
}

/// # 业务侧的数据范围策略
///
/// 注册到 `robotech::dao::set_data_scope` 后，`#[dao]` 生成的每个读写方法
/// 都会按表名来问一次条件。这里只做同步的「读缓存 + 拼条件」，不查库。
pub struct AdmDataScope;

impl DataScope for AdmDataScope {
    fn condition(&self, table: &str) -> Option<Condition> {
        let ctx = current_scope()?;
        let sets = &ctx.sets;
        match table {
            "adm_realm" => sets
                .realm_ids
                .as_ref()
                .map(|ids| only(adm_realm::Column::Id.is_in(ids.clone()))),
            // 领域归属表按「可见用户」过滤：org 型 scope 下也必须挡住范围外的用户
            "adm_realm_user" => sets
                .user_ids
                .as_ref()
                .map(|ids| only(adm_realm_user::Column::UserId.is_in(ids.clone()))),
            "adm_realm_org" => sets.org_ids.as_ref().map(|ids| {
                only(adm_realm_org::Column::OrgId.is_in(ids.clone()))
            }).or_else(|| {
                sets.realm_ids
                    .as_ref()
                    .map(|ids| only(adm_realm_org::Column::RealmId.is_in(ids.clone())))
            }),
            "adm_org" => sets
                .org_ids
                .as_ref()
                .map(|ids| only(adm_org::Column::Id.is_in(ids.clone()))),
            "adm_org_user" => sets
                .org_ids
                .as_ref()
                .map(|ids| only(adm_org_user::Column::OrgId.is_in(ids.clone()))),
            "adm_user" => sets
                .user_ids
                .as_ref()
                .map(|ids| only(adm_user::Column::Id.is_in(ids.clone()))),
            "adm_person" => sets
                .person_ids
                .as_ref()
                .map(|ids| only(adm_person::Column::Id.is_in(ids.clone()))),
            "adm_app" => sets
                .app_ids
                .as_ref()
                .map(|ids| only(adm_app::Column::Id.is_in(ids.clone()))),
            "adm_menu" => sets
                .app_ids
                .as_ref()
                .map(|ids| only(adm_menu::Column::AppId.is_in(ids.clone()))),
            // 应用之外的功能与授权资产（角色、权限、菜单权限、字典、日志……）
            // 与数据范围无关，返回 None 表示不过滤。
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn subtree_matches_self_and_descendants_only() {
        assert!(is_in_subtree("001", "001"));
        assert!(is_in_subtree("001001", "001"));
        assert!(is_in_subtree("001001002", "001"));
        assert!(!is_in_subtree("002", "001"));
        assert!(!is_in_subtree("0010", "001"));
    }

    #[test]
    fn empty_sets_are_transparent() {
        let sets = AdmScopeSets::default();
        assert!(sets.realm_ids.is_none());
        assert!(sets.org_ids.is_none());
        assert!(sets.user_ids.is_none());
        assert_eq!(empty_matches_nothing(vec![]), vec![-1]);
        assert_eq!(non_empty(vec![]), None);
    }
}
