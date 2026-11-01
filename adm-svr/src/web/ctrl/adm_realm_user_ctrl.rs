use robotech::macros::ctrl;

/// # 领域用户控制器（CRUD）
///
/// 路由前缀 `/adm/realm-user`，21 个 CRUD 与检索接口全部由宏生成。
#[ctrl]
struct AdmRealmUserCtrl;
