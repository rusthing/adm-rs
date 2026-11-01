use robotech::macros::router;

/// # 角色权限路由
///
/// `/adm/role-perm` 下的一整套接口，与
/// [`AdmRolePermCtrl`](crate::web::ctrl::adm_role_perm_ctrl) 一一对应。
#[router(crud)]
struct AdmRolePermRouter;
