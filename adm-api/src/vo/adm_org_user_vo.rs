//! # 组织用户 VO
//!
//! 组织与用户的多对多关系，一个人在多个组织任职时有多行

use robotech::macros::vo;

#[vo]
pub struct AdmOrgUserVo {
    /// 主键
    pub id: u64,
    /// 组织 ID
    /// 关联 org；(org_id, user_id) 唯一（AK）
    pub org_id: u64,
    /// 用户 ID
    /// 关联 user；(org_id, user_id) 唯一（AK）
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
