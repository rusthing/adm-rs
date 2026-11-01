//! # 角色菜单 VO
//!
//! 角色与菜单的多对多关联，决定该角色登录后能看到哪些菜单

use robotech::macros::vo;

#[vo]
pub struct AdmRoleMenuVo {
    /// 主键
    pub id: u64,
    /// 菜单 ID
    /// 关联 menu；(menu_id, role_id) 唯一（AK）
    pub menu_id: u64,
    /// 角色 ID
    /// 关联 role；(menu_id, role_id) 唯一（AK）
    pub role_id: u64,
    /// 创建人 ID
    pub creater_id: u64,
    /// 创建时间戳（毫秒）
    pub create_ms: u64,
    /// 最后修改人 ID
    pub updater_id: u64,
    /// 最后修改时间戳（毫秒）
    pub update_ms: u64,
}
