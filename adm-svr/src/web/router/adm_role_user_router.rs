// # 角色用户路由
//
// `/adm/role-user` 下的一整套接口，与
// [`AdmRoleUserCtrl`](crate::web::ctrl::adm_role_user_ctrl) 一一对应。
// 整棵路由树挂 Bearer 鉴权中间件。
crate::adm_crud_router!("/adm/role-user", adm_role_user_ctrl);
