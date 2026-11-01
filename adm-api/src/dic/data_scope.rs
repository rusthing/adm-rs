use robotech::macros::dic;
use strum::{AsRefStr, Display, EnumString};

/// # 数据范围
///
/// 对应 `adm_role.data_scope`，描述「这个角色能看到哪些数据」。骨架阶段只落库、
/// 由业务侧自行翻译成查询条件（例如在检索参数里补一个部门条件）。
///
/// 取值顺序按**范围由大到小**排列，方便前端按 `value` 升序展示。
///
/// 被 `AdmRoleVo` 用作字段，所以必须声明 `default`。
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
