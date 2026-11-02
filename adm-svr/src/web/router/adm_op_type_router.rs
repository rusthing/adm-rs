// # 操作类型路由
//
// `/adm/op-type` 下的一整套接口，与
// [`AdmOpTypeCtrl`](crate::web::ctrl::adm_op_type_ctrl) 一一对应。
// 整棵路由树挂 Bearer 鉴权中间件。
crate::adm_crud_router!("/adm/op-type", adm_op_type_ctrl);
