use crate::dic::MenuType;
use robotech::macros::vo;

/// # 菜单
///
/// 平铺返回，`parent_id` 交给前端组装成树 —— 服务端做树要额外定义一套带 `children`
/// 的 VO，而 `#[vo]` 只能映射实体，树形 VO 得手写，骨架阶段不引入这份复杂度。
#[vo]
pub struct AdmMenuVo {
    /// ID
    pub id: u64,
    /// 父菜单ID（空表示根节点）
    pub parent_id: Option<u64>,
    /// 菜单编码
    pub code: String,
    /// 菜单名称
    pub name: String,
    /// 菜单类型
    pub menu_type: MenuType,
    /// 前端路由路径
    pub path: Option<String>,
    /// 前端组件路径
    pub component: Option<String>,
    /// 权限标识
    pub perm: Option<String>,
    /// 图标
    pub icon: Option<String>,
    /// 排序
    pub sort: i32,
    /// 是否显示
    pub visible: bool,
    /// 启用
    pub enabled: bool,
    /// 备注
    pub remark: Option<String>,
    /// 创建者ID
    pub creater_id: u64,
    /// 创建时间
    pub create_ms: u64,
    /// 更新者ID
    pub updater_id: u64,
    /// 更新时间
    pub update_ms: u64,
}
