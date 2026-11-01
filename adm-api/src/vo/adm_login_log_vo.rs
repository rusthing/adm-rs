//! # 登录日志 VO
//!
//! 每次登录尝试一行（含失败），用于安全审计与异常登录排查

use robotech::macros::vo;

#[vo]
pub struct AdmLoginLogVo {
    /// 主键
    pub id: u64,
    /// 用户 ID
    /// 关联 user；为空表示登录名不存在（失败的尝试也要留痕）
    pub user_id: Option<u64>,
    /// 登录时间戳
    /// @unit ms
    pub login_ms: u64,
    /// 登出时间戳
    /// 为空表示未登出（会话超时或仍在线）
    /// @unit ms
    pub logout_ms: Option<u64>,
    /// 登录 IP
    /// IPv4 与 IPv6 都存，45 是 IPv6 带内嵌 IPv4 时的最长文本长度（如 ::ffff:192.168.1.10）
    /// @len 1..=45
    /// @check is_ip
    pub login_ip: String,
    /// 创建人 ID
    pub creater_id: u64,
    /// 创建时间戳（毫秒）
    pub create_ms: u64,
    /// 最后修改人 ID
    pub updater_id: u64,
    /// 最后修改时间戳（毫秒）
    pub update_ms: u64,
}
