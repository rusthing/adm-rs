use robotech::macros::ctrl;

/// # 组织控制器（CRUD）
///
/// 路由前缀 `/adm/org`，21 个 CRUD 与检索接口全部由宏生成。
#[ctrl]
struct AdmOrgCtrl;
