//! # 锁定日志 VO
//!
//! 账户锁定与解锁的流水：锁定写一行，解锁时回填 unlock_ms / unlock_reason，同一行贯穿一次锁定周期

use robotech::macros::vo;

#[vo]
pub struct AdmLockLogVo {
    /// 主键
    pub id: u64,
    /// 用户 ID
    /// 关联 user；为空表示账号已被删除，但锁定流水仍需保留
    pub user_id: Option<u64>,
    /// 锁定时间戳
    /// @unit ms
    pub lock_ms: u64,
    /// 锁定原因
    /// 如「连续登录失败 5 次」「管理员手动锁定」
    /// @len 1..=100
    pub lock_reason: String,
    /// 解锁时间戳
    /// 为空表示仍在锁定中（这是「锁定中」的唯一判据）
    /// @unit ms
    pub unlock_ms: Option<u64>,
    /// 解锁原因
    /// 为空表示尚未解锁，与 unlock_ms 同时为空才是一条有效的「锁定中」记录
    /// @len 1..=100
    pub unlock_reason: Option<String>,
    /// 创建人 ID
    pub creater_id: u64,
    /// 创建时间戳（毫秒）
    pub create_ms: u64,
    /// 最后修改人 ID
    pub updater_id: u64,
    /// 最后修改时间戳（毫秒）
    pub update_ms: u64,
}
