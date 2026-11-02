//! # 用户口令管理控制器
//!
//! README 里约定的 `POST /adm/user/{id}/reset-password`：
//! 把指定用户的登录口令重置为 `[adm] default-password`，并标记为初始口令。
//!
//! 这条接口不在统一中间件覆盖的 CRUD 路由树里，所以在处理器内自行校验
//! `Authorization: Bearer`，再取操作者 ID 写审计列。

use crate::cst::ADM_CODE_TOKEN_INVALID;
use crate::svc::AdmUserSvc;
use crate::web::auth::verify_bearer;
use axum::debug_handler;
use axum::extract::Path;
use axum::http::HeaderMap;
use axum::response::Json;
use robotech::api::Ro;
use robotech::web::CtrlError;

/// # 重置用户登录口令
///
/// ## 路径参数
/// * `id` - 目标用户 ID
///
/// ## 请求头
/// * `Authorization` - `Bearer <管理员令牌>`
///
/// ## 返回值
/// * `Ro<()>` - 重置成功
/// * `ADM00005` - 令牌无效
#[utoipa::path(
    post,
    path = "/adm/user/{id}/reset-password",
    params(
        ("id" = u64, Path, description = "用户 ID"),
        ("Authorization" = String, Header, description = "Bearer <token>")
    ),
    responses((status = OK, description = "口令重置成功"))
)]
#[debug_handler]
#[allow(clippy::result_large_err)]
pub async fn reset_password(
    headers: HeaderMap,
    Path(id): Path<u64>,
) -> Result<Json<Ro<()>>, CtrlError> {
    match verify_bearer(&headers).await {
        Ok(operator_id) => Ok(Json(AdmUserSvc::reset_password(id, operator_id).await?)),
        Err(detail) => Ok(Json(
            Ro::warn("未登录或令牌已失效".to_string())
                .code(Some(ADM_CODE_TOKEN_INVALID.to_string()))
                .detail(Some(detail)),
        )),
    }
}
