use robotech::macros::router;

/// # 领域组织路由
///
/// `/adm/realm-org` 下的一整套接口，与
/// [`AdmRealmOrgCtrl`](crate::web::ctrl::adm_realm_org_ctrl) 一一对应。
#[router(crud)]
struct AdmRealmOrgRouter;
