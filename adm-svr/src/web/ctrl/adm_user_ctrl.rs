use robotech::macros::ctrl;

/// # 用户（账号）控制器（CRUD）
///
/// 路由前缀 `/adm/user`，21 个 CRUD 与检索接口全部由宏生成。
/// 批量接口（list / page / search 系）响应 `AdmUserListVo`（敏感字段脱敏），
/// 单条与写接口不变。
#[ctrl(list_vo = AdmUserListVo)]
struct AdmUserCtrl;
