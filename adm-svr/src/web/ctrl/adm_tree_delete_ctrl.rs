//! # 树形删除预检控制器
//!
//! `GET /adm/{entity}/delete-preview/{id}`，返回该节点将级联删除的子孙数量、
//! 名称清单，以及是否被外部引用阻塞。前端在树形删除确认框里展示这些信息，
//! 用户确认后才调用原有删除接口。

use crate::svc::{tree_delete_preview, TreeDeletePreview};
use axum::extract::Path;
use axum::response::Json;
use robotech::api::{Ro, U64};
use robotech::web::CtrlError;

async fn preview(
    prefix: &str,
    id: U64,
) -> Result<Json<Ro<TreeDeletePreview>>, CtrlError> {
    let data = tree_delete_preview(prefix, id.value()).await?;
    Ok(Json(Ro::success("查询成功".to_string()).extra(Some(data))))
}

/// # 菜单删除预检
pub async fn menu_preview(Path(id): Path<U64>) -> Result<Json<Ro<TreeDeletePreview>>, CtrlError> {
    preview("menu", id).await
}

/// # 角色分组删除预检
pub async fn role_group_preview(
    Path(id): Path<U64>,
) -> Result<Json<Ro<TreeDeletePreview>>, CtrlError> {
    preview("role-group", id).await
}

/// # 权限分组删除预检
pub async fn perm_group_preview(
    Path(id): Path<U64>,
) -> Result<Json<Ro<TreeDeletePreview>>, CtrlError> {
    preview("perm-group", id).await
}

/// # 组织删除预检
pub async fn org_preview(Path(id): Path<U64>) -> Result<Json<Ro<TreeDeletePreview>>, CtrlError> {
    preview("org", id).await
}
