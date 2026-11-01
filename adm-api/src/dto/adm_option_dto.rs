//! # 选项（字典） DTO
//!
//! 一组选项用同一个 code 归集（如 user_status），每个可选值一行
//!
//! 校验标签：`@len` / `@range` 是结构约束，`@check is_xxx` 调
//! `wheel_rs::regex_utils` 的谓词做语义校验（能带校验位），`@unit` 只是单位说明。

use robotech::macros::crud_dto;

#[crud_dto]
pub struct AdmOptionDto {
    /// 编码
    /// 一组选项共用一个 code（如 user_status），全局唯一（AK）
    /// @len 1..=50
    /// @check is_code
    pub code: String,
    /// 名称
    /// 展示文案
    /// @len 1..=50
    pub name: String,
    /// 选项值
    /// 业务侧落库与判断时使用的值（字符串形式，如 "1"、"true"）；含义由所属 code 的约定决定
    pub value: String,
    /// 备注
    /// @len 0..=50
    pub remark: Option<String>,
}
