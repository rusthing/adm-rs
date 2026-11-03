//! # 首页配置与 adm 域 widget 数据路由
//!
//! adm-svr 只暴露自己的 API；不挂 `require_auth`，也不做跨服务转发。
//! 用户身份沿用项目既有的 `X-User-Id` 请求头，由 gatex / 鉴权层注入。
//! 每个服务各自暴露 `/xxx/widget-data/{endpoint}`，前端经网关并行直连。

use crate::web::ctrl::adm_dashboard_ctrl::*;
use axum::Router;
use axum::routing::{delete, get, post, put};
use linkme::distributed_slice;
use robotech::web::ROUTER_SLICE;

/// 注册到框架路由表
#[distributed_slice(ROUTER_SLICE)]
static BUILD_DASHBOARD_ROUTER_FN: fn() -> Router = build_dashboard_router;

fn build_dashboard_router() -> Router {
    Router::new()
        .route("/adm/dashboard/effective", get(effective))
        .route("/adm/dashboard/config/list", get(list_configs))
        .route("/adm/dashboard/config", get(get_config))
        .route("/adm/dashboard/config", put(save_config))
        .route("/adm/dashboard/config", delete(delete_config))
        .route("/adm/dashboard/widget-type", get(widget_types))
        .route("/adm/dashboard/endpoints", get(endpoints))
        .route("/adm/widget-data/{endpoint}", post(widget_data))
}
