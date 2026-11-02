// # 登录日志路由
//
// `/adm/login-log` 下的一整套接口，与
// [`AdmLoginLogCtrl`](crate::web::ctrl::adm_login_log_ctrl) 一一对应。
// 整棵路由树挂 Bearer 鉴权中间件。
crate::adm_crud_router!("/adm/login-log", adm_login_log_ctrl);
