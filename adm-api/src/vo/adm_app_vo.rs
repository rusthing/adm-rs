//! # 应用 VO
//!
//! 菜单树的归属单位，一个领域下可以有多个应用（后台、前台、移动端）

use robotech::macros::vo;

#[vo]
pub struct AdmAppVo {
    /// 主键
    pub id: u64,
    /// 归属领域 ID
    /// 关联 realm；为空表示跨领域通用应用
    pub realm_id: Option<u64>,
    /// 应用编码
    /// 全局唯一（AK），前端用它区分路由与请求来源
    /// @len 1..=50
    /// @check is_code
    pub code: String,
    /// 名称
    /// 全局唯一（AK）
    /// @len 1..=50
    pub name: String,
    /// 排序值
    /// 同一领域内排序，越小越靠前
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
