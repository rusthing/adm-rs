use robotech::macros::ctrl;

/// # 登录日志控制器（CRUD）
///
/// 路由前缀 `/adm/login-log`，21 个 CRUD 与检索接口全部由宏生成。
#[ctrl]
struct AdmLoginLogCtrl;
