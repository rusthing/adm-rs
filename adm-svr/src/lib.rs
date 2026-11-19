pub mod config;
pub mod dao;
pub mod svc;
pub mod utils;
pub mod web;

/// # 带鉴权的 CRUD 路由
///
/// `robotech` 的 `#[router(crud)]` 不支持挂 `.layer(...)`，而 adm 的业务接口
/// 又必须统一校验 Bearer 令牌。这里用宏复制它的 23 条路由：除 `/sync` 外的
/// 业务路由挂 [`crate::web::auth::require_auth`]，中间件校验通过后把令牌里的
/// 用户 ID 写入 `X-User-Id`，控制器不需要改动。
///
/// `/sync` **不挂用户鉴权**：它是给 syn 做单向复制的内部接口，审计字段全部
/// 来自请求体（`createrId` / `createMs` / `updaterId` / `updateMs`），本来就不
/// 依赖当前用户；框架生成的 `sync` 处理器也不读 `X-User-Id`。CDC 删除同理，
/// 走 `DELETE {prefix}/sync/{id}`，复用 `del_by_id`，也不要求用户令牌。
/// 把它放进鉴权层只会逼同步任务长期持有用户 Bearer token，与框架里 `dtw`
/// 等服务的 `/sync`、`DELETE /{id}` 口径不一致。
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
            Router,
            routing::{delete, get, post, put},
        };
        use linkme::distributed_slice;
        use robotech::web::ROUTER_SLICE;

        #[distributed_slice(ROUTER_SLICE)]
        static BUILD_ROUTER_FN: fn() -> Router = build_router;

        fn build_router() -> Router {
            Router::new()
                // `/sync` 是 syn 的内部复制入口，不走用户鉴权；框架生成的
                // `sync` 处理器从请求体取审计字段，不需要 `X-User-Id`。
                .route(concat!($prefix, "/sync"), post(sync))
                // CDC 删除同样属于复制动作：给 syn 一个不带用户鉴权的专用删除入口，
                // 复用 ctrl 生成的 `del_by_id`（它只读 Path，不读身份头）。
                .route(concat!($prefix, "/sync/{id}"), delete(del_by_id))
                .merge(
                    Router::new()
                        .route(concat!($prefix, "/list"), get(list_by_query_dto))
                .route(concat!($prefix, "/count"), get(count_by_query_dto))
                        .route(concat!($prefix, "/count"), get(count_by_query_dto))
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
                        .route($prefix, post(add))
                        .route($prefix, put(modify))
                        .route($prefix, get(get_by_query_dto))
                        .route($prefix, delete(del_by_query_dto))
                        .route(concat!($prefix, "/{id}"), delete(del_by_id))
                        .route(concat!($prefix, "/{id}"), get(get_by_id))
                        .layer(axum::middleware::from_fn(crate::web::auth::require_auth)),
                )
        }
    };
}

/// # 带鉴权的只读路由
///
/// 日志类资源只允许查询：不注册 `save` / `upsert` / `sync` / `add` / `modify` /
/// `delete`，避免日志被界面或脚本改写。GET 路由与 [`adm_crud_router`] 保持一致。
///
/// ## 用法
/// ```ignore
/// adm_readonly_router!("/adm/login-log", adm_login_log_ctrl);
/// ```
#[macro_export]
macro_rules! adm_readonly_router {
    ($prefix:literal, $ctrl_module:ident) => {
        #[allow(unused_imports)]
        use crate::web::ctrl::$ctrl_module::*;
        use axum::{Router, routing::get};
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
                .route($prefix, get(get_by_query_dto))
                .route(concat!($prefix, "/{id}"), get(get_by_id))
                .layer(axum::middleware::from_fn(crate::web::auth::require_auth))
        }
    };
}

pub use adm_api::cst;
pub use adm_api::dic;
pub use adm_api::dto;
pub use adm_api::mo;
pub use adm_api::vo;
