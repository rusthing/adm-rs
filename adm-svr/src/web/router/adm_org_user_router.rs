// # 组织用户路由
//
// `/adm/org-user` 下的一整套接口，与
// [`AdmOrgUserCtrl`](crate::web::ctrl::adm_org_user_ctrl) 一一对应。
// 整棵路由树挂 Bearer 鉴权中间件。
crate::adm_crud_router!("/adm/org-user", adm_org_user_ctrl);
