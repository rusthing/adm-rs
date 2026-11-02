use robotech::macros::api_doc;

/// # 认证接口文档
///
/// 手写接口，按 `#[ctrl]` 的规矩不列那 21 个，只列自己有的。
#[api_doc(login, logout, me, change_password)]
pub struct AdmAuthApiDoc;
