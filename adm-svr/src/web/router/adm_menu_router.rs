use robotech::macros::router;

/// # 菜单路由
///
/// `/adm/menu` 下的一整套接口，与
/// [`AdmMenuCtrl`](crate::web::ctrl::adm_menu_ctrl) 一一对应。
#[router(crud)]
struct AdmMenuRouter;
