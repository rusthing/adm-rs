// # 应用路由
//
// `/adm/app` 下的一整套接口，与
// [`AdmAppCtrl`](crate::web::ctrl::adm_app_ctrl) 一一对应。
// 整棵路由树挂 Bearer 鉴权中间件。
crate::adm_crud_router!("/adm/app", adm_app_ctrl);
