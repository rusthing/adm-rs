use robotech::macros::ctrl;

/// # 权限分组控制器（CRUD）
///
/// 路由前缀 `/adm/perm-group`，21 个 CRUD 与检索接口全部由宏生成。
#[ctrl]
struct AdmPermGroupCtrl;
