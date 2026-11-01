use robotech::macros::ctrl;

/// # 操作类型控制器（CRUD）
///
/// 路由前缀 `/adm/op-type`，21 个 CRUD 与检索接口全部由宏生成。
#[ctrl]
struct AdmOpTypeCtrl;
