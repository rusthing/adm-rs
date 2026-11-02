// # 组织类型路由
//
// `/adm/org-type` 下的一整套接口，与
// [`AdmOrgTypeCtrl`](crate::web::ctrl::adm_org_type_ctrl) 一一对应。
// 整棵路由树挂 Bearer 鉴权中间件。
crate::adm_crud_router!("/adm/org-type", adm_org_type_ctrl);
