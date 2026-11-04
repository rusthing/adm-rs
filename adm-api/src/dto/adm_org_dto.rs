//! # 组织 DTO
//!
//! 树形结构由 tree_code 表达；与领域、用户都是多对多（realm_org / org_user），组织本身不自带领域列
//!
//! 校验标签：`@len` / `@range` 是结构约束，`@check is_xxx` 调
//! `wheel_rs::regex_utils` 的谓词做语义校验（能带校验位），`@unit` 只是单位说明。

use robotech::macros::crud_dto;

#[crud_dto]
pub struct AdmOrgDto {
    /// 组织编码
    /// 全局唯一（AK），业务上用于对接外部系统
    /// @len 1..=50
    /// @check is_code
    pub code: Option<String>,
    /// 树编码
    /// 路径枚举存树：字典序即树的前序，子节点紧跟在父节点之后，排序直接用 ORDER BY tree_code，不需要额外排序列
    /// 每层固定 3 位数字（不足左补 0），不加分隔符：001 → 001002 → 001002003
    /// 总长 = 层数 × 3（必须是 3 的倍数）；列宽 30 即最多 10 层，每层最多 999 个兄弟
    /// 新增/移动一律取同父下 max+1 追加到末尾，不留中间空位；重排接口按提交顺序重算为 001..n
    /// 调整顺序 = 改编码，会级联该节点整棵子树
    /// 该字段由服务端维护：新增时按 parentCode 生成，客户端传入值一律忽略
    /// @len 3..=30
    /// @check is_tree_code
    #[fill_by_svc]
    pub tree_code: String,
    /// 父节点编码
    /// 生成 treeCode 的依据：根节点不传（或传 null），子节点传父节点的树编码
    /// 该字段始终参与编码生成（treeCode 本身不接受客户端传值）
    /// @check is_tree_code
    #[req_only]
    pub parent_code: Option<String>,
    /// 名称
    /// 同一父节点下的兄弟名称不做唯一约束（同名部门很常见），只靠 tree_code 区分
    /// @len 1..=50
    pub name: String,
    /// 全名
    /// 从根到当前节点的名称拼接，层间用 "." 分隔（如 集团.分厂.车间）
    /// 全局唯一（AK）；由 tree_code 维护时同步生成，只用于展示与模糊搜索
    /// @len 0..=200
    pub full_name: Option<String>,
    /// 组织类型 ID
    /// 关联 org_type；为空表示未分类
    pub org_type_id: Option<u64>,
    /// 备注
    /// @len 0..=50
    pub remark: Option<String>,
    /// 是否启用
    /// false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
    /// 与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用
    #[db_default]
    pub enabled: bool,
}
