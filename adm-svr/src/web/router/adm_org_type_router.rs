use robotech::macros::router;

/// # 组织类型路由
///
/// `/adm/org-type` 下的一整套接口，与
/// [`AdmOrgTypeCtrl`](crate::web::ctrl::adm_org_type_ctrl) 一一对应。
#[router(crud)]
struct AdmOrgTypeRouter;
