// # 菜单权限路由
//
// `/adm/menu-perm` 下的一整套接口，与
// [`AdmMenuPermCtrl`](crate::web::ctrl::adm_menu_perm_ctrl) 一一对应。
// 整棵路由树挂 Bearer 鉴权中间件。
crate::adm_crud_router!("/adm/menu-perm", adm_menu_perm_ctrl);
