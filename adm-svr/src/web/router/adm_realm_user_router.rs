// # 领域用户路由
//
// `/adm/realm-user` 下的一整套接口，与
// [`AdmRealmUserCtrl`](crate::web::ctrl::adm_realm_user_ctrl) 一一对应。
// 整棵路由树挂 Bearer 鉴权中间件。
crate::adm_crud_router!("/adm/realm-user", adm_realm_user_ctrl);
