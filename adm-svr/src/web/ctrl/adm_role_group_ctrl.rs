use robotech::macros::ctrl;

/// # 角色分组控制器（CRUD）
///
/// 路由前缀 `/adm/role-group`，21 个 CRUD 与检索接口全部由宏生成。
#[ctrl]
struct AdmRoleGroupCtrl;
