//! # 用户口令控制器
//!
//! 一个手写接口：`POST /adm/user/{id}/reset-password`，把口令换成配置里的默认值。
//!
//! 与 [`adm_user_ctrl`](crate::web::ctrl::adm_user_ctrl)（CRUD）分开，是因为
//! `#[router(crud)]` 与 `#[router(routes ...)]` 各自生成一棵路由树、各自按**结构体名**
//! 推导 ctrl 模块，一个 ctrl 模块只能被一棵树使用。

use crate::svc::AdmUserSvc;
use axum::debug_handler;
use axum::extract::Path;
use axum::response::Json;
use robotech::api::{Ro, U64};
use robotech::macros::log_call;
use robotech::web::CtrlError;

/// # 重置用户口令
///
/// 不接收新口令，只把库里换成一个已知的默认值（`[adm] default-password`），
/// 由用户下次登录时自行修改 —— 这样管理员不需要知道用户的新口令。
///
/// ## 路径参数
/// * `id` - 用户ID
///
/// ## 返回值
/// * `Ro<()>` - 重置成功
#[utoipa::path(
    post,
    path = "/adm/user/{id}/reset-password",
    params(("id" = u64, Path, description = "用户ID")),
    responses((status = OK, description = "口令已重置为默认值"))
)]
#[debug_handler]
#[log_call]
pub async fn reset_password(Path(id): Path<U64>) -> Result<Json<Ro<()>>, CtrlError> {
    let ro = AdmUserSvc::reset_password(id).await?;
    Ok(Json(ro))
}
