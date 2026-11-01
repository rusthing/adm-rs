use robotech::macros::dic;
use strum::{AsRefStr, Display, EnumString};

/// # 用户状态
///
/// 对应 `adm_user.status`。`Locked` 与 `Disabled` 的区别是**谁改的**：前者由登录失败
/// 次数等安全策略自动置位，后者由管理员手工停用。分开是为了让「自助解锁」和「申请
/// 开通」走到不同的人手上。
///
/// 被 `AdmUserVo` 用作字段，所以必须声明 `default`。
#[dic(default = Normal)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, AsRefStr, Display, EnumString)]
#[strum(serialize_all = "kebab-case")]
pub enum UserStatus {
    /// 正常
    Normal = 1,
    /// 已停用
    Disabled = 2,
    /// 已锁定
    Locked = 3,
}
