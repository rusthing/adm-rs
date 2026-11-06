use robotech::macros::dic;
use strum::{AsRefStr, Display, EnumString};

/// # 数据范围（历史遗留字典，当前未启用）
///
/// 骨架阶段设想的 `adm_role.data_scope` 列，该列已从模型和建表脚本中移除，
/// 没有任何 DTO / VO / DAO 引用本枚举，保留仅为兼容早期文档，不要在新代码里使用。
///
/// **当前口径**：角色的可见范围由 `adm_role_realm_scope` / `adm_role_org_scope` /
/// `adm_role_app_scope` 三张白名单表表达（领域 / 组织 / 应用三条独立轴，
/// 配了才限制、多角色取并集），由 `robotech::dao::DataScope` 在 DAO 层强制注入；
/// 功能权限仍由 `adm_role_menu` / `adm_role_perm` 决定。
///
/// 取值顺序按**范围由大到小**排列，方便前端按 `value` 升序展示。
///
/// 声明 `default` 是 `#[dic]` 用于 VO 字段时的要求（历史原因）。
#[dic(default = All)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, AsRefStr, Display, EnumString)]
#[strum(serialize_all = "kebab-case")]
pub enum DataScope {
    /// 全部数据
    All = 1,
    /// 指定部门
    CustomDept = 2,
    /// 本部门及下级部门
    DeptAndChildren = 3,
    /// 仅本部门
    DeptOnly = 4,
    /// 仅本人
    SelfOnly = 5,
}
