//! # 领域用户 DTO
//!
//! 领域与用户的多对多归属，决定该账号能进入哪些领域

use robotech::macros::crud_dto;

#[crud_dto]
pub struct AdmRealmUserDto {
    /// 领域 ID
    /// 关联 realm；(realm_id, user_id) 唯一（AK）
    pub realm_id: u64,
    /// 用户 ID
    /// 关联 user；(realm_id, user_id) 唯一（AK）
    pub user_id: u64,
}
