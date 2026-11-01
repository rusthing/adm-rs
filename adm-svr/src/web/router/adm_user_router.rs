use robotech::macros::router;

/// # 用户路由
///
/// `#[router(crud)]` 生成 `/adm/user` 前缀下的一整套接口，与
/// [`AdmUserCtrl`](crate::web::ctrl::adm_user_ctrl) 一一对应。
///
/// 「重置口令」是独立路由树，见
/// [`adm_user_password_router`](crate::web::router::adm_user_password_router)。
#[router(crud)]
struct AdmUserRouter;
