// # 用户（账号）路由
//
// `/adm/user` 下的一整套接口，与
// [`AdmUserCtrl`](crate::web::ctrl::adm_user_ctrl) 一一对应。
// 整棵路由树挂 Bearer 鉴权中间件。
crate::adm_crud_router!("/adm/user", adm_user_ctrl);
