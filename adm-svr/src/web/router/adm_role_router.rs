// # 角色路由
//
// `/adm/role` 下的一整套接口，与
// [`AdmRoleCtrl`](crate::web::ctrl::adm_role_ctrl) 一一对应。
// 整棵路由树挂 Bearer 鉴权中间件。
crate::adm_crud_router!("/adm/role", adm_role_ctrl);
