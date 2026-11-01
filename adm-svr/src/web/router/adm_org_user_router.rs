use robotech::macros::router;

/// # 组织用户路由
///
/// `/adm/org-user` 下的一整套接口，与
/// [`AdmOrgUserCtrl`](crate::web::ctrl::adm_org_user_ctrl) 一一对应。
#[router(crud)]
struct AdmOrgUserRouter;
