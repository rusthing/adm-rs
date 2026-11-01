use robotech::macros::dic;
use strum::{AsRefStr, Display, EnumString};

/// # 菜单类型
///
/// 对应 `adm_menu.menu_type`。三种类型共用一张表，是因为它们在前端是同一棵树上的
/// 节点，拆表会让「目录 → 菜单 → 按钮」的父子关系跨表，排序与授权都要做三次 join。
///
/// 被 `AdmMenuVo` 用作字段，所以必须声明 `default`。
#[dic(default = Menu)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, AsRefStr, Display, EnumString)]
#[strum(serialize_all = "kebab-case")]
pub enum MenuType {
    /// 目录（只用于分组，自身不可点击）
    Directory = 1,
    /// 菜单（对应一个页面路由）
    Menu = 2,
    /// 按钮（页面内的操作点，只承载权限编码）
    Button = 3,
}
