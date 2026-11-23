//! # 人员类型 VO
//!
//! 选项值来自旧 ADM 字典 DTW_LOCATION_LOGO_TYPE 的人员项（VALUE 0-3）。
//! 人员档案只存 `value`，不存字典主键。

use robotech::macros::vo;

#[vo]
pub struct AdmPersonTypeVo {
    /// 主键
    pub id: u64,
    /// 编码
    /// 与旧字典项 CODE 一致（INTERNAL_EMPLOYEES 等）
    /// @len 1..=50
    /// @check is_code
    pub code: String,
    /// 名称
    /// @len 1..=50
    pub name: String,
    /// 值
    /// 人员档案的 person_type 存这个值
    /// @range 0..=999
    pub value: i16,
    /// 备注
    /// @len 0..=50
    pub remark: Option<String>,
    /// 是否启用
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
