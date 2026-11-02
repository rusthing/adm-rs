//! # 菜单 DTO
//!
//! 前端动态路由的数据源：一棵树 + 组件路径 + 权限点
//! 目录与菜单的区别由 component 是否为空推导，不用单独的类型列
//!
//! 校验标签：`@len` / `@range` 是结构约束，`@check is_xxx` 调
//! `wheel_rs::regex_utils` 的谓词做语义校验（能带校验位），`@unit` 只是单位说明。

use robotech::macros::crud_dto;

#[crud_dto]
pub struct AdmMenuDto {
    /// 所属应用 ID
    /// 关联 app；菜单树按应用隔离，tree_code 只在本应用内唯一
    pub app_id: u64,
    /// 树编码
    /// 路径枚举存树：字典序即树的前序，子节点紧跟在父节点之后，排序直接用 ORDER BY tree_code，不需要额外排序列
    /// 每层固定 3 位数字（不足左补 0），不加分隔符：001 → 001002 → 001002003
    /// 总长 = 层数 × 3（必须是 3 的倍数）；列宽 30 即最多 10 层，每层最多 999 个兄弟
    /// 中间插入按 010、020、030 递增留空位；调整顺序 = 改编码，会级联该节点整棵子树
    /// 新增可不传：服务端按 parentCode 在本应用内生成下一个可用编码；显式传入（导入/预置数据）时以传入为准
    /// @len 3..=30
    /// @check is_tree_code
    #[fill_by_svc]
    pub tree_code: String,
    /// 父节点编码
    /// 生成 treeCode 的依据：根节点不传（或传 null），子节点传父节点的树编码
    /// 显式传了 treeCode 时本字段被忽略
    /// @check is_tree_code
    #[req_only]
    pub parent_code: Option<String>,
    /// 编码
    /// 同一应用内唯一（AK）；前端用作路由 name（编程式跳转、keep-alive 的 include 键）
    /// 不能用 tree_code 代替：菜单一移动编码就变，书签与 router.push({name}) 会断
    /// @len 1..=50
    /// @check is_code
    pub code: String,
    /// 名称
    /// 同一应用内唯一（AK），展示用
    /// @len 1..=50
    pub name: String,
    /// 路径
    /// 内链存路由路径（以 / 开头）；外链与 iframe 存完整 URL
    /// 目录节点同样存自己的路由前缀，用于拼子节点路径
    /// @len 1..=100
    pub path: String,
    /// 组件路径
    /// 内链菜单的前端组件相对路径；为空表示目录节点（不产出组件路由，只用于分组）
    /// @len 0..=200
    pub component: Option<String>,
    /// 链接类型
    /// 1-内链（默认，path 存路由路径，component 存组件路径）
    /// 2-外链（path 存完整 URL，component 为空）
    /// 3-内嵌 iframe（path 存完整 URL，component 为空）
    /// @range 1..=3
    /// link_type 为 2/3 时 path 存完整 URL，此时对 path 校验
    #[db_default]
    pub link_type: i16,
    /// 图标
    /// 前端图标名（如 SettingOutlined），目录与菜单使用
    /// @len 0..=50
    pub icon: Option<String>,
    /// 是否缓存
    /// 前端页面是否 keep-alive，列表页一般 true，详情/编辑页 false
    #[db_default]
    pub keep_alive: bool,
    /// 是否显示
    /// false 时不在导航中渲染，但路由仍然可访问（详情页、编辑页等隐藏页）
    /// 与 enabled 的区别：enabled=false 是整节点（含子节点）下架
    #[db_default]
    pub visible: bool,
    /// 备注
    /// @len 0..=50
    pub remark: Option<String>,
    /// 是否启用
    /// false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
    /// 与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用
    #[db_default]
    pub enabled: bool,
}
