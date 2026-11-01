use robotech::macros::router;

/// # 领域路由
///
/// `/adm/realm` 下的一整套接口，与
/// [`AdmRealmCtrl`](crate::web::ctrl::adm_realm_ctrl) 一一对应。
#[router(crud)]
struct AdmRealmRouter;
