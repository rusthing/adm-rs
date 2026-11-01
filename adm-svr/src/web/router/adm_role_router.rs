use robotech::macros::router;

/// # 角色路由
///
/// `/adm/role` 下的一整套接口，与
/// [`AdmRoleCtrl`](crate::web::ctrl::adm_role_ctrl) 一一对应。
#[router(crud)]
struct AdmRoleRouter;
