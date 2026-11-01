//! # 角色用户 VO
//!
//! 角色与用户的多对多授权关系

use robotech::macros::vo;

#[vo]
pub struct AdmRoleUserVo {
    /// 主键
    pub id: u64,
    /// 用户 ID
    /// 关联 user；(user_id, role_id) 唯一（AK）
    pub user_id: u64,
    /// 角色 ID
    /// 关联 role；(user_id, role_id) 唯一（AK）
    pub role_id: u64,
    /// 创建人 ID
    pub creater_id: u64,
    /// 创建时间戳（毫秒）
    pub create_ms: u64,
    /// 最后修改人 ID
    pub updater_id: u64,
    /// 最后修改时间戳（毫秒）
    pub update_ms: u64,
}
