//! # 领域 VO
//!
//! 用户与组织的数据域划分单位：只用于界定用户/组织归属与角色的数据可见范围，
//! 与应用、菜单、角色、权限等全局配置无关
//! 一个组织/用户可以归属多个领域，关联见 realm_org / realm_user；角色的数据范围见 adm_role_scope

use robotech::macros::vo;

#[vo]
pub struct AdmRealmVo {
    /// 主键
    pub id: u64,
    /// 编码
    /// 全局唯一（AK），创建后不改：数据域与迁移脚本都按它定位领域
    /// @len 1..=50
    /// @check is_code
    pub code: String,
    /// 名称
    /// 全局唯一（AK），展示用
    /// @len 1..=50
    pub name: String,
    /// 排序值
    /// 越小越靠前，列表按 (sort_order, id) 升序
    /// @range 0..=9999
    pub sort_order: i32,
    /// 备注
    /// @len 0..=50
    pub remark: Option<String>,
    /// 是否启用
    /// false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
    /// 与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用
    pub enabled: bool,
    /// 创建人 ID
    pub creater_id: u64,
    /// 创建时间戳（毫秒）
    pub create_ms: u64,
    /// 最后修改人 ID
    pub updater_id: u64,
    /// 最后修改时间戳（毫秒）
    pub update_ms: u64,
}
