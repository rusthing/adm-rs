use crate::dto::{AdmRoleGroupAddDto, AdmRoleGroupModifyDto, AdmRoleGroupQueryDto};
use robotech::macros::svc;

// 排序钩子：新增按父末尾生成编码、改父重算两组、删除后同父后续前移
crate::tree_sort_hooks!(
    "adm_role_group",
    Some("realm_id"),
    AdmRoleGroupAddDto,
    AdmRoleGroupModifyDto,
    AdmRoleGroupQueryDto,
    AdmRoleGroupVo,
    |dto: &AdmRoleGroupAddDto| dto.realm_id.map(|value| value.value() as i64),
    |dto: &AdmRoleGroupModifyDto| dto.realm_id.map(|value| value.value() as i64),
    |dto: &AdmRoleGroupModifyDto| dto
        .parent_code
        .as_ref()
        .map(|value| value.clone().unwrap_or_default()),
    |vo: &AdmRoleGroupVo| Some(vo.realm_id.value() as i64)
);

/// # 角色分组服务
///
/// 框架 CRUD 之外维护树编码：**新增时生成树编码**（领域内皮父节点追加末位）、
/// **修改时忽略客户端传入的树编码**，父节点或所属领域变化时旧父下后续兄弟前移、
/// 新父下追加末位，整棵子树级联改编码；删除后同父后续兄弟前移。
///
/// 分组树按领域隔离：`(realm_id, tree_code)` 唯一，生成编码时同样按领域取最大值。
/// 排序值（tree_code）只由服务端维护，调整顺序走重排接口。
#[svc(
    before_add = sort_hooks_add,
    before_modify = sort_hooks_modify,
    after_del_by_id = sort_hooks_after_del_by_id,
    after_del_by_query_dto = sort_hooks_after_del_by_query_dto
)]
pub struct AdmRoleGroupSvc;
