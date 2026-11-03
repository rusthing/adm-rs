//! # 统一排序控制器
//!
//! 排序值由服务端维护，前端只提交「同组完整 id 顺序」。
//! 路径固定为 `POST /adm/{prefix}/reorder`，`prefix` 必须是单段，
//! 避免 axum 0.8 的 `{prefix}` 与通配段组合导致启动 panic。
//!
//! 请求体同时接受两种形式：裸数组 `["id1","id2"]` 或 `{ "ids": [...] }`。

use crate::svc::{reorder_flat, reorder_tree};
use crate::web::auth::USER_ID_HEADER_NAME;
use axum::debug_handler;
use axum::http::HeaderMap;
use axum::response::Json;
use robotech::api::{Ro, U64};
use robotech::web::CtrlError;
use serde::Deserialize;

/// # 重排请求体
#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum AdmReorderBody {
    /// 裸 id 数组
    Ids(Vec<U64>),
    /// `{ "ids": [...] }`
    Wrapped { ids: Vec<U64> },
}

impl AdmReorderBody {
    fn into_ids(self) -> Vec<u64> {
        match self {
            Self::Ids(ids) | Self::Wrapped { ids } => {
                ids.into_iter().map(|id| id.value()).collect()
            }
        }
    }
}

fn require_user_id(headers: &HeaderMap) -> Result<u64, CtrlError> {
    headers
        .get(USER_ID_HEADER_NAME)
        .and_then(|value| value.to_str().ok())
        .and_then(|text| text.parse::<u64>().ok())
        .ok_or_else(|| CtrlError::Runtime(anyhow::anyhow!("缺少 X-User-Id 请求头")))
}

async fn flat_response(
    table: &str,
    group_col: Option<&str>,
    headers: HeaderMap,
    body: AdmReorderBody,
) -> Result<Json<Ro<u64>>, CtrlError> {
    let operator_id = require_user_id(&headers)?;
    let affected = reorder_flat(table, group_col, body.into_ids(), operator_id).await?;
    Ok(Json(
        Ro::success("重排成功".to_string()).extra(Some(affected)),
    ))
}

async fn tree_response(
    table: &str,
    scope_col: Option<&str>,
    headers: HeaderMap,
    body: AdmReorderBody,
) -> Result<Json<Ro<u64>>, CtrlError> {
    let operator_id = require_user_id(&headers)?;
    let affected = reorder_tree(table, scope_col, body.into_ids(), operator_id).await?;
    Ok(Json(
        Ro::success("重排成功".to_string()).extra(Some(affected)),
    ))
}

/// # 领域重排
#[utoipa::path(
    post,
    path = "/adm/realm/reorder",
    request_body = Vec<U64>,
    params(("X-User-Id" = String, Header, description = "当前用户 ID")),
    responses((status = OK, body = Ro<u64>))
)]
#[debug_handler]
#[allow(clippy::result_large_err)]
pub async fn reorder_realm(
    headers: HeaderMap,
    Json(body): Json<AdmReorderBody>,
) -> Result<Json<Ro<u64>>, CtrlError> {
    flat_response("adm_realm", None, headers, body).await
}

/// # 应用重排（按领域分组）
#[utoipa::path(
    post,
    path = "/adm/app/reorder",
    request_body = Vec<U64>,
    params(("X-User-Id" = String, Header, description = "当前用户 ID")),
    responses((status = OK, body = Ro<u64>))
)]
#[debug_handler]
#[allow(clippy::result_large_err)]
pub async fn reorder_app(
    headers: HeaderMap,
    Json(body): Json<AdmReorderBody>,
) -> Result<Json<Ro<u64>>, CtrlError> {
    flat_response("adm_app", Some("realm_id"), headers, body).await
}

/// # 角色重排（按角色分组）
#[utoipa::path(
    post,
    path = "/adm/role/reorder",
    request_body = Vec<U64>,
    params(("X-User-Id" = String, Header, description = "当前用户 ID")),
    responses((status = OK, body = Ro<u64>))
)]
#[debug_handler]
#[allow(clippy::result_large_err)]
pub async fn reorder_role(
    headers: HeaderMap,
    Json(body): Json<AdmReorderBody>,
) -> Result<Json<Ro<u64>>, CtrlError> {
    flat_response("adm_role", Some("group_id"), headers, body).await
}

/// # 权限重排（按权限分组）
#[utoipa::path(
    post,
    path = "/adm/perm/reorder",
    request_body = Vec<U64>,
    params(("X-User-Id" = String, Header, description = "当前用户 ID")),
    responses((status = OK, body = Ro<u64>))
)]
#[debug_handler]
#[allow(clippy::result_large_err)]
pub async fn reorder_perm(
    headers: HeaderMap,
    Json(body): Json<AdmReorderBody>,
) -> Result<Json<Ro<u64>>, CtrlError> {
    flat_response("adm_perm", Some("group_id"), headers, body).await
}

/// # 操作类型重排
#[utoipa::path(
    post,
    path = "/adm/op-type/reorder",
    request_body = Vec<U64>,
    params(("X-User-Id" = String, Header, description = "当前用户 ID")),
    responses((status = OK, body = Ro<u64>))
)]
#[debug_handler]
#[allow(clippy::result_large_err)]
pub async fn reorder_op_type(
    headers: HeaderMap,
    Json(body): Json<AdmReorderBody>,
) -> Result<Json<Ro<u64>>, CtrlError> {
    flat_response("adm_op_type", None, headers, body).await
}

/// # 组织类型重排
#[utoipa::path(
    post,
    path = "/adm/org-type/reorder",
    request_body = Vec<U64>,
    params(("X-User-Id" = String, Header, description = "当前用户 ID")),
    responses((status = OK, body = Ro<u64>))
)]
#[debug_handler]
#[allow(clippy::result_large_err)]
pub async fn reorder_org_type(
    headers: HeaderMap,
    Json(body): Json<AdmReorderBody>,
) -> Result<Json<Ro<u64>>, CtrlError> {
    flat_response("adm_org_type", None, headers, body).await
}

/// # 人员编码类型重排
#[utoipa::path(
    post,
    path = "/adm/person-code-type/reorder",
    request_body = Vec<U64>,
    params(("X-User-Id" = String, Header, description = "当前用户 ID")),
    responses((status = OK, body = Ro<u64>))
)]
#[debug_handler]
#[allow(clippy::result_large_err)]
pub async fn reorder_person_code_type(
    headers: HeaderMap,
    Json(body): Json<AdmReorderBody>,
) -> Result<Json<Ro<u64>>, CtrlError> {
    flat_response("adm_person_code_type", None, headers, body).await
}

/// # 菜单重排（按应用 + 父节点）
#[utoipa::path(
    post,
    path = "/adm/menu/reorder",
    request_body = Vec<U64>,
    params(("X-User-Id" = String, Header, description = "当前用户 ID")),
    responses((status = OK, body = Ro<u64>))
)]
#[debug_handler]
#[allow(clippy::result_large_err)]
pub async fn reorder_menu(
    headers: HeaderMap,
    Json(body): Json<AdmReorderBody>,
) -> Result<Json<Ro<u64>>, CtrlError> {
    tree_response("adm_menu", Some("app_id"), headers, body).await
}

/// # 角色分组重排（按领域 + 父节点）
#[utoipa::path(
    post,
    path = "/adm/role-group/reorder",
    request_body = Vec<U64>,
    params(("X-User-Id" = String, Header, description = "当前用户 ID")),
    responses((status = OK, body = Ro<u64>))
)]
#[debug_handler]
#[allow(clippy::result_large_err)]
pub async fn reorder_role_group(
    headers: HeaderMap,
    Json(body): Json<AdmReorderBody>,
) -> Result<Json<Ro<u64>>, CtrlError> {
    tree_response("adm_role_group", Some("realm_id"), headers, body).await
}

/// # 权限分组重排（按领域 + 父节点）
#[utoipa::path(
    post,
    path = "/adm/perm-group/reorder",
    request_body = Vec<U64>,
    params(("X-User-Id" = String, Header, description = "当前用户 ID")),
    responses((status = OK, body = Ro<u64>))
)]
#[debug_handler]
#[allow(clippy::result_large_err)]
pub async fn reorder_perm_group(
    headers: HeaderMap,
    Json(body): Json<AdmReorderBody>,
) -> Result<Json<Ro<u64>>, CtrlError> {
    tree_response("adm_perm_group", Some("realm_id"), headers, body).await
}

/// # 组织重排（按父节点，全局一棵树）
#[utoipa::path(
    post,
    path = "/adm/org/reorder",
    request_body = Vec<U64>,
    params(("X-User-Id" = String, Header, description = "当前用户 ID")),
    responses((status = OK, body = Ro<u64>))
)]
#[debug_handler]
#[allow(clippy::result_large_err)]
pub async fn reorder_org(
    headers: HeaderMap,
    Json(body): Json<AdmReorderBody>,
) -> Result<Json<Ro<u64>>, CtrlError> {
    tree_response("adm_org", None, headers, body).await
}
