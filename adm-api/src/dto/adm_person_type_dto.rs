//! # 人员类型 DTO
//!
//! 选项值来自旧 ADM 字典 DTW_LOCATION_LOGO_TYPE 的人员项（VALUE 0-3）。
//! 人员档案只存 `value`，不存字典主键。

use robotech::macros::crud_dto;

#[crud_dto]
pub struct AdmPersonTypeDto {
    /// 编码
    /// 与旧字典项 CODE 一致（INTERNAL_EMPLOYEES 等），全局唯一（AK）
    /// @len 1..=50
    /// @check is_code
    pub code: String,
    /// 名称
    /// 全局唯一（AK）
    /// @len 1..=50
    pub name: String,
    /// 值
    /// 人员档案的 person_type 存这个值；全局唯一（AK）
    /// @range 0..=999
    pub value: i16,
    /// 备注
    /// @len 0..=50
    pub remark: Option<String>,
    /// 是否启用
    /// false 时不可再被选择，历史数据与关联全部保留
    #[db_default]
    pub enabled: bool,
}
