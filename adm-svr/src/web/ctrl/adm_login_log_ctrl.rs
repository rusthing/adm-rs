use robotech::macros::ctrl;

/// # 登录日志控制器（CRUD）
///
/// 路由前缀 `/adm/login-log`，只注册宏生成的查询接口，日志不允许写入。
#[ctrl]
struct AdmLoginLogCtrl;
