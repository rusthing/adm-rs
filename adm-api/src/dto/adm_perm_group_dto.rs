//! # 权限分组 DTO
//!
//! 按领域隔离的两级结构（分组 → 权限），树形由 tree_code 表达
//!
//! 校验标签：`@len` / `@range` 是结构约束，`@check is_xxx` 调
//! `wheel_rs::regex_utils` 的谓词做语义校验（能带校验位），`@unit` 只是单位说明。

use robotech::macros::crud_dto;

#[crud_dto]
pub struct AdmPermGroupDto {
    /// 领域 ID
    /// 关联 realm；分组的 (realm_id, tree_code) 唯一，权限树按领域隔离
    pub realm_id: u64,
    /// 树编码
    /// 路径枚举存树：字典序即树的前序，子节点紧跟在父节点之后，排序直接用 ORDER BY tree_code，不需要额外排序列
    /// 每层固定 3 位数字（不足左补 0），不加分隔符：001 → 001002 → 001002003
    /// 总长 = 层数 × 3（必须是 3 的倍数）；列宽 30 即最多 10 层，每层最多 999 个兄弟
    /// 中间插入按 010、020、030 递增留空位；调整顺序 = 改编码，会级联该节点整棵子树
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
    #[db_default]
    pub enabled: bool,
}
