// # 选项（字典）路由
//
// `/adm/option` 下的一整套接口，与
// [`AdmOptionCtrl`](crate::web::ctrl::adm_option_ctrl) 一一对应。
// 整棵路由树挂 Bearer 鉴权中间件。
crate::adm_crud_router!("/adm/option", adm_option_ctrl);
