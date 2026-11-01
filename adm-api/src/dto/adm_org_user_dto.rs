//! # 组织用户 DTO
//!
//! 组织与用户的多对多关系，一个人在多个组织任职时有多行

use robotech::macros::crud_dto;

#[crud_dto]
pub struct AdmOrgUserDto {
    /// 组织 ID
    /// 关联 org；(org_id, user_id) 唯一（AK）
    pub org_id: u64,
    /// 用户 ID
    /// 关联 user；(org_id, user_id) 唯一（AK）
    pub user_id: u64,
}
