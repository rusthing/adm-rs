use robotech::macros::ctrl;

/// # 人员（自然人）控制器（CRUD）
///
/// 路由前缀 `/adm/person`，21 个 CRUD 与检索接口全部由宏生成。
#[ctrl]
struct AdmPersonCtrl;
