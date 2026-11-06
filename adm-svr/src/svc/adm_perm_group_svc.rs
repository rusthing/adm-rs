use robotech::macros::sortable;

/// # 权限分组服务
///
/// 框架 CRUD 之外维护树编码：**新增时生成树编码**（全局树内父节点下追加末位）、
/// **修改时忽略客户端传入的树编码**，父节点变化时旧父下后续兄弟前移、
/// 新父下追加末位，整棵子树级联改编码；删除时同一事务内先删除全部子孙，
/// 再对同父剩余兄弟前移；子树内任一分组仍被权限引用时拒绝删除。
///
/// 权限分组是全局配置，与领域无关：全局只有一棵树，`tree_code` 全局唯一，
/// 生成编码时按全表取最大值。排序值（tree_code）只由服务端维护，调整顺序走重排接口。
#[sortable(
    kind = "tree",
    spec = "crate::svc::SORT_PERM_GROUP",
    guard = "crate::svc::perm_group_delete_guard"
)]
pub struct AdmPermGroupSvc;
