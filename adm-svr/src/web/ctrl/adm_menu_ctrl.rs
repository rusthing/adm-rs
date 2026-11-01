use robotech::macros::ctrl;

/// # 菜单控制器（CRUD）
///
/// 路由前缀 `/adm/menu`，21 个 CRUD 与检索接口全部由宏生成。
#[ctrl]
struct AdmMenuCtrl;
