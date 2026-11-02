// # 组织路由
//
// `/adm/org` 下的一整套接口，与
// [`AdmOrgCtrl`](crate::web::ctrl::adm_org_ctrl) 一一对应。
// 整棵路由树挂 Bearer 鉴权中间件。
crate::adm_crud_router!("/adm/org", adm_org_ctrl);
