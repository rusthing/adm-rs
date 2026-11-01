use robotech::macros::router;

/// # 应用路由
///
/// `/adm/app` 下的一整套接口，与
/// [`AdmAppCtrl`](crate::web::ctrl::adm_app_ctrl) 一一对应。
#[router(crud)]
struct AdmAppRouter;
