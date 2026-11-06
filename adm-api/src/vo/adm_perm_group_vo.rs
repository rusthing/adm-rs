//! # 权限分组 VO
//!
//! 全局两级结构（分组 → 权限），树形由 tree_code 表达，tree_code 全局唯一

use robotech::macros::vo;

#[vo]
pub struct AdmPermGroupVo {
    /// 主键
    pub id: u64,
    /// 树编码
    /// 路径枚举存树：字典序即树的前序，子节点紧跟在父节点之后，排序直接用 ORDER BY tree_code，不需要额外排序列
    /// 每层固定 3 位数字（不足左补 0），不加分隔符：001 → 001002 → 001002003
    /// 总长 = 层数 × 3（必须是 3 的倍数）；列宽 30 即最多 10 层，每层最多 999 个兄弟
    /// 新增/移动一律取同父下 max+1 追加到末尾，不留中间空位；重排接口按提交顺序重算为 001..n
    /// 调整顺序 = 改编码，会级联该节点整棵子树
    /// @len 3..=30
    /// @check is_tree_code
    pub tree_code: String,
    /// 名称
    /// 同一父节点下的兄弟名称不做唯一约束，靠 tree_code 区分
    /// @len 1..=50
    pub name: String,
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
