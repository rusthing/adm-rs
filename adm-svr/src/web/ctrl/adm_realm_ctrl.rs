use robotech::macros::ctrl;

/// # 领域控制器（CRUD）
///
/// 路由前缀 `/adm/realm`，21 个 CRUD 与检索接口全部由宏生成。
#[ctrl]
struct AdmRealmCtrl;
