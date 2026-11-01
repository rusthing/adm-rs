use robotech::macros::ctrl;

/// # 选项（字典）控制器（CRUD）
///
/// 路由前缀 `/adm/option`，21 个 CRUD 与检索接口全部由宏生成。
#[ctrl]
struct AdmOptionCtrl;
