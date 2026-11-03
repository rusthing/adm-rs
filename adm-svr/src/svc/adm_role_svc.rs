use crate::dto::{AdmRoleAddDto, AdmRoleModifyDto, AdmRoleQueryDto};
use robotech::macros::svc;

// 排序钩子：新增取同分组末尾、改分组重算两组、删除后同分组后续前移
crate::flat_sort_hooks!(
    "adm_role",
    Some("group_id"),
    AdmRoleAddDto,
    AdmRoleModifyDto,
    AdmRoleQueryDto,
    AdmRoleVo,
    |dto: &AdmRoleAddDto| dto.group_id.map(|value| value.value() as i64),
    |dto: &AdmRoleModifyDto| dto.group_id.map(|value| Some(value.value() as i64)),
    |vo: &AdmRoleVo| Some(vo.group_id.value() as i64)
);

/// # 角色服务
///
/// 排序值由服务端维护：新增取同一分组 `max(sort_order) + 1`；修改时忽略客户端传入值，
/// 改分组时新分组追加末尾、旧分组后续记录前移；删除后同分组后续记录前移，
/// 批量删除只对出现空洞的分组整组重算。
#[svc(
    before_add = sort_hooks_add,
    before_modify = sort_hooks_modify,
    after_del_by_id = sort_hooks_after_del_by_id,
    after_del_by_query_dto = sort_hooks_after_del_by_query_dto
)]
pub struct AdmRoleSvc;
