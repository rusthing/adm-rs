use robotech::macros::router;

/// # 领域用户路由
///
/// `/adm/realm-user` 下的一整套接口，与
/// [`AdmRealmUserCtrl`](crate::web::ctrl::adm_realm_user_ctrl) 一一对应。
#[router(crud)]
struct AdmRealmUserRouter;
