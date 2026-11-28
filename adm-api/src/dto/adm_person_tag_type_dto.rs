//! # 人员标签类型 DTO
//!
//! 人员标签（`adm_person.tags`）的分类口径：技能、岗位、安全等标签类型。
//! 标签本身仍按名称自由写入，字典是弱引用，不建外键。
//!
//! 校验标签：`@len` / `@range` 是结构约束，`@check is_xxx` 调
//! `wheel_rs::regex_utils` 的谓词做语义校验，`@unit` 只是单位说明。

use robotech::macros::crud_dto;

#[crud_dto]
pub struct AdmPersonTagTypeDto {
    /// 编码
    /// 标签类型编码，全局唯一（AK）
    /// @len 1..=50
    /// @check is_code
    pub code: String,
    /// 名称
    /// 标签类型名称，全局唯一（AK）
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
    /// false 时不可再被选择，历史数据与关联全部保留
    #[db_default]
    pub enabled: bool,
}
