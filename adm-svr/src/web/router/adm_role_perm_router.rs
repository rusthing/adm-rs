// # 角色权限路由
//
// `/adm/role-perm` 下的一整套接口，与
// [`AdmRolePermCtrl`](crate::web::ctrl::adm_role_perm_ctrl) 一一对应。
// 整棵路由树挂 Bearer 鉴权中间件。
crate::adm_crud_router!("/adm/role-perm", adm_role_perm_ctrl);
