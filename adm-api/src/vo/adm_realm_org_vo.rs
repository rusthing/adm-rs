//! # 领域组织 VO
//!
//! 领域与组织的多对多归属，一个组织可服务于多个领域

use robotech::macros::vo;

#[vo]
pub struct AdmRealmOrgVo {
    /// 主键
    pub id: u64,
    /// 领域 ID
    /// 关联 realm；(realm_id, org_id) 唯一（AK）
    pub realm_id: u64,
    /// 组织 ID
    /// 关联 org；(realm_id, org_id) 唯一（AK）
    pub org_id: u64,
    /// 创建人 ID
    pub creater_id: u64,
    /// 创建时间戳（毫秒）
    pub create_ms: u64,
    /// 最后修改人 ID
    pub updater_id: u64,
    /// 最后修改时间戳（毫秒）
    pub update_ms: u64,
}
