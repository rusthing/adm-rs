use robotech::macros::router;

/// # 角色用户路由
///
/// `/adm/role-user` 下的一整套接口，与
/// [`AdmRoleUserCtrl`](crate::web::ctrl::adm_role_user_ctrl) 一一对应。
#[router(crud)]
struct AdmRoleUserRouter;
