use robotech::macros::router;

/// # 角色分组路由
///
/// `/adm/role-group` 下的一整套接口，与
/// [`AdmRoleGroupCtrl`](crate::web::ctrl::adm_role_group_ctrl) 一一对应。
#[router(crud)]
struct AdmRoleGroupRouter;
