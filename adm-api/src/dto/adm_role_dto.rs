//! # 角色 DTO
//!
//! 权限的集合，按分组管理；角色与用户的关联见 role_user，与权限的关联见 role_perm

use robotech::macros::crud_dto;

#[crud_dto]
pub struct AdmRoleDto {
    /// 角色分组 ID
    /// 关联 role_group；(group_id, name) 唯一，不同分组可以重名
    pub group_id: u64,
    /// 名称
    /// 同一分组内唯一（AK）
    /// @len 1..=50
    pub name: String,
    /// 排序值
    /// 同一分组内排序，越小越靠前
    /// @range 0..=9999
    pub sort_order: i32,
    /// 备注
    /// @len 0..=50
    pub remark: Option<String>,
    /// 是否启用
    /// false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
    /// 与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用
    #[db_default]
    pub enabled: bool,
}
