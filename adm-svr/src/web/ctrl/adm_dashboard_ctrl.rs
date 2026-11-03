//! # 首页配置与 adm 域 widget 数据控制器
//!
//! 最终架构下 adm-svr 只提供自己的 API：
//! - 角色 / 全局首页配置的读取与管理
//! - adm 自身域的 widget 数据端点
//!
//! **不做跨服务聚合、不做 token 透传。** 鉴权、路由、限流与降级由 gatex
//! 网关负责；这里只按项目既有约定从 `X-User-Id` 读取当前用户。

use crate::dto::{AdmDashboardSaveDto, AdmWidgetDataReq};
use crate::svc::{AdmDashboardSvc, execute_adm_widget, widget_type_of};
use crate::vo::{
    AdmDashboardVo, AdmWidgetDataVo, AdmWidgetServiceVo, AdmWidgetTypeVo,
};
use crate::web::auth::USER_ID_HEADER_NAME;
use axum::debug_handler;
use axum::extract::{Path, Query};
use axum::http::HeaderMap;
use axum::response::Json;
use robotech::api::Ro;
use robotech::web::CtrlError;
use serde::Deserialize;

/// # 配置查询参数
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdmDashboardConfigQuery {
    /// 角色 ID；不传 / `global` 表示全局兜底模板
    pub role_id: Option<String>,
}

/// 按项目既有约定读取 `X-User-Id`（由网关 / 鉴权层注入）
fn require_user_id(headers: &HeaderMap) -> Result<u64, CtrlError> {
    headers
        .get(USER_ID_HEADER_NAME)
        .and_then(|value| value.to_str().ok())
        .and_then(|text| text.parse::<u64>().ok())
        .ok_or_else(|| CtrlError::Runtime(anyhow::anyhow!("缺少 X-User-Id 请求头")))
}

/// # 当前用户生效的首页配置
///
/// 按角色优先级取第一份可用配置，未命中回落全局模板。前端据此拿到
/// widget 列表，再经 gatex 并行直连各服务取数。
#[utoipa::path(
    get,
    path = "/adm/dashboard/effective",
    params(("X-User-Id" = String, Header, description = "当前用户 ID")),
    responses((status = OK, body = Ro<AdmDashboardVo>))
)]
#[debug_handler]
#[allow(clippy::result_large_err)]
pub async fn effective(
    headers: HeaderMap,
) -> Result<Json<Ro<Option<AdmDashboardVo>>>, CtrlError> {
    let user_id = require_user_id(&headers)?;
    let dashboard = AdmDashboardSvc::effective_config(user_id).await?;
    Ok(Json(
        Ro::success("获取生效首页配置成功".to_string()).extra(Some(dashboard)),
    ))
}

/// # 列出全部首页配置（管理页）
#[utoipa::path(
    get,
    path = "/adm/dashboard/config/list",
    params(("X-User-Id" = String, Header, description = "当前用户 ID")),
    responses((status = OK, body = Ro<Vec<AdmDashboardVo>>))
)]
#[debug_handler]
#[allow(clippy::result_large_err)]
pub async fn list_configs(
    _headers: HeaderMap,
) -> Result<Json<Ro<Vec<AdmDashboardVo>>>, CtrlError> {
    let configs = AdmDashboardSvc::list_configs().await?;
    Ok(Json(
        Ro::success("获取首页配置列表成功".to_string()).extra(Some(configs)),
    ))
}

/// # 读取单份首页配置
///
/// `roleId` 不传表示全局兜底模板；角色没有配置时 `extra` 为 null。
#[utoipa::path(
    get,
    path = "/adm/dashboard/config",
    params(
        ("roleId" = Option<String>, Query, description = "角色 ID；缺省为全局模板"),
        ("X-User-Id" = String, Header, description = "当前用户 ID")
    ),
    responses((status = OK, body = Ro<AdmDashboardVo>))
)]
#[debug_handler]
#[allow(clippy::result_large_err)]
pub async fn get_config(
    Query(query): Query<AdmDashboardConfigQuery>,
) -> Result<Json<Ro<Option<AdmDashboardVo>>>, CtrlError> {
    let role_id = parse_role_id(query.role_id.as_deref())?;
    let config = AdmDashboardSvc::get_config(role_id).await?;
    Ok(Json(
        Ro::success("获取首页配置成功".to_string()).extra(Some(config)),
    ))
}

/// # 保存首页配置（整份替换）
#[utoipa::path(
    put,
    path = "/adm/dashboard/config",
    request_body = AdmDashboardSaveDto,
    params(("X-User-Id" = String, Header, description = "当前用户 ID")),
    responses((status = OK, body = Ro<AdmDashboardVo>))
)]
#[debug_handler]
#[allow(clippy::result_large_err)]
pub async fn save_config(
    headers: HeaderMap,
    Json(dto): Json<AdmDashboardSaveDto>,
) -> Result<Json<Ro<AdmDashboardVo>>, CtrlError> {
    let operator_id = require_user_id(&headers)?;
    let config = AdmDashboardSvc::save_config(dto, operator_id).await?;
    Ok(Json(
        Ro::success("保存首页配置成功".to_string()).extra(Some(config)),
    ))
}

/// # 删除角色首页配置
///
/// 全局兜底模板不允许删除，回落目标始终存在。
#[utoipa::path(
    delete,
    path = "/adm/dashboard/config",
    params(
        ("roleId" = String, Query, description = "角色 ID"),
        ("X-User-Id" = String, Header, description = "当前用户 ID")
    ),
    responses((status = OK, body = Ro<bool>))
)]
#[debug_handler]
#[allow(clippy::result_large_err)]
pub async fn delete_config(
    headers: HeaderMap,
    Query(query): Query<AdmDashboardConfigQuery>,
) -> Result<Json<Ro<bool>>, CtrlError> {
    let operator_id = require_user_id(&headers)?;
    let role_id = parse_role_id(query.role_id.as_deref())?;
    let deleted = AdmDashboardSvc::delete_config(role_id, operator_id).await?;
    Ok(Json(
        Ro::success("删除首页配置成功".to_string()).extra(Some(deleted)),
    ))
}

/// # widget 类型目录
#[utoipa::path(
    get,
    path = "/adm/dashboard/widget-type",
    params(("X-User-Id" = String, Header, description = "当前用户 ID")),
    responses((status = OK, body = Ro<Vec<AdmWidgetTypeVo>>))
)]
#[debug_handler]
#[allow(clippy::result_large_err)]
pub async fn widget_types(
    _headers: HeaderMap,
) -> Result<Json<Ro<Vec<AdmWidgetTypeVo>>>, CtrlError> {
    let types = AdmDashboardSvc::widget_types().await?;
    Ok(Json(
        Ro::success("获取 widget 类型成功".to_string()).extra(Some(types)),
    ))
}

/// # widget 逻辑端点目录
///
/// 只返回 `service` / `endpoint` 逻辑键与展示信息，不含任何 URL、凭据或
/// 健康状态；管理页只允许选择其中启用的项。真实地址由 gatex / Consul 解析。
#[utoipa::path(
    get,
    path = "/adm/dashboard/endpoints",
    params(("X-User-Id" = String, Header, description = "当前用户 ID")),
    responses((status = OK, body = Ro<Vec<AdmWidgetServiceVo>>))
)]
#[debug_handler]
#[allow(clippy::result_large_err)]
pub async fn endpoints(
    _headers: HeaderMap,
) -> Result<Json<Ro<Vec<AdmWidgetServiceVo>>>, CtrlError> {
    let services = AdmDashboardSvc::endpoints().await?;
    Ok(Json(
        Ro::success("获取 widget 端点目录成功".to_string()).extra(Some(services)),
    ))
}

/// # adm 域 widget 数据端点
///
/// 只回答 adm 自己的账号域数据；`X-User-Id` 决定可见范围。失败也返回
/// HTTP 200 + `status=error` 的统一信封，前端只降级这一张卡片。
#[utoipa::path(
    post,
    path = "/adm/widget-data/{endpoint}",
    params(
        ("endpoint" = String, Path, description = "逻辑端点键，如 stats.count"),
        ("X-User-Id" = String, Header, description = "当前用户 ID")
    ),
    request_body = AdmWidgetDataReq,
    responses((status = OK, body = Ro<AdmWidgetDataVo>))
)]
#[debug_handler]
#[allow(clippy::result_large_err)]
pub async fn widget_data(
    headers: HeaderMap,
    Path(endpoint): Path<String>,
    Json(body): Json<AdmWidgetDataReq>,
) -> Result<Json<Ro<AdmWidgetDataVo>>, CtrlError> {
    let user_id = require_user_id(&headers)?;
    let ctx = AdmDashboardSvc::load_user_context(user_id).await?;
    let envelope = if AdmDashboardSvc::endpoint_enabled("adm", &endpoint).await? {
        execute_adm_widget(&ctx, &endpoint, &body).await
    } else {
        AdmWidgetDataVo {
            widget_type: widget_type_of(&endpoint).to_string(),
            title: body.title.clone().unwrap_or_else(|| endpoint.clone()),
            status: "error".to_string(),
            data: None,
            error: Some(format!("端点 `adm/{endpoint}` 未登记或已停用")),
            generated_ms: wheel_rs::time_utils::now_ms(),
        }
    };
    Ok(Json(
        Ro::success("获取 widget 数据成功".to_string()).extra(Some(envelope)),
    ))
}

/// `roleId` 解析：缺省 / `global` → 全局模板
fn parse_role_id(raw: Option<&str>) -> Result<Option<i64>, CtrlError> {
    match raw.map(str::trim).filter(|text| !text.is_empty()) {
        None => Ok(None),
        Some("global") => Ok(None),
        Some(text) => text
            .parse::<i64>()
            .map(Some)
            .map_err(|_| CtrlError::Runtime(anyhow::anyhow!("roleId 不是合法 ID：{text}"))),
    }
}
