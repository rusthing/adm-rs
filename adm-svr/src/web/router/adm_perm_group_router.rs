// # 权限分组路由
//
// `/adm/perm-group` 下的一整套接口，与
// [`AdmPermGroupCtrl`](crate::web::ctrl::adm_perm_group_ctrl) 一一对应。
// 整棵路由树挂 Bearer 鉴权中间件。
crate::adm_crud_router!("/adm/perm-group", adm_perm_group_ctrl);
