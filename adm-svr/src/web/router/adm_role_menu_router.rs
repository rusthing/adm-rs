use robotech::macros::router;

/// # 角色菜单路由
///
/// `/adm/role-menu` 下的一整套接口，与
/// [`AdmRoleMenuCtrl`](crate::web::ctrl::adm_role_menu_ctrl) 一一对应。
#[router(crud)]
struct AdmRoleMenuRouter;
