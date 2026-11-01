//! # 菜单权限 VO
//!
//! 菜单与权限点的多对多关联，前端据此计算每个页面上的按钮权限（meta.perms）

use robotech::macros::vo;

#[vo]
pub struct AdmMenuPermVo {
    /// 主键
    pub id: u64,
    /// 菜单 ID
    /// 关联 menu；(menu_id, perm_id) 唯一（AK）
    pub menu_id: u64,
    /// 权限 ID
    /// 关联 perm；(menu_id, perm_id) 唯一（AK）
    pub perm_id: u64,
    /// 创建人 ID
    pub creater_id: u64,
    /// 创建时间戳（毫秒）
    pub create_ms: u64,
    /// 最后修改人 ID
    pub updater_id: u64,
    /// 最后修改时间戳（毫秒）
    pub update_ms: u64,
}
