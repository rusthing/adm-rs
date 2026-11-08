use robotech::macros::ctrl;

/// # 锁定日志控制器（CRUD）
///
/// 路由前缀 `/adm/lock-log`，只注册宏生成的查询接口，日志不允许写入。
#[ctrl]
struct AdmLockLogCtrl;
