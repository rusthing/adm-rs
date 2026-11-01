use robotech::macros::router;

/// # 权限路由
///
/// `/adm/perm` 下的一整套接口，与
/// [`AdmPermCtrl`](crate::web::ctrl::adm_perm_ctrl) 一一对应。
#[router(crud)]
struct AdmPermRouter;
