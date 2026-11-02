// # 权限路由
//
// `/adm/perm` 下的一整套接口，与
// [`AdmPermCtrl`](crate::web::ctrl::adm_perm_ctrl) 一一对应。
// 整棵路由树挂 Bearer 鉴权中间件。
crate::adm_crud_router!("/adm/perm", adm_perm_ctrl);
