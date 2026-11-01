use robotech::macros::router;

/// # 组织路由
///
/// `/adm/org` 下的一整套接口，与
/// [`AdmOrgCtrl`](crate::web::ctrl::adm_org_ctrl) 一一对应。
#[router(crud)]
struct AdmOrgRouter;
