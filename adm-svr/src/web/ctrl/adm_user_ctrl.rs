use robotech::macros::ctrl;

/// # 用户控制器（CRUD）
///
/// 路由前缀 `/adm/user`，21 个 CRUD 与检索接口全部由宏生成，见
/// [`AdmUserApiDoc`](crate::web::api_doc::AdmUserApiDoc)。
///
/// 「重置口令」不属于 CRUD，单独放在
/// [`adm_user_password_ctrl`](crate::web::ctrl::adm_user_password_ctrl)。
#[ctrl]
struct AdmUserCtrl;
