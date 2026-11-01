use robotech::macros::router;

/// # 权限分组路由
///
/// `/adm/perm-group` 下的一整套接口，与
/// [`AdmPermGroupCtrl`](crate::web::ctrl::adm_perm_group_ctrl) 一一对应。
#[router(crud)]
struct AdmPermGroupRouter;
