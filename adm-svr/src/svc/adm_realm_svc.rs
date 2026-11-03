use crate::dto::{AdmRealmAddDto, AdmRealmModifyDto, AdmRealmQueryDto};
use robotech::macros::svc;

// 排序钩子：新增取全表末尾、删除后后续记录前移
crate::flat_sort_hooks!(
    "adm_realm",
    None,
    AdmRealmAddDto,
    AdmRealmModifyDto,
    AdmRealmQueryDto,
    AdmRealmVo,
    |_dto: &AdmRealmAddDto| None,
    |_dto: &AdmRealmModifyDto| None,
    |_vo: &AdmRealmVo| None
);

/// # 领域服务
///
/// 排序值由服务端维护：新增取全表 `max(sort_order) + 1`；修改时忽略客户端传入值；
/// 删除后后续记录前移，批量删除只对出现空洞的整组重算。
#[svc(
    before_add = sort_hooks_add,
    before_modify = sort_hooks_modify,
    after_del_by_id = sort_hooks_after_del_by_id,
    after_del_by_query_dto = sort_hooks_after_del_by_query_dto
)]
pub struct AdmRealmSvc;
