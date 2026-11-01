//! # 领域组织 DTO
//!
//! 领域与组织的多对多归属，一个组织可服务于多个领域

use robotech::macros::crud_dto;

#[crud_dto]
pub struct AdmRealmOrgDto {
    /// 领域 ID
    /// 关联 realm；(realm_id, org_id) 唯一（AK）
    pub realm_id: u64,
    /// 组织 ID
    /// 关联 org；(realm_id, org_id) 唯一（AK）
    pub org_id: u64,
}
