// # 操作日志路由
//
// `/adm/op-log` 下的一整套接口，与
// [`AdmOpLogCtrl`](crate::web::ctrl::adm_op_log_ctrl) 一一对应。
// 整棵路由树挂 Bearer 鉴权中间件。
crate::adm_crud_router!("/adm/op-log", adm_op_log_ctrl);
