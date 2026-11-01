//! # 领域 DTO
//!
//! 权限与数据隔离的顶层单位：用户、组织、角色分组、权限分组都按领域隔离
//! 一个组织/用户可以归属多个领域，关联见 realm_org / realm_user
//!
//! 校验标签：`@len` / `@range` 是结构约束，`@check is_xxx` 调
//! `wheel_rs::regex_utils` 的谓词做语义校验（能带校验位），`@unit` 只是单位说明。

use robotech::macros::crud_dto;

#[crud_dto]
pub struct AdmRealmDto {
    /// 编码
    /// 全局唯一（AK），创建后不改：数据隔离与迁移脚本都按它定位领域
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
    #[db_default]
    pub enabled: bool,
}
