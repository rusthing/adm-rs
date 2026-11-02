// # 菜单路由
//
// `/adm/menu` 下的一整套接口，与
// [`AdmMenuCtrl`](crate::web::ctrl::adm_menu_ctrl) 一一对应。
// 整棵路由树挂 Bearer 鉴权中间件。
crate::adm_crud_router!("/adm/menu", adm_menu_ctrl);
