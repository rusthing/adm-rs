//! # 统一排序路由
//!
//! 统一使用 `POST /adm/{prefix}/reorder`，`prefix` 单段，
//! 与各实体 CRUD 路由的 `/{id}` 只在 POST 方法上互补，不冲突。
//! 树形实体另有 `GET /adm/{prefix}/delete-preview/{id}`，返回级联删除预检；
//! 路径多一段，与 CRUD 的 `/{id}` 不冲突。
//! 整棵路由挂 Bearer 身份认证中间件（与 CRUD 路由一致）。

use crate::web::ctrl::adm_sort_ctrl::*;
use crate::web::ctrl::adm_tree_delete_ctrl::*;
use axum::Router;
use axum::middleware::from_fn;
use axum::routing::{get, post};
use linkme::distributed_slice;
use robotech::web::ROUTER_SLICE;

#[distributed_slice(ROUTER_SLICE)]
static BUILD_SORT_ROUTER_FN: fn() -> Router = build_sort_router;

fn build_sort_router() -> Router {
    Router::new()
        .route("/adm/realm/reorder", post(reorder_realm))
        .route("/adm/app/reorder", post(reorder_app))
        .route("/adm/role/reorder", post(reorder_role))
        .route("/adm/perm/reorder", post(reorder_perm))
        .route("/adm/op-type/reorder", post(reorder_op_type))
        .route("/adm/org-type/reorder", post(reorder_org_type))
        .route(
            "/adm/person-code-type/reorder",
            post(reorder_person_code_type),
        )
        .route("/adm/menu/reorder", post(reorder_menu))
        .route("/adm/role-group/reorder", post(reorder_role_group))
        .route("/adm/perm-group/reorder", post(reorder_perm_group))
        .route("/adm/org/reorder", post(reorder_org))
        .route("/adm/menu/delete-preview/{id}", get(menu_preview))
        .route("/adm/role-group/delete-preview/{id}", get(role_group_preview))
        .route(
            "/adm/perm-group/delete-preview/{id}",
            get(perm_group_preview),
        )
        .route("/adm/org/delete-preview/{id}", get(org_preview))
        .layer(from_fn(crate::web::auth::require_auth))
}
