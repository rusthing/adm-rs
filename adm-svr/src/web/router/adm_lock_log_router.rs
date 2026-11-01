use robotech::macros::router;

/// # 锁定日志路由
///
/// `/adm/lock-log` 下的一整套接口，与
/// [`AdmLockLogCtrl`](crate::web::ctrl::adm_lock_log_ctrl) 一一对应。
#[router(crud)]
struct AdmLockLogRouter;
