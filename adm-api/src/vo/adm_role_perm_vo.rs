//! # 角色权限 VO
//!
//! 角色与权限的多对多授权关系，鉴权时按 user → role_user → role_perm → perm.urn 展开

use robotech::macros::vo;

#[vo]
pub struct AdmRolePermVo {
    /// 主键
    pub id: u64,
    /// 角色 ID
    /// 关联 role；(role_id, perm_id) 唯一（AK）
    pub role_id: u64,
    /// 权限 ID
    /// 关联 perm；(role_id, perm_id) 唯一（AK）
    pub perm_id: u64,
    /// 创建人 ID
    pub creater_id: u64,
    /// 创建时间戳（毫秒）
    pub create_ms: u64,
    /// 最后修改人 ID
    pub updater_id: u64,
    /// 最后修改时间戳（毫秒）
    pub update_ms: u64,
}
