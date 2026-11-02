// # 角色菜单路由
//
// `/adm/role-menu` 下的一整套接口，与
// [`AdmRoleMenuCtrl`](crate::web::ctrl::adm_role_menu_ctrl) 一一对应。
// 整棵路由树挂 Bearer 鉴权中间件。
crate::adm_crud_router!("/adm/role-menu", adm_role_menu_ctrl);
