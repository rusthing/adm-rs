pub mod config;
pub mod dao;
pub mod svc;
pub mod utils;
pub mod web;

/// # 带鉴权的 CRUD 路由
///
/// `robotech` 的 `#[router(crud)]` 不支持挂 `.layer(...)`，而 adm 的业务接口
/// 又必须统一校验 Bearer 令牌。这里用宏复制它的 23 条路由，并在整棵路由树上
/// 挂 [`crate::web::auth::require_auth`]：中间件校验通过后把令牌里的用户 ID
/// 写入 `X-User-Id`，控制器不需要改动。
///
/// **框架里 `#[router(crud)]` 加路由时这里要跟着加**——两边是手工同步的，
/// 少一条就是「接口 404、编译全绿」。
///
/// ## 用法
/// ```ignore
/// adm_crud_router!("/adm/user", adm_user_ctrl);
/// ```
///
/// 不在本宏里的路由（登录、登出、`/me`、改密、reset-password）由各自处理器
/// 手动校验令牌。
#[macro_export]
macro_rules! adm_crud_router {
    ($prefix:literal, $ctrl_module:ident) => {
        #[allow(unused_imports)]
        use crate::web::ctrl::$ctrl_module::*;
        use axum::{
            routing::{delete, get, post, put},
            Router,
        };
        use linkme::distributed_slice;
        use robotech::web::ROUTER_SLICE;

        #[distributed_slice(ROUTER_SLICE)]
        static BUILD_ROUTER_FN: fn() -> Router = build_router;

        fn build_router() -> Router {
            Router::new()
                .route(concat!($prefix, "/list"), get(list_by_query_dto))
                .route(concat!($prefix, "/list-ex"), get(list_ex_by_query_dto))
                .route(concat!($prefix, "/page"), get(page_by_query_dto))
                .route(concat!($prefix, "/page-ex"), get(page_ex_by_query_dto))
                .route(concat!($prefix, "/ex"), get(get_ex_by_query_dto))
                .route(concat!($prefix, "/ex/{id}"), get(get_ex_by_id))
                .route(concat!($prefix, "/search"), get(search_by_condition))
                .route(concat!($prefix, "/search/ex"), get(search_ex_by_condition))
                .route(concat!($prefix, "/search/ex/{id}"), get(search_ex_by_id))
                .route(concat!($prefix, "/search/list"), get(search_list))
                .route(concat!($prefix, "/search/list-ex"), get(search_list_ex))
                .route(concat!($prefix, "/search/page"), get(search_page))
                .route(concat!($prefix, "/search/page-ex"), get(search_page_ex))
                .route(concat!($prefix, "/search/{id}"), get(search_by_id))
                .route(concat!($prefix, "/save"), post(save))
                .route(concat!($prefix, "/upsert"), post(upsert))
                .route(concat!($prefix, "/sync"), post(sync))
                .route($prefix, post(add))
                .route($prefix, put(modify))
                .route($prefix, get(get_by_query_dto))
                .route($prefix, delete(del_by_query_dto))
                .route(concat!($prefix, "/{id}"), delete(del_by_id))
                .route(concat!($prefix, "/{id}"), get(get_by_id))
                .layer(axum::middleware::from_fn(
                    crate::web::auth::require_auth,
                ))
        }
    };
}

pub use adm_api::cst;
pub use adm_api::dic;
pub use adm_api::dto;
pub use adm_api::mo;
pub use adm_api::vo;
