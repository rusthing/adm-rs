use crate::dto::{AdmOpTypeAddDto, AdmOpTypeModifyDto, AdmOpTypeQueryDto};
use robotech::macros::svc;

// 排序钩子：新增取全表末尾、删除后后续记录前移
crate::flat_sort_hooks!(
    "adm_op_type",
    None,
    AdmOpTypeAddDto,
    AdmOpTypeModifyDto,
    AdmOpTypeQueryDto,
    AdmOpTypeVo,
    |_dto: &AdmOpTypeAddDto| None,
    |_dto: &AdmOpTypeModifyDto| None,
    |_vo: &AdmOpTypeVo| None
);

/// # 操作类型服务
///
/// 排序值由服务端维护：新增取全表 `max(sort_order) + 1`；修改时忽略客户端传入值；
/// 删除后后续记录前移，批量删除只对出现空洞的整组重算。
#[svc(
    before_add = sort_hooks_add,
    before_modify = sort_hooks_modify,
    after_del_by_id = sort_hooks_after_del_by_id,
    after_del_by_query_dto = sort_hooks_after_del_by_query_dto
)]
pub struct AdmOpTypeSvc;
