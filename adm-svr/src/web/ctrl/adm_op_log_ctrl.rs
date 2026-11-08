use robotech::macros::ctrl;

/// # 操作日志控制器（CRUD）
///
/// 路由前缀 `/adm/op-log`，只注册宏生成的查询接口，日志不允许写入。
#[ctrl]
struct AdmOpLogCtrl;
