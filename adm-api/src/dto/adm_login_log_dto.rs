//! # 登录日志 DTO
//!
//! 每次登录尝试一行（含失败），用于安全审计与异常登录排查
//!
//! 校验标签：`@len` / `@range` 是结构约束，`@check is_xxx` 调
//! `wheel_rs::regex_utils` 的谓词做语义校验（能带校验位），`@unit` 只是单位说明。

use robotech::macros::crud_dto;

#[crud_dto]
pub struct AdmLoginLogDto {
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
}
