use robotech::macros::api_doc;

/// # 用户口令接口文档
///
/// 把手写的 `reset_password` 登记进 OpenAPI；CRUD 的 21 个方法见
/// [`AdmUserApiDoc`](crate::web::api_doc::AdmUserApiDoc)。
#[api_doc(reset_password)]
pub struct AdmUserPasswordApiDoc;
