// # 登录日志路由（只读）
//
// `/adm/login-log` 下只注册查询接口，与
// [`AdmLoginLogCtrl`](crate::web::ctrl::adm_login_log_ctrl) 的 GET 处理器对应。
// 写接口（save / upsert / sync / add / modify / delete）不注册，日志不可被改写。
// 整棵路由树挂 Bearer 鉴权中间件。
crate::adm_readonly_router!("/adm/login-log", adm_login_log_ctrl);
