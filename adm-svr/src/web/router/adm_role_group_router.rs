// # 角色分组路由
//
// `/adm/role-group` 下的一整套接口，与
// [`AdmRoleGroupCtrl`](crate::web::ctrl::adm_role_group_ctrl) 一一对应。
// 整棵路由树挂 Bearer 鉴权中间件。
crate::adm_crud_router!("/adm/role-group", adm_role_group_ctrl);
