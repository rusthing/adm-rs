use robotech::macros::ctrl;

/// # 锁定日志控制器（CRUD）
///
/// 路由前缀 `/adm/lock-log`，21 个 CRUD 与检索接口全部由宏生成。
#[ctrl]
struct AdmLockLogCtrl;
