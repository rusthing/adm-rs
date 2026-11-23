use robotech::macros::ctrl;

/// # 人员类型控制器（CRUD）
///
/// 路由前缀 `/adm/person-type`，CRUD 与检索接口全部由宏生成。
#[ctrl]
struct AdmPersonTypeCtrl;
