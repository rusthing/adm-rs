//! # 组织类型 DTO
//!
//! 有GROUP(集团)、UNIT(政府单位)、CORP(公司)、MILITARY(军)、DEPT(部门)、BRANCH_FACTORY(分厂)、DIRECTLY_BRIGADE(直属旅)、BRIGADE(旅)、TEAM(小组)、CLASSES(班级)等
//!
//! 校验标签：`@len` / `@range` 是结构约束，`@check is_xxx` 调
//! `wheel_rs::regex_utils` 的谓词做语义校验（能带校验位），`@unit` 只是单位说明。

use robotech::macros::crud_dto;

#[crud_dto]
pub struct AdmOrgTypeDto {
    /// 编码
    /// 业务编号，允许字母、数字与 _ . -（如 SYS_ADMIN、GROUP_HQ）
    /// @len 1..=50
    /// @check is_code
    pub code: String,
    /// 名称
    /// 全局唯一（AK）
    /// @len 1..=50
    pub name: String,
    /// 排序值
    /// 越小越靠前；由服务端自动分配，前端不可提交
    /// @range 0..=9999
    #[fill_by_svc]
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
