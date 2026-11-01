use robotech::macros::router;

/// # 菜单权限路由
///
/// `/adm/menu-perm` 下的一整套接口，与
/// [`AdmMenuPermCtrl`](crate::web::ctrl::adm_menu_perm_ctrl) 一一对应。
#[router(crud)]
struct AdmMenuPermRouter;
