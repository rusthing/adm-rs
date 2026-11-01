use robotech::macros::router;

/// # 操作日志路由
///
/// `/adm/op-log` 下的一整套接口，与
/// [`AdmOpLogCtrl`](crate::web::ctrl::adm_op_log_ctrl) 一一对应。
#[router(crud)]
struct AdmOpLogRouter;
