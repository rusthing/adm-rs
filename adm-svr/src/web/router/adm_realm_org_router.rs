// # 领域组织路由
//
// `/adm/realm-org` 下的一整套接口，与
// [`AdmRealmOrgCtrl`](crate::web::ctrl::adm_realm_org_ctrl) 一一对应。
// 整棵路由树挂 Bearer 鉴权中间件。
crate::adm_crud_router!("/adm/realm-org", adm_realm_org_ctrl);
