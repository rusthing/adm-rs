//! # 菜单 DTO
//!
//! 菜单是一棵树：`parent_id` 为空表示根节点。树形结构由服务端在写操作前校验
//! （父节点必须存在、不能把自己挂到自己下面），前端只负责按 `parent_id` 组装。
//!
//! `code` 是权限编码的**唯一来源**：`perm` 可以空（目录、分组节点没有权限点），
//! 但 `code` 不允许空，否则前端无法稳定地按编码渲染。

use crate::dic::MenuType;
use robotech::macros::crud_dto;

#[crud_dto]
pub struct AdmMenuDto {
    /// 父菜单ID（空表示根节点）
    pub parent_id: Option<u64>,
    /// 菜单编码（唯一，建议 `system:user:list` 这种冒号分段）
    /// @len 1..=100
    pub code: String,
    /// 菜单名称
    /// @len 1..=50
    pub name: String,
    /// 菜单类型
    #[db_default]
    pub menu_type: MenuType,
    /// 前端路由路径（目录与菜单使用，按钮留空）
    /// @len 0..=200
    pub path: Option<String>,
    /// 前端组件路径（菜单使用，目录与按钮留空）
    /// @len 0..=200
    pub component: Option<String>,
    /// 权限标识（按钮与菜单使用，目录留空）
    /// @len 0..=100
    pub perm: Option<String>,
    /// 图标
    /// @len 0..=50
    pub icon: Option<String>,
    /// 排序（升序，值小的靠前）
    /// @range 0..=9999
    #[db_default]
    pub sort: i32,
    /// 是否在侧边栏显示（按钮节点恒为 false，由服务端按类型规整）
    #[db_default]
    pub visible: bool,
    /// 启用
    #[db_default]
    pub enabled: bool,
    /// 备注
    /// @len 0..=200
    pub remark: Option<String>,
}
