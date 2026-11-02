// # 锁定日志路由
//
// `/adm/lock-log` 下的一整套接口，与
// [`AdmLockLogCtrl`](crate::web::ctrl::adm_lock_log_ctrl) 一一对应。
// 整棵路由树挂 Bearer 鉴权中间件。
crate::adm_crud_router!("/adm/lock-log", adm_lock_log_ctrl);
