//! # adm 自身数据域的 widget 数据端点
//!
//! 只读 adm 自己的数据库，不碰其它服务。当前用户由 `X-User-Id` 传入，
//! 这里只做白名单取值，不允许任意表达式；失败以统一信封返回，前端只降级
//! 这一张卡片。跨服务取数由前端经 gatex 并行直连，adm-svr 不参与编排。

use super::adm_dashboard_svc::AdmDashboardSvc;
use crate::dic::UserStatus;
use crate::mo::{
    adm_login_log, adm_menu, adm_op_log, adm_org, adm_perm, adm_person, adm_realm, adm_role,
    adm_user,
};
use chrono::TimeZone;
use robotech::db::get_db_conn;
use robotech::svc::SvcError;
use sea_orm::{
    ColumnTrait, Condition, ConnectionTrait, DatabaseBackend, EntityTrait, PaginatorTrait,
    QueryFilter, Statement,
};
use serde_json::{json, Map, Value};
use wheel_rs::time_utils::now_ms;

/// # adm 数据端点服务
pub struct AdmWidgetDataSvc;

impl AdmWidgetDataSvc {
    /// # 按端点键执行
    ///
    /// 只接受注册表里声明的 6 个键；未知端点返回 NotFound，不执行任何 SQL。
    pub async fn exec(
        endpoint: &str,
        params: &Value,
        user_id: u64,
    ) -> Result<Value, SvcError> {
        match endpoint {
            "stats.count" => Self::stats_count(params).await,
            "stats.trend" => Self::stats_trend(params).await,
            "stats.todos" => Self::stats_todos().await,
            "logs.recent" => Self::logs_recent(params).await,
            "menu.shortcuts" => Self::menu_shortcuts(params, user_id).await,
            "auth.my_permissions" => Self::my_permissions(user_id).await,
            other => Err(SvcError::NotFound(format!(
                "未实现的 widget 数据端点 `{other}`"
            ))),
        }
    }

    /// # 单项计数
    ///
    /// 参数：`metric`（白名单）、可选 `label` / `path` 覆盖展示文案。
    async fn stats_count(params: &Value) -> Result<Value, SvcError> {
        let metric = params
            .get("metric")
            .and_then(Value::as_str)
            .unwrap_or("users");
        let db = get_db_conn()?;

        let (value, default_label, default_path): (u64, &str, &str) = match metric {
            "users" => (
                adm_user::Entity::find()
                    .filter(scoped("adm_user"))
                    .count(db.as_ref())
                    .await
                    .map_err(robotech::dao::DaoError::parse_db_err)?,
                "用户账号",
                "/users",
            ),
            "roles" => (
                adm_role::Entity::find()
                    .count(db.as_ref())
                    .await
                    .map_err(robotech::dao::DaoError::parse_db_err)?,
                "角色数量",
                "/roles",
            ),
            "menus" => (
                adm_menu::Entity::find()
                    .filter(scoped("adm_menu"))
                    .count(db.as_ref())
                    .await
                    .map_err(robotech::dao::DaoError::parse_db_err)?,
                "菜单数量",
                "/menus",
            ),
            "perms" => (
                adm_perm::Entity::find()
                    .count(db.as_ref())
                    .await
                    .map_err(robotech::dao::DaoError::parse_db_err)?,
                "权限数量",
                "/perms",
            ),
            "orgs" => (
                adm_org::Entity::find()
                    .filter(scoped("adm_org"))
                    .count(db.as_ref())
                    .await
                    .map_err(robotech::dao::DaoError::parse_db_err)?,
                "组织数量",
                "/orgs",
            ),
            "persons" => (
                adm_person::Entity::find()
                    .filter(scoped("adm_person"))
                    .count(db.as_ref())
                    .await
                    .map_err(robotech::dao::DaoError::parse_db_err)?,
                "人员数量",
                "/persons",
            ),
            "realms" => (
                adm_realm::Entity::find()
                    .filter(scoped("adm_realm"))
                    .count(db.as_ref())
                    .await
                    .map_err(robotech::dao::DaoError::parse_db_err)?,
                "领域数量",
                "/realms",
            ),
            "login_logs" => (
                adm_login_log::Entity::find()
                    .count(db.as_ref())
                    .await
                    .map_err(robotech::dao::DaoError::parse_db_err)?,
                "登录次数",
                "/login-logs",
            ),
            "op_logs" => (
                adm_op_log::Entity::find()
                    .count(db.as_ref())
                    .await
                    .map_err(robotech::dao::DaoError::parse_db_err)?,
                "操作日志数量",
                "/op-logs",
            ),
            other => {
                return Err(SvcError::Validation(
                    validation_error(format!("未知的 KPI metric `{other}`")),
                ));
            }
        };

        let label = params
            .get("label")
            .and_then(Value::as_str)
            .unwrap_or(default_label);
        let path = params
            .get("path")
            .and_then(Value::as_str)
            .unwrap_or(default_path);
        Ok(json!({
            "metric": metric,
            "label": label,
            "value": value,
            "path": path,
        }))
    }

    /// # 登录 / 操作趋势
    ///
    /// 参数：`days`（1-90，常用 7/30）、`metric`（login/op）。
    /// 按天分组使用 `Asia/Shanghai`（本部署的应用时区）。
    async fn stats_trend(params: &Value) -> Result<Value, SvcError> {
        let days = params
            .get("days")
            .and_then(Value::as_i64)
            .unwrap_or(7)
            .clamp(1, 90);
        let metric = params
            .get("metric")
            .and_then(Value::as_str)
            .unwrap_or("login");
        let (table, time_column) = match metric {
            "login" => ("adm_login_log", "login_ms"),
            "op" => ("adm_op_log", "create_ms"),
            other => {
                return Err(SvcError::Validation(validation_error(format!(
                    "未知的趋势 metric `{other}`"
                ))));
            }
        };

        let today = chrono::Local::now().date_naive();
        let start_date = today
            .checked_sub_days(chrono::Days::new((days - 1) as u64))
            .unwrap_or(today);
        let start_ms = chrono::Local
            .from_local_datetime(
                &start_date
                    .and_hms_opt(0, 0, 0)
                    .expect("合法零点"),
            )
            .single()
            .map(|time| time.timestamp_millis())
            .unwrap_or_else(|| now_ms() as i64);

        let sql = format!(
            "select to_char(to_timestamp({time_column} / 1000.0) at time zone 'Asia/Shanghai', 'YYYY-MM-DD') as day, \
             count(*) as cnt from {table} where {time_column} >= $1 group by 1 order by 1"
        );
        let db = get_db_conn()?;
        let rows = db
            .as_ref()
            .query_all_raw(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                sql,
                vec![start_ms.into()],
            ))
            .await
            .map_err(robotech::dao::DaoError::parse_db_err)?;

        let mut counts: Map<String, Value> = Map::new();
        for row in rows {
            let day: String = row.try_get("", "day").unwrap_or_default();
            let count: i64 = row.try_get("", "cnt").unwrap_or(0);
            if !day.is_empty() {
                counts.insert(day, json!(count));
            }
        }

        let mut points = Vec::with_capacity(days as usize);
        let mut total: i64 = 0;
        for index in 0..days {
            let date = start_date
                .checked_add_days(chrono::Days::new(index as u64))
                .unwrap_or(today);
            let key = date.format("%Y-%m-%d").to_string();
            let count = counts
                .get(&key)
                .and_then(Value::as_i64)
                .unwrap_or(0);
            total = total.saturating_add(count);
            points.push(json!({ "date": key, "count": count }));
        }
        let today_key = today.format("%Y-%m-%d").to_string();
        let today_count = counts
            .get(&today_key)
            .and_then(Value::as_i64)
            .unwrap_or(0);

        Ok(json!({
            "days": days,
            "metric": metric,
            "points": points,
            "total": total,
            "today": today_count,
        }))
    }

    /// # 待办聚合
    async fn stats_todos() -> Result<Value, SvcError> {
        let db = get_db_conn()?;
        let now = now_ms() as i64;

        let default_password = adm_user::Entity::find()
            .filter(adm_user::Column::LoginPswdDefault.eq(true))
            .filter(adm_user::Column::Enabled.eq(true))
            .count(db.as_ref())
            .await
            .map_err(robotech::dao::DaoError::parse_db_err)?;
        let locked = adm_user::Entity::find()
            .filter(
                Condition::any()
                    .add(adm_user::Column::Status.eq(UserStatus::Locked as i16))
                    .add(adm_user::Column::LockUntilMs.gt(now)),
            )
            .count(db.as_ref())
            .await
            .map_err(robotech::dao::DaoError::parse_db_err)?;
        let expired = adm_user::Entity::find()
            .filter(adm_user::Column::ExpireMs.lte(now))
            .count(db.as_ref())
            .await
            .map_err(robotech::dao::DaoError::parse_db_err)?;
        let disabled = adm_user::Entity::find()
            .filter(
                Condition::any()
                    .add(adm_user::Column::Enabled.eq(false))
                    .add(adm_user::Column::Status.eq(UserStatus::Disabled as i16)),
            )
            .count(db.as_ref())
            .await
            .map_err(robotech::dao::DaoError::parse_db_err)?;

        let mut items = Vec::new();
        let mut total: u64 = 0;
        for (code, label, count, path, severity) in [
            ("default_password", "未修改初始口令", default_password, "/users", "warn"),
            ("locked", "锁定账号", locked, "/users", "danger"),
            ("expired", "已过期账号", expired, "/users", "warn"),
            ("disabled", "停用账号", disabled, "/users", "neutral"),
        ] {
            if count > 0 {
                total = total.saturating_add(count);
                items.push(json!({
                    "code": code,
                    "label": label,
                    "count": count,
                    "path": path,
                    "severity": severity,
                }));
            }
        }
        Ok(json!({ "items": items, "total": total }))
    }

    /// # 最近日志
    ///
    /// 参数：`source`（login/op）、`limit`（1-20）。
    async fn logs_recent(params: &Value) -> Result<Value, SvcError> {
        let source = params
            .get("source")
            .and_then(Value::as_str)
            .unwrap_or("login");
        let limit = params
            .get("limit")
            .and_then(Value::as_i64)
            .unwrap_or(5)
            .clamp(1, 20);
        let db = get_db_conn()?;

        let sql = match source {
            "login" => {
                "select l.id, l.user_id, u.name as user_name, l.login_ms as time_ms, \
                 l.login_ip as ip, l.logout_ms from adm_login_log l \
                 left join adm_user u on u.id = l.user_id \
                 order by l.login_ms desc limit $1"
            }
            "op" => {
                "select o.id, o.user_id, u.name as user_name, o.create_ms as time_ms, \
                 o.op_title as title, o.op_urn as urn from adm_op_log o \
                 left join adm_user u on u.id = o.user_id \
                 order by o.create_ms desc limit $1"
            }
            other => {
                return Err(SvcError::Validation(validation_error(format!(
                    "未知的日志来源 `{other}`"
                ))));
            }
        };
        let rows = db
            .as_ref()
            .query_all_raw(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                sql,
                vec![limit.into()],
            ))
            .await
            .map_err(robotech::dao::DaoError::parse_db_err)?;

        let mut items = Vec::with_capacity(rows.len());
        for row in rows {
            let id: i64 = row.try_get("", "id").unwrap_or(0);
            let user_id: Option<i64> = row.try_get("", "user_id").ok();
            let user_name: Option<String> = row.try_get("", "user_name").ok();
            let time_ms: i64 = row.try_get("", "time_ms").unwrap_or(0);
            let ip: Option<String> = row.try_get("", "ip").ok();
            let title: Option<String> = row.try_get("", "title").ok();
            let urn: Option<String> = row.try_get("", "urn").ok();
            items.push(json!({
                "id": id,
                "userId": user_id.map(|id| id.to_string()),
                "userName": user_name.unwrap_or_else(|| "已删除用户".to_string()),
                "timeMs": time_ms,
                "ip": ip,
                "title": title,
                "urn": urn,
            }));
        }
        Ok(json!({ "source": source, "items": items }))
    }

    /// # 快捷入口
    ///
    /// 直接用当前用户可见菜单，不额外拼 URL。
    async fn menu_shortcuts(params: &Value, user_id: u64) -> Result<Value, SvcError> {
        let limit = params
            .get("limit")
            .and_then(Value::as_i64)
            .unwrap_or(8)
            .clamp(1, 20) as usize;
        let ctx = AdmDashboardSvc::load_user_context(user_id).await?;
        let items: Vec<Value> = ctx
            .menus
            .iter()
            .filter(|menu| menu.link_type == 1 && !menu.path.trim().is_empty())
            .take(limit)
            .map(|menu| {
                json!({
                    "id": menu.id.to_string(),
                    "label": menu.name,
                    "path": menu.path,
                    "component": menu.component,
                    "icon": menu.icon,
                })
            })
            .collect();
        Ok(json!({ "items": items }))
    }

    /// # 我的权限摘要
    async fn my_permissions(user_id: u64) -> Result<Value, SvcError> {
        let ctx = AdmDashboardSvc::load_user_context(user_id).await?;
        let scope_note = if ctx.scopes.is_empty() {
            "未配置角色可见范围，统计为全量数据（领域 / 组织 / 应用配了才限制）".to_string()
        } else {
            format!(
                "数据已按 {} 条角色可见范围（领域 / 组织 / 应用）强制过滤",
                ctx.scopes.len()
            )
        };
        Ok(json!({
            "roleCount": ctx.roles.len(),
            "permCount": ctx.perm_urns.len(),
            "menuCount": ctx.menus.len(),
            "roles": ctx.roles.iter().map(|role| json!({
                "id": role.id.to_string(),
                "name": role.name,
            })).collect::<Vec<_>>(),
            "scopes": ctx.scopes,
            "scopeNote": scope_note,
        }))
    }
}

fn validation_error(message: String) -> validator::ValidationError {
    let mut error = validator::ValidationError::new("widget_data");
    error.message = Some(std::borrow::Cow::Owned(message));
    error
}

/// 统计端点与 DAO 层共用同一套数据范围条件，避免「列表受限、KPI 泄漏」。
fn scoped(table: &str) -> Condition {
    robotech::dao::data_scope_condition(table, Condition::all())
}
