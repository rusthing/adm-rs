//! # 角色首页配置服务
//!
//! 职责边界（最终口径）：
//! - 只读写 `adm_dashboard` + `adm_dashboard_widget`（角色级或全局）
//! - 按角色优先级选出当前用户生效的配置
//! - 提供 adm 自身域的 widget 数据端点
//!
//! adm-svr **不做 BFF 聚合、不转发 token、不探测下游健康**：前端通过 gatex
//! 网关并行直连各服务；鉴权、路由、限流、降级由网关统一负责。
//! 角色可见范围拆成 `adm_role_realm_scope` / `adm_role_org_scope` /
//! `adm_role_app_scope` 三张表：只管可见范围（白名单），不管功能权限；
//! 强制过滤由 `crate::svc::adm_data_scope` 在 DAO 层统一注入。

use crate::dto::{AdmDashboardSaveDto, AdmWidgetDataReq};
use crate::mo::{
    adm_dashboard, adm_dashboard_widget, adm_menu, adm_perm, adm_role, adm_role_app_scope,
    adm_role_menu, adm_role_org_scope, adm_role_perm, adm_role_realm_scope, adm_role_user,
    adm_user, adm_widget_endpoint, adm_widget_type,
};
use crate::vo::{
    AdmDashboardVo, AdmDashboardWidgetVo, AdmRoleScopeVo, AdmWidgetDataVo, AdmWidgetEndpointVo,
    AdmWidgetServiceVo, AdmWidgetTypeVo,
};
use robotech::dao::{begin_transaction, commit_transaction, DaoError};
use robotech::db::get_db_conn;
use robotech::svc::SvcError;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, EntityTrait, QueryFilter, QueryOrder, Set,
};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use wheel_rs::time_utils::now_ms;

const MAX_WIDGETS: usize = 50;

/// 当前用户上下文（首页配置与 adm 域 widget 数据端点共用）
#[derive(Debug, Clone)]
pub struct AdmDashboardUserContext {
    pub user_id: u64,
    pub user_name: String,
    pub roles: Vec<adm_role::Model>,
    pub perm_urns: Vec<String>,
    pub menus: Vec<adm_menu::Model>,
    pub scopes: Vec<AdmRoleScopeVo>,
}

/// # 首页配置服务
pub struct AdmDashboardSvc;

impl AdmDashboardSvc {
    /// # 当前用户上下文
    ///
    /// 一次取出用户、角色、权限、可见菜单与角色可见范围；`/me`、生效配置和
    /// adm 域 widget 端点都复用这份逻辑，避免多套权限判断。
    pub async fn load_user_context(user_id: u64) -> Result<AdmDashboardUserContext, SvcError> {
        let db = get_db_conn()?;
        let user = adm_user::Entity::find_by_id(user_id as i64)
            .one(db.as_ref())
            .await
            .map_err(DaoError::parse_db_err)?
            .ok_or_else(|| SvcError::NotFound(format!("用户 {user_id} 不存在")))?;

        let role_ids: Vec<i64> = adm_role_user::Entity::find()
            .filter(adm_role_user::Column::UserId.eq(user.id))
            .all(db.as_ref())
            .await
            .map_err(DaoError::parse_db_err)?
            .into_iter()
            .map(|link| link.role_id)
            .collect();

        let roles = if role_ids.is_empty() {
            Vec::new()
        } else {
            adm_role::Entity::find()
                .filter(adm_role::Column::Id.is_in(role_ids))
                .filter(adm_role::Column::Enabled.eq(true))
                .order_by_asc(adm_role::Column::SortOrder)
                .order_by_asc(adm_role::Column::Id)
                .all(db.as_ref())
                .await
                .map_err(DaoError::parse_db_err)?
        };
        let active_role_ids: Vec<i64> = roles.iter().map(|role| role.id).collect();

        let menus = Self::load_menus(&active_role_ids, db.as_ref()).await?;
        let perms = Self::load_perms(&active_role_ids, db.as_ref()).await?;
        let perm_urns = perms.iter().map(|perm| perm.urn.clone()).collect();
        let scopes = Self::load_scopes(&active_role_ids, &roles, db.as_ref()).await?;

        Ok(AdmDashboardUserContext {
            user_id: user.id as u64,
            user_name: user.name,
            roles,
            perm_urns,
            menus,
            scopes,
        })
    }

    async fn load_menus(
        role_ids: &[i64],
        db: &sea_orm::DatabaseConnection,
    ) -> Result<Vec<adm_menu::Model>, SvcError> {
        if role_ids.is_empty() {
            return Ok(Vec::new());
        }
        let menu_ids: Vec<i64> = adm_role_menu::Entity::find()
            .filter(adm_role_menu::Column::RoleId.is_in(role_ids.to_vec()))
            .all(db)
            .await
            .map_err(DaoError::parse_db_err)?
            .into_iter()
            .map(|link| link.menu_id)
            .collect();
        if menu_ids.is_empty() {
            return Ok(Vec::new());
        }

        // 应用可见范围只做「能进哪些应用」的收窄，与 role_menu/role_perm 的功能
        // 授权取交集：配了 app_scope 才限制，没配则全部应用可见。
        let app_ids: Vec<i64> = adm_role_app_scope::Entity::find()
            .filter(adm_role_app_scope::Column::RoleId.is_in(role_ids.to_vec()))
            .all(db)
            .await
            .map_err(DaoError::parse_db_err)?
            .into_iter()
            .map(|link| link.app_id)
            .collect();
        let mut query = adm_menu::Entity::find()
            .filter(adm_menu::Column::Id.is_in(menu_ids))
            .filter(adm_menu::Column::Enabled.eq(true))
            .filter(adm_menu::Column::Visible.eq(true));
        if !app_ids.is_empty() {
            query = query.filter(adm_menu::Column::AppId.is_in(app_ids));
        }
        query
            .order_by_asc(adm_menu::Column::TreeCode)
            .all(db)
            .await
            .map_err(DaoError::parse_db_err)
            .map_err(Into::into)
    }

    async fn load_perms(
        role_ids: &[i64],
        db: &sea_orm::DatabaseConnection,
    ) -> Result<Vec<adm_perm::Model>, SvcError> {
        if role_ids.is_empty() {
            return Ok(Vec::new());
        }
        let perm_ids: Vec<i64> = adm_role_perm::Entity::find()
            .filter(adm_role_perm::Column::RoleId.is_in(role_ids.to_vec()))
            .all(db)
            .await
            .map_err(DaoError::parse_db_err)?
            .into_iter()
            .map(|link| link.perm_id)
            .collect();
        if perm_ids.is_empty() {
            return Ok(Vec::new());
        }
        adm_perm::Entity::find()
            .filter(adm_perm::Column::Id.is_in(perm_ids))
            .filter(adm_perm::Column::Enabled.eq(true))
            .order_by_asc(adm_perm::Column::SortOrder)
            .order_by_asc(adm_perm::Column::Id)
            .all(db)
            .await
            .map_err(DaoError::parse_db_err)
            .map_err(Into::into)
    }

    /// # 当前用户的角色可见范围
    ///
    /// 三条轴分别查三张表，再合成一个带 `scopeType` 的列表下发。
    /// 白名单语义：某张表没有行，说明该维度没有限制（全量可见）。
    async fn load_scopes(
        role_ids: &[i64],
        roles: &[adm_role::Model],
        db: &sea_orm::DatabaseConnection,
    ) -> Result<Vec<AdmRoleScopeVo>, SvcError> {
        if role_ids.is_empty() {
            return Ok(Vec::new());
        }
        let ids = role_ids.to_vec();
        let role_names: HashMap<i64, String> = roles
            .iter()
            .map(|role| (role.id, role.name.clone()))
            .collect();

        let realm_rows = adm_role_realm_scope::Entity::find()
            .filter(adm_role_realm_scope::Column::RoleId.is_in(ids.clone()))
            .all(db)
            .await
            .map_err(DaoError::parse_db_err)?;
        let org_rows = adm_role_org_scope::Entity::find()
            .filter(adm_role_org_scope::Column::RoleId.is_in(ids.clone()))
            .all(db)
            .await
            .map_err(DaoError::parse_db_err)?;
        let app_rows = adm_role_app_scope::Entity::find()
            .filter(adm_role_app_scope::Column::RoleId.is_in(ids))
            .all(db)
            .await
            .map_err(DaoError::parse_db_err)?;

        let mut result = Vec::with_capacity(realm_rows.len() + org_rows.len() + app_rows.len());
        for row in realm_rows {
            result.push(AdmRoleScopeVo {
                id: row.id as u64,
                role_id: row.role_id as u64,
                role_name: role_names.get(&row.role_id).cloned(),
                realm_id: Some(row.realm_id.to_string()),
                org_id: None,
                app_id: None,
                scope_type: "realm".to_string(),
            });
        }
        for row in org_rows {
            result.push(AdmRoleScopeVo {
                id: row.id as u64,
                role_id: row.role_id as u64,
                role_name: role_names.get(&row.role_id).cloned(),
                realm_id: None,
                org_id: Some(row.org_id.to_string()),
                app_id: None,
                scope_type: "org".to_string(),
            });
        }
        for row in app_rows {
            result.push(AdmRoleScopeVo {
                id: row.id as u64,
                role_id: row.role_id as u64,
                role_name: role_names.get(&row.role_id).cloned(),
                realm_id: None,
                org_id: None,
                app_id: Some(row.app_id.to_string()),
                scope_type: "app".to_string(),
            });
        }
        result.sort_by(|left, right| {
            left.role_id
                .cmp(&right.role_id)
                .then_with(|| left.scope_type.cmp(&right.scope_type))
                .then_with(|| left.id.cmp(&right.id))
        });
        Ok(result)
    }

    /// # 当前用户生效的首页配置
    ///
    /// 按角色 `sort_order` 取第一份「启用且有启用 widget」的角色配置；
    /// 角色都没有时回落全局模板。返回前按 `permUrn` 前缀过滤并去掉停用项。
    pub async fn effective_dashboard(
        ctx: &AdmDashboardUserContext,
    ) -> Result<Option<AdmDashboardVo>, SvcError> {
        let db = get_db_conn()?;

        if !ctx.roles.is_empty() {
            let role_ids: Vec<i64> = ctx.roles.iter().map(|role| role.id).collect();
            let dashboards = adm_dashboard::Entity::find()
                .filter(adm_dashboard::Column::RoleId.is_in(role_ids))
                .filter(adm_dashboard::Column::Enabled.eq(true))
                .all(db.as_ref())
                .await
                .map_err(DaoError::parse_db_err)?;
            let by_role: HashMap<i64, adm_dashboard::Model> = dashboards
                .into_iter()
                .filter_map(|dash| dash.role_id.map(|role_id| (role_id, dash)))
                .collect();

            for role in &ctx.roles {
                let Some(dash) = by_role.get(&role.id) else {
                    continue;
                };
                let widgets =
                    Self::load_widgets(&dash.id, true, Some(&ctx.perm_urns), db.as_ref()).await?;
                if widgets.is_empty() {
                    continue;
                }
                return Ok(Some(Self::dashboard_vo(
                    dash,
                    Some(role.name.clone()),
                    widgets,
                    "role",
                )));
            }
        }

        let global = adm_dashboard::Entity::find()
            .filter(adm_dashboard::Column::RoleId.is_null())
            .filter(adm_dashboard::Column::Enabled.eq(true))
            .one(db.as_ref())
            .await
            .map_err(DaoError::parse_db_err)?;
        let Some(global) = global else {
            return Ok(None);
        };
        let widgets = Self::load_widgets(&global.id, true, Some(&ctx.perm_urns), db.as_ref()).await?;
        if widgets.is_empty() {
            return Ok(None);
        }
        Ok(Some(Self::dashboard_vo(&global, None, widgets, "global")))
    }

    /// # 按用户 ID 读取生效配置（`GET /adm/dashboard/effective`）
    pub async fn effective_config(user_id: u64) -> Result<Option<AdmDashboardVo>, SvcError> {
        let ctx = Self::load_user_context(user_id).await?;
        Self::effective_dashboard(&ctx).await
    }

    async fn load_widgets(
        dashboard_id: &i64,
        enabled_only: bool,
        perm_urns: Option<&[String]>,
        db: &sea_orm::DatabaseConnection,
    ) -> Result<Vec<AdmDashboardWidgetVo>, SvcError> {
        let mut query = adm_dashboard_widget::Entity::find()
            .filter(adm_dashboard_widget::Column::DashboardId.eq(*dashboard_id));
        if enabled_only {
            query = query.filter(adm_dashboard_widget::Column::Enabled.eq(true));
        }
        let rows = query
            .order_by_asc(adm_dashboard_widget::Column::SortOrder)
            .order_by_asc(adm_dashboard_widget::Column::Id)
            .all(db)
            .await
            .map_err(DaoError::parse_db_err)?;

        let mut widgets = Vec::with_capacity(rows.len());
        for row in rows {
            if let Some(perms) = perm_urns
                && !Self::permitted(perms, row.perm_urn.as_deref())
            {
                continue;
            }
            widgets.push(Self::widget_vo(row));
        }
        Ok(widgets)
    }

    fn widget_vo(row: adm_dashboard_widget::Model) -> AdmDashboardWidgetVo {
        let params = row
            .params
            .as_deref()
            .and_then(|text| serde_json::from_str::<Value>(text).ok())
            .filter(Value::is_object)
            .or_else(|| Some(json!({})));
        AdmDashboardWidgetVo {
            id: row.id as u64,
            dashboard_id: row.dashboard_id as u64,
            widget_type: row.widget_type,
            title: row.title,
            service: row.service,
            endpoint: row.endpoint,
            params,
            perm_urn: row.perm_urn,
            scope_aware: row.scope_aware,
            sort_order: row.sort_order,
            enabled: row.enabled,
        }
    }

    fn dashboard_vo(
        dash: &adm_dashboard::Model,
        role_name: Option<String>,
        widgets: Vec<AdmDashboardWidgetVo>,
        source: &str,
    ) -> AdmDashboardVo {
        AdmDashboardVo {
            id: dash.id as u64,
            role_id: dash.role_id.map(|id| id.to_string()),
            role_name,
            name: dash.name.clone(),
            remark: dash.remark.clone(),
            enabled: dash.enabled,
            source: source.to_string(),
            scope_aware: widgets.iter().any(|widget| widget.scope_aware),
            widgets,
        }
    }

    /// 权限 URN 前缀匹配，与前端 `hasPerm` 的规则一致
    fn permitted(perm_urns: &[String], required: Option<&str>) -> bool {
        let Some(required) = required.map(str::trim).filter(|text| !text.is_empty()) else {
            return true;
        };
        let required = required.to_lowercase();
        perm_urns
            .iter()
            .any(|urn| urn.to_lowercase().starts_with(&required))
    }

    /// # 管理页：列出全部配置
    pub async fn list_configs() -> Result<Vec<AdmDashboardVo>, SvcError> {
        let db = get_db_conn()?;
        let dashboards = adm_dashboard::Entity::find()
            .order_by_asc(adm_dashboard::Column::Id)
            .all(db.as_ref())
            .await
            .map_err(DaoError::parse_db_err)?;
        let roles = adm_role::Entity::find()
            .all(db.as_ref())
            .await
            .map_err(DaoError::parse_db_err)?;
        let role_map: HashMap<i64, adm_role::Model> =
            roles.into_iter().map(|role| (role.id, role)).collect();

        let mut result = Vec::with_capacity(dashboards.len());
        for dash in dashboards {
            let widgets = Self::load_widgets(&dash.id, false, None, db.as_ref()).await?;
            let role_name = dash
                .role_id
                .and_then(|role_id| role_map.get(&role_id).map(|role| role.name.clone()));
            let source = if dash.role_id.is_some() { "role" } else { "global" };
            result.push(Self::dashboard_vo(&dash, role_name, widgets, source));
        }

        // 全局模板排最前，其余按角色 sortOrder / id 排
        result.sort_by(|left, right| {
            let left_key = left
                .role_id
                .as_deref()
                .and_then(|id| id.parse::<i64>().ok())
                .and_then(|id| role_map.get(&id).map(|role| (role.sort_order, id)))
                .unwrap_or((i32::MIN, 0));
            let right_key = right
                .role_id
                .as_deref()
                .and_then(|id| id.parse::<i64>().ok())
                .and_then(|id| role_map.get(&id).map(|role| (role.sort_order, id)))
                .unwrap_or((i32::MIN, 0));
            left_key
                .0
                .cmp(&right_key.0)
                .then(left_key.1.cmp(&right_key.1))
        });
        Ok(result)
    }

    /// # 管理页：读取单份配置
    pub async fn get_config(role_id: Option<i64>) -> Result<Option<AdmDashboardVo>, SvcError> {
        let db = get_db_conn()?;
        let dash = Self::find_dashboard(role_id, db.as_ref()).await?;
        let Some(dash) = dash else {
            return Ok(None);
        };
        let widgets = Self::load_widgets(&dash.id, false, None, db.as_ref()).await?;
        let role_name = match dash.role_id {
            Some(role_id) => adm_role::Entity::find_by_id(role_id)
                .one(db.as_ref())
                .await
                .map_err(DaoError::parse_db_err)?
                .map(|role| role.name),
            None => None,
        };
        let source = if dash.role_id.is_some() { "role" } else { "global" };
        Ok(Some(Self::dashboard_vo(&dash, role_name, widgets, source)))
    }

    async fn find_dashboard<C>(
        role_id: Option<i64>,
        db: &C,
    ) -> Result<Option<adm_dashboard::Model>, SvcError>
    where
        C: ConnectionTrait,
    {
        let mut query = adm_dashboard::Entity::find();
        query = match role_id {
            Some(role_id) => query.filter(adm_dashboard::Column::RoleId.eq(role_id)),
            None => query.filter(adm_dashboard::Column::RoleId.is_null()),
        };
        query
            .one(db)
            .await
            .map_err(DaoError::parse_db_err)
            .map_err(Into::into)
    }

    /// # 保存（整份替换）
    ///
    /// 校验点：
    /// - 角色必须存在；全局模板 `roleId` 为空
    /// - widget 类型必须在 `adm_widget_type` 且启用
    /// - `service + endpoint` 必须在 `adm_widget_endpoint` 目录且启用
    ///   （只存逻辑键，禁止任意 URL / 端点，天然防 SSRF）
    /// - 排序由服务端按 `(index + 1) * 10` 重算
    pub async fn save_config(
        dto: AdmDashboardSaveDto,
        operator_id: u64,
    ) -> Result<AdmDashboardVo, SvcError> {
        let role_id = parse_optional_id(dto.role_id.as_deref(), "roleId")?;
        if dto.widgets.len() > MAX_WIDGETS {
            return Err(invalid(format!("widget 数量不能超过 {MAX_WIDGETS}")));
        }

        let db = get_db_conn()?;
        let role = match role_id {
            Some(role_id) => Some(
                adm_role::Entity::find_by_id(role_id)
                    .one(db.as_ref())
                    .await
                    .map_err(DaoError::parse_db_err)?
                    .ok_or_else(|| SvcError::NotFound(format!("角色 {role_id} 不存在")))?,
            ),
            None => None,
        };
        let widget_types: HashMap<String, adm_widget_type::Model> = adm_widget_type::Entity::find()
            .all(db.as_ref())
            .await
            .map_err(DaoError::parse_db_err)?
            .into_iter()
            .map(|row| (row.code.clone(), row))
            .collect();
        let allowed_endpoints: HashSet<(String, String)> = adm_widget_endpoint::Entity::find()
            .filter(adm_widget_endpoint::Column::Enabled.eq(true))
            .all(db.as_ref())
            .await
            .map_err(DaoError::parse_db_err)?
            .into_iter()
            .map(|row| (row.service, row.endpoint))
            .collect();

        let now = now_ms() as i64;
        let mut specs = Vec::with_capacity(dto.widgets.len());
        for (index, item) in dto.widgets.iter().enumerate() {
            let typed = widget_types
                .get(&item.widget_type)
                .ok_or_else(|| invalid(format!("未注册的 widget 类型 `{}`", item.widget_type)))?;
            if !typed.enabled {
                return Err(invalid(format!("widget 类型 `{}` 已停用", item.widget_type)));
            }

            let service = item
                .service
                .clone()
                .filter(|text| !text.trim().is_empty())
                .unwrap_or_else(|| typed.default_service.clone());
            let endpoint = item
                .endpoint
                .clone()
                .filter(|text| !text.trim().is_empty())
                .unwrap_or_else(|| typed.default_endpoint.clone());
            if !allowed_endpoints.contains(&(service.clone(), endpoint.clone())) {
                return Err(invalid(format!(
                    "端点 `{service}/{endpoint}` 不在已启用的 widget 端点目录"
                )));
            }

            let params = match item.params.clone() {
                Some(Value::Object(object)) => Value::Object(object),
                Some(Value::Null) | None => typed
                    .default_params
                    .as_deref()
                    .and_then(|text| serde_json::from_str::<Value>(text).ok())
                    .filter(Value::is_object)
                    .unwrap_or_else(|| json!({})),
                Some(_) => return Err(invalid("params 必须是 JSON 对象".to_string())),
            };

            let title = item
                .title
                .clone()
                .map(|text| text.trim().to_string())
                .filter(|text| !text.is_empty())
                .unwrap_or_else(|| typed.name.clone());
            if title.chars().count() > 64 {
                return Err(invalid("widget 标题不能超过 64 个字符".to_string()));
            }
            let perm_urn = item
                .perm_urn
                .clone()
                .map(|text| text.trim().to_string())
                .filter(|text| !text.is_empty());
            if perm_urn.as_deref().map(str::len).unwrap_or(0) > 128 {
                return Err(invalid("权限 URN 不能超过 128 个字符".to_string()));
            }

            specs.push(WidgetSpec {
                widget_type: item.widget_type.clone(),
                title,
                service,
                endpoint,
                params,
                perm_urn,
                scope_aware: item.scope_aware.unwrap_or(typed.default_scope_aware),
                sort_order: (index as i32 + 1) * 10,
                enabled: item.enabled.unwrap_or(true),
            });
        }

        let name = dto
            .name
            .as_deref()
            .map(str::trim)
            .filter(|text| !text.is_empty())
            .map(str::to_string)
            .unwrap_or_else(|| match &role {
                Some(role) => format!("{}首页", role.name),
                None => "全局兜底首页".to_string(),
            });
        if name.chars().count() > 64 {
            return Err(invalid("配置名不能超过 64 个字符".to_string()));
        }
        let remark = dto
            .remark
            .as_deref()
            .map(str::trim)
            .filter(|text| !text.is_empty())
            .map(str::to_string);
        if remark.as_deref().map(str::len).unwrap_or(0) > 255 {
            return Err(invalid("备注不能超过 255 个字符".to_string()));
        }

        let tx = begin_transaction(db.as_ref()).await?;
        let existing = Self::find_dashboard(role_id, &tx).await?;
        let dashboard_id = match existing {
            Some(model) => {
                let id = model.id;
                let mut active: adm_dashboard::ActiveModel = model.into();
                active.name = Set(name);
                active.remark = Set(remark);
                active.enabled = Set(dto.enabled.unwrap_or(true));
                active.updater_id = Set(operator_id as i64);
                active.update_ms = Set(now);
                active.update(&tx).await.map_err(DaoError::parse_db_err)?;
                id
            }
            None => {
                let id = idworker::next_id()? as i64;
                let active = adm_dashboard::ActiveModel {
                    id: Set(id),
                    role_id: Set(role_id),
                    name: Set(name),
                    remark: Set(remark),
                    enabled: Set(dto.enabled.unwrap_or(true)),
                    creater_id: Set(operator_id as i64),
                    create_ms: Set(now),
                    updater_id: Set(operator_id as i64),
                    update_ms: Set(now),
                };
                adm_dashboard::Entity::insert(active)
                    .exec(&tx)
                    .await
                    .map_err(DaoError::parse_db_err)?;
                id
            }
        };

        adm_dashboard_widget::Entity::delete_many()
            .filter(adm_dashboard_widget::Column::DashboardId.eq(dashboard_id))
            .exec(&tx)
            .await
            .map_err(DaoError::parse_db_err)?;

        for spec in &specs {
            let widget_id = idworker::next_id()? as i64;
            let active = adm_dashboard_widget::ActiveModel {
                id: Set(widget_id),
                dashboard_id: Set(dashboard_id),
                widget_type: Set(spec.widget_type.clone()),
                title: Set(spec.title.clone()),
                service: Set(spec.service.clone()),
                endpoint: Set(spec.endpoint.clone()),
                params: Set(Some(
                    serde_json::to_string(&spec.params).unwrap_or_else(|_| "{}".to_string()),
                )),
                perm_urn: Set(spec.perm_urn.clone()),
                scope_aware: Set(spec.scope_aware),
                sort_order: Set(spec.sort_order),
                enabled: Set(spec.enabled),
                creater_id: Set(operator_id as i64),
                create_ms: Set(now),
                updater_id: Set(operator_id as i64),
                update_ms: Set(now),
            };
            adm_dashboard_widget::Entity::insert(active)
                .exec(&tx)
                .await
                .map_err(DaoError::parse_db_err)?;
        }

        commit_transaction(tx).await?;
        Self::get_config(role_id)
            .await?
            .ok_or_else(|| SvcError::NotFound("保存后未找到首页配置".to_string()))
    }

    /// # 删除角色配置
    ///
    /// 只允许删角色配置；全局兜底模板不允许删除，避免出现「没有任何首页」。
    pub async fn delete_config(role_id: Option<i64>, _operator_id: u64) -> Result<bool, SvcError> {
        let role_id = role_id.ok_or_else(|| invalid("全局兜底配置不允许删除".to_string()))?;
        let db = get_db_conn()?;
        let result = adm_dashboard::Entity::delete_many()
            .filter(adm_dashboard::Column::RoleId.eq(role_id))
            .exec(db.as_ref())
            .await
            .map_err(DaoError::parse_db_err)?;
        Ok(result.rows_affected > 0)
    }

    /// # widget 类型目录
    pub async fn widget_types() -> Result<Vec<AdmWidgetTypeVo>, SvcError> {
        let db = get_db_conn()?;
        let rows = adm_widget_type::Entity::find()
            .order_by_asc(adm_widget_type::Column::SortOrder)
            .order_by_asc(adm_widget_type::Column::Id)
            .all(db.as_ref())
            .await
            .map_err(DaoError::parse_db_err)?;
        Ok(rows
            .into_iter()
            .map(|row| AdmWidgetTypeVo {
                id: row.id as u64,
                code: row.code,
                name: row.name,
                default_service: row.default_service,
                default_endpoint: row.default_endpoint,
                description: row.description,
                default_params: row
                    .default_params
                    .as_deref()
                    .and_then(|text| serde_json::from_str::<Value>(text).ok()),
                default_perm_urn: row.default_perm_urn,
                default_scope_aware: row.default_scope_aware,
                sort_order: row.sort_order,
                enabled: row.enabled,
            })
            .collect())
    }

    /// # widget 逻辑端点目录（管理页下拉与保存校验共用）
    ///
    /// 按服务分组返回；包含已停用占位项，管理页只允许选择 `enabled=true`。
    pub async fn endpoints() -> Result<Vec<AdmWidgetServiceVo>, SvcError> {
        let db = get_db_conn()?;
        let rows = adm_widget_endpoint::Entity::find()
            .order_by_asc(adm_widget_endpoint::Column::SortOrder)
            .order_by_asc(adm_widget_endpoint::Column::Id)
            .all(db.as_ref())
            .await
            .map_err(DaoError::parse_db_err)?;

        let mut groups: Vec<AdmWidgetServiceVo> = Vec::new();
        for row in rows {
            let index = match groups.iter().position(|group| group.code == row.service) {
                Some(index) => index,
                None => {
                    groups.push(AdmWidgetServiceVo {
                        code: row.service.clone(),
                        name: service_name(&row.service).to_string(),
                        enabled: false,
                        note: None,
                        endpoints: Vec::new(),
                    });
                    groups.len() - 1
                }
            };
            let group = &mut groups[index];
            group.enabled = group.enabled || row.enabled;
            if let Some(note) = &row.note {
                group.note = Some(match group.note.take() {
                    Some(existing) if existing != *note => format!("{existing}；{note}"),
                    Some(existing) => existing,
                    None => note.clone(),
                });
            }
            group.endpoints.push(AdmWidgetEndpointVo {
                key: row.endpoint,
                name: row.name,
                method: row.method,
                params_hint: row.params_hint,
                enabled: row.enabled,
                note: row.note,
            });
        }
        Ok(groups)
    }

    /// 判断某个逻辑端点是否在目录且启用（供 adm 域数据端点自检）
    pub async fn endpoint_enabled(service: &str, endpoint: &str) -> Result<bool, SvcError> {
        let db = get_db_conn()?;
        let row = adm_widget_endpoint::Entity::find()
            .filter(adm_widget_endpoint::Column::Service.eq(service))
            .filter(adm_widget_endpoint::Column::Endpoint.eq(endpoint))
            .one(db.as_ref())
            .await
            .map_err(DaoError::parse_db_err)?;
        Ok(row.map(|item| item.enabled).unwrap_or(false))
    }
}

/// 保存时的内部规格
#[derive(Debug, Clone)]
struct WidgetSpec {
    widget_type: String,
    title: String,
    service: String,
    endpoint: String,
    params: Value,
    perm_urn: Option<String>,
    scope_aware: bool,
    sort_order: i32,
    enabled: bool,
}

/// 服务展示名；地址由 gatex 按 `/{code}-svr` 解析，这里只做展示。
fn service_name(code: &str) -> &'static str {
    match code {
        "adm" => "adm-svr 账号服务",
        "oss" => "oss-svr 组织服务",
        "msg" => "msg-svr 消息服务",
        "jobx" => "jobx-svr 任务服务",
        _ => "其它服务",
    }
}

fn parse_optional_id(raw: Option<&str>, field: &str) -> Result<Option<i64>, SvcError> {
    match raw.map(str::trim).filter(|text| !text.is_empty()) {
        None => Ok(None),
        Some("global") => Ok(None),
        Some(text) => text
            .parse::<i64>()
            .map(Some)
            .map_err(|_| invalid(format!("{field} 不是合法 ID：{text}"))),
    }
}

fn invalid(message: String) -> SvcError {
    let mut error = validator::ValidationError::new("dashboard_config");
    error.message = Some(std::borrow::Cow::Owned(message));
    SvcError::Validation(error)
}

/// 供 `/me` 直接复用：加载 scopes + 生效配置
pub async fn me_dashboard(
    roles: &[adm_role::Model],
    perm_urns: &[String],
) -> Result<(Vec<AdmRoleScopeVo>, Option<AdmDashboardVo>), SvcError> {
    let ctx = AdmDashboardUserContext {
        user_id: 0,
        user_name: String::new(),
        roles: roles.to_vec(),
        perm_urns: perm_urns.to_vec(),
        menus: Vec::new(),
        scopes: Vec::new(),
    };
    let scopes = {
        let db = get_db_conn()?;
        let role_ids: Vec<i64> = roles.iter().map(|role| role.id).collect();
        AdmDashboardSvc::load_scopes(&role_ids, roles, db.as_ref()).await?
    };
    let dashboard = AdmDashboardSvc::effective_dashboard(&ctx).await?;
    Ok((scopes, dashboard))
}

/// adm 域 widget 端点的统一执行入口。
///
/// 这里没有并行 fan-out、熔断、缓存或 token 转发：adm-svr 只回答自己的
/// 数据；跨服务取数与降级由前端 + gatex 完成。失败也返回 200 + error 信封，
/// 让前端只降级这一张卡片。
pub async fn execute_adm_widget(
    ctx: &AdmDashboardUserContext,
    endpoint: &str,
    req: &AdmWidgetDataReq,
) -> AdmWidgetDataVo {
    let started = now_ms();
    match super::AdmWidgetDataSvc::exec(endpoint, &req.params, ctx.user_id).await {
        Ok(data) => AdmWidgetDataVo {
            widget_type: widget_type_of(endpoint).to_string(),
            title: req
                .title
                .clone()
                .filter(|text| !text.trim().is_empty())
                .unwrap_or_else(|| endpoint.to_string()),
            status: "ok".to_string(),
            data: Some(data),
            error: None,
            generated_ms: now_ms().max(started),
        },
        Err(error) => AdmWidgetDataVo {
            widget_type: widget_type_of(endpoint).to_string(),
            title: req
                .title
                .clone()
                .filter(|text| !text.trim().is_empty())
                .unwrap_or_else(|| endpoint.to_string()),
            status: "error".to_string(),
            data: None,
            error: Some(match error {
                SvcError::NotFound(message) => message,
                other => other.to_string(),
            }),
            generated_ms: now_ms().max(started),
        },
    }
}

/// 端点 → 渲染器类型；新增 adm 端点时在这里登记即可。
pub fn widget_type_of(endpoint: &str) -> &'static str {
    match endpoint {
        "stats.count" => "kpi",
        "stats.trend" => "trend",
        "stats.todos" => "todo",
        "logs.recent" => "recent_logs",
        "menu.shortcuts" => "shortcuts",
        "auth.my_permissions" => "my_permissions",
        _ => "unknown",
    }
}
