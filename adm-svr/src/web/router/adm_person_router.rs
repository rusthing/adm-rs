use robotech::macros::router;

/// # 人员（自然人）路由
///
/// `/adm/person` 下的一整套接口，与
/// [`AdmPersonCtrl`](crate::web::ctrl::adm_person_ctrl) 一一对应。
#[router(crud)]
struct AdmPersonRouter;
