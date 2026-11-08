// # 锁定日志路由（只读）
//
// `/adm/lock-log` 下只注册查询接口，与
// [`AdmLockLogCtrl`](crate::web::ctrl::adm_lock_log_ctrl) 的 GET 处理器对应。
// 写接口（save / upsert / sync / add / modify / delete）不注册，日志不可被改写。
// 整棵路由树挂 Bearer 鉴权中间件。
crate::adm_readonly_router!("/adm/lock-log", adm_lock_log_ctrl);
