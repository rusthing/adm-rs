use robotech::macros::sortable;

/// # 组织服务
///
/// 框架 CRUD 之外维护树编码：**新增时生成树编码**（父节点追加末位）、
/// **修改时忽略客户端传入的树编码**，父节点变化时旧父下后续兄弟前移、新父下追加末位，
/// 整棵子树级联改编码；删除后同父后续兄弟前移。
///
/// 组织树全局一棵，没有隔离条件。排序值（tree_code）只由服务端维护，
/// 调整同级顺序走重排接口。
#[sortable(kind = "tree", spec = "crate::svc::SORT_ORG")]
pub struct AdmOrgSvc;
