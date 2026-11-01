//! # 人员编码类型 VO
//!
//! 有工号、学号等

use robotech::macros::vo;

#[vo]
pub struct AdmPersonCodeTypeVo {
    /// 主键
    pub id: u64,
    /// 名称
    /// 全局唯一（AK），如「工号」「学号」
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
