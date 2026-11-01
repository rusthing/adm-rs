//! # 领域用户 VO
//!
//! 领域与用户的多对多归属，决定该账号能进入哪些领域

use robotech::macros::vo;

#[vo]
pub struct AdmRealmUserVo {
    /// 主键
    pub id: u64,
    /// 领域 ID
    /// 关联 realm；(realm_id, user_id) 唯一（AK）
    pub realm_id: u64,
    /// 用户 ID
    /// 关联 user；(realm_id, user_id) 唯一（AK）
    pub user_id: u64,
    /// 创建人 ID
    pub creater_id: u64,
    /// 创建时间戳（毫秒）
    pub create_ms: u64,
    /// 最后修改人 ID
    pub updater_id: u64,
    /// 最后修改时间戳（毫秒）
    pub update_ms: u64,
}
