//! # 组织用户 DTO
//!
//! 领域、组织与用户的三方关系：一个人在某领域的某组织任职，同一人可在多个领域/组织各占一行；
//! 每行都要与 realm_org / realm_user 对齐

use robotech::macros::crud_dto;

#[crud_dto]
pub struct AdmOrgUserDto {
    /// 领域 ID
    /// 关联 realm；决定这条任职记录属于哪个领域
    /// (realm_id, org_id, user_id) 唯一（AK）
    pub realm_id: u64,
    /// 组织 ID
    /// 关联 org；同一领域内 (realm_id, org_id, user_id) 唯一（AK）
    pub org_id: u64,
    /// 用户 ID
    /// 关联 user；同一领域内 (realm_id, org_id, user_id) 唯一（AK）
    pub user_id: u64,
}
