//! # 角色用户 DTO
//!
//! 角色与用户的多对多授权关系

use robotech::macros::crud_dto;

#[crud_dto]
pub struct AdmRoleUserDto {
    /// 用户 ID
    /// 关联 user；(user_id, role_id) 唯一（AK）
    pub user_id: u64,
    /// 角色 ID
    /// 关联 role；(user_id, role_id) 唯一（AK）
    pub role_id: u64,
}
