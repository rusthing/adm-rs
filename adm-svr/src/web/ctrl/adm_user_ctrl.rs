use robotech::macros::ctrl;

/// # 用户（账号）控制器（CRUD）
///
/// 路由前缀 `/adm/user`，21 个 CRUD 与检索接口全部由宏生成。
#[ctrl]
struct AdmUserCtrl;
