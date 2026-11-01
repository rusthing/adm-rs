//! # 菜单权限 DTO
//!
//! 菜单与权限点的多对多关联，前端据此计算每个页面上的按钮权限（meta.perms）

use robotech::macros::crud_dto;

#[crud_dto]
pub struct AdmMenuPermDto {
    /// 菜单 ID
    /// 关联 menu；(menu_id, perm_id) 唯一（AK）
    pub menu_id: u64,
    /// 权限 ID
    /// 关联 perm；(menu_id, perm_id) 唯一（AK）
    pub perm_id: u64,
}
