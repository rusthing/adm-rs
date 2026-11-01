//! # 选项（字典） VO
//!
//! 一组选项用同一个 code 归集（如 user_status），每个可选值一行

use robotech::macros::vo;

#[vo]
pub struct AdmOptionVo {
    /// 主键
    pub id: u64,
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
    /// 创建人 ID
    pub creater_id: u64,
    /// 创建时间戳（毫秒）
    pub create_ms: u64,
    /// 最后修改人 ID
    pub updater_id: u64,
    /// 最后修改时间戳（毫秒）
    pub update_ms: u64,
}
