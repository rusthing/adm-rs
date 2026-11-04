use robotech::macros::sortable;

/// # 菜单服务
///
/// 框架 CRUD 之外维护树编码：**新增时生成树编码**（应用内皮父节点追加末位）、
/// **修改时忽略客户端传入的树编码**，父节点或所属应用变化时旧父下后续兄弟前移、
/// 新父下追加末位，整棵子树级联改编码；删除后同父后续兄弟前移。
///
/// 菜单树按应用隔离：`(app_id, tree_code)` 唯一，生成编码时同样按应用取最大值，
/// 两个应用互不挤占。排序值（tree_code）只由服务端维护，调整顺序走重排接口。
#[sortable(
    kind = "tree",
    spec = "crate::svc::SORT_MENU",
    scope = "app_id"
)]
pub struct AdmMenuSvc;
