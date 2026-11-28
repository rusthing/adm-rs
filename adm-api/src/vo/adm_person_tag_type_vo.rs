//! # 人员标签类型 VO
//!
//! 人员标签（`adm_person.tags`）的分类口径：技能、岗位、安全等标签类型。
//! 标签本身仍按名称自由写入，字典是弱引用，不建外键。

use robotech::macros::vo;

#[vo]
pub struct AdmPersonTagTypeVo {
    /// 主键
    pub id: u64,
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
    /// 越小越靠前
    /// @range 0..=9999
    pub sort_order: i32,
    /// 备注
    /// @len 0..=50
    pub remark: Option<String>,
    /// 是否启用
    /// false 时不可再被选择，历史数据与关联全部保留
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
