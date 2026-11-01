use robotech::macros::router;

/// # 登录日志路由
///
/// `/adm/login-log` 下的一整套接口，与
/// [`AdmLoginLogCtrl`](crate::web::ctrl::adm_login_log_ctrl) 一一对应。
#[router(crud)]
struct AdmLoginLogRouter;
