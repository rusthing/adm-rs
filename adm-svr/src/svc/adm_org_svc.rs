use crate::dto::{AdmOrgAddDto, AdmOrgModifyDto, AdmOrgQueryDto};
use robotech::macros::svc;

// 排序钩子：新增按父末尾生成编码、改父重算两组、删除后同父后续前移
crate::tree_sort_hooks!(
    "adm_org",
    None,
    AdmOrgAddDto,
    AdmOrgModifyDto,
    AdmOrgQueryDto,
    AdmOrgVo,
    |_dto: &AdmOrgAddDto| None,
    |_dto: &AdmOrgModifyDto| None,
    |dto: &AdmOrgModifyDto| dto
        .parent_code
        .as_ref()
        .map(|value| value.clone().unwrap_or_default()),
    |_vo: &AdmOrgVo| None
);

/// # 组织服务
///
/// 框架 CRUD 之外维护树编码：**新增时生成树编码**（父节点追加末位）、
/// **修改时忽略客户端传入的树编码**，父节点变化时旧父下后续兄弟前移、新父下追加末位，
/// 整棵子树级联改编码；删除后同父后续兄弟前移。
///
/// 组织树全局一棵，没有隔离条件。排序值（tree_code）只由服务端维护，
/// 调整同级顺序走重排接口。
#[svc(
    before_add = sort_hooks_add,
    before_modify = sort_hooks_modify,
    after_del_by_id = sort_hooks_after_del_by_id,
    after_del_by_query_dto = sort_hooks_after_del_by_query_dto
)]
pub struct AdmOrgSvc;
