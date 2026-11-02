// # 人员（自然人）路由
//
// `/adm/person` 下的一整套接口，与
// [`AdmPersonCtrl`](crate::web::ctrl::adm_person_ctrl) 一一对应。
// 整棵路由树挂 Bearer 鉴权中间件。
crate::adm_crud_router!("/adm/person", adm_person_ctrl);
