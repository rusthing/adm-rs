// # 领域路由
//
// `/adm/realm` 下的一整套接口，与
// [`AdmRealmCtrl`](crate::web::ctrl::adm_realm_ctrl) 一一对应。
// 整棵路由树挂 Bearer 鉴权中间件。
crate::adm_crud_router!("/adm/realm", adm_realm_ctrl);
