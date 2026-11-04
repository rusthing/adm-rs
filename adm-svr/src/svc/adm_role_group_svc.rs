use robotech::macros::sortable;

/// # 角色分组服务
///
/// 框架 CRUD 之外维护树编码：**新增时生成树编码**（领域内皮父节点追加末位）、
/// **修改时忽略客户端传入的树编码**，父节点或所属领域变化时旧父下后续兄弟前移、
/// 新父下追加末位，整棵子树级联改编码；删除时同一事务内先删除全部子孙，
/// 再对同父剩余兄弟前移；子树内任一分组仍被角色引用时拒绝删除。
///
/// 分组树按领域隔离：`(realm_id, tree_code)` 唯一，生成编码时同样按领域取最大值。
/// 排序值（tree_code）只由服务端维护，调整顺序走重排接口。
#[sortable(
    kind = "tree",
    spec = "crate::svc::SORT_ROLE_GROUP",
    scope = "realm_id",
    guard = "crate::svc::role_group_delete_guard"
)]
pub struct AdmRoleGroupSvc;
