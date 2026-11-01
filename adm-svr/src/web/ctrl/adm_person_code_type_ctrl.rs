use robotech::macros::ctrl;

/// # 人员编码类型控制器（CRUD）
///
/// 路由前缀 `/adm/person-code-type`，21 个 CRUD 与检索接口全部由宏生成。
#[ctrl]
struct AdmPersonCodeTypeCtrl;
