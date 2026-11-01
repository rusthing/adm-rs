//! # 角色权限 DTO
//!
//! 角色与权限的多对多授权关系，鉴权时按 user → role_user → role_perm → perm.urn 展开

use robotech::macros::crud_dto;

#[crud_dto]
pub struct AdmRolePermDto {
    /// 角色 ID
    /// 关联 role；(role_id, perm_id) 唯一（AK）
    pub role_id: u64,
    /// 权限 ID
    /// 关联 perm；(role_id, perm_id) 唯一（AK）
    pub perm_id: u64,
}
