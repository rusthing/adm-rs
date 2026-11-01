//! # 角色菜单 DTO
//!
//! 角色与菜单的多对多关联，决定该角色登录后能看到哪些菜单

use robotech::macros::crud_dto;

#[crud_dto]
pub struct AdmRoleMenuDto {
    /// 菜单 ID
    /// 关联 menu；(menu_id, role_id) 唯一（AK）
    pub menu_id: u64,
    /// 角色 ID
    /// 关联 role；(menu_id, role_id) 唯一（AK）
    pub role_id: u64,
}
