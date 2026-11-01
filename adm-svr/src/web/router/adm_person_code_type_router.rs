use robotech::macros::router;

/// # 人员编码类型路由
///
/// `/adm/person-code-type` 下的一整套接口，与
/// [`AdmPersonCodeTypeCtrl`](crate::web::ctrl::adm_person_code_type_ctrl) 一一对应。
#[router(crud)]
struct AdmPersonCodeTypeRouter;
