use robotech::macros::router;

/// # 操作类型路由
///
/// `/adm/op-type` 下的一整套接口，与
/// [`AdmOpTypeCtrl`](crate::web::ctrl::adm_op_type_ctrl) 一一对应。
#[router(crud)]
struct AdmOpTypeRouter;
