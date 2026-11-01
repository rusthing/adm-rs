use robotech::macros::api_doc;

/// # 认证接口文档
///
/// 手写接口只有两个方法，按 `#[ctrl]` 的规矩不列那 21 个，只列自己有的。
#[api_doc(login, logout)]
pub struct AdmAuthApiDoc;
