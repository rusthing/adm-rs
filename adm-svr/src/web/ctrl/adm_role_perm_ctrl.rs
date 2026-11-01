use robotech::macros::ctrl;

/// # 角色权限控制器（CRUD）
///
/// 路由前缀 `/adm/role-perm`，21 个 CRUD 与检索接口全部由宏生成。
#[ctrl]
struct AdmRolePermCtrl;
