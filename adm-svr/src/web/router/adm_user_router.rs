use robotech::macros::router;

/// # 用户（账号）路由
///
/// `/adm/user` 下的一整套接口，与
/// [`AdmUserCtrl`](crate::web::ctrl::adm_user_ctrl) 一一对应。
#[router(crud)]
struct AdmUserRouter;
