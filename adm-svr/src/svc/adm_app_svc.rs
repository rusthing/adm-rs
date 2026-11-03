use crate::dto::{AdmAppAddDto, AdmAppModifyDto, AdmAppQueryDto};
use robotech::macros::svc;

// 排序钩子：新增取同领域末尾、改分组重算两组、删除后同领域后续前移
crate::flat_sort_hooks!(
    "adm_app",
    Some("realm_id"),
    AdmAppAddDto,
    AdmAppModifyDto,
    AdmAppQueryDto,
    AdmAppVo,
    |dto: &AdmAppAddDto| dto.realm_id.flatten().map(|value| value.value() as i64),
    |dto: &AdmAppModifyDto| dto
        .realm_id
        .map(|value| value.map(|value| value.value() as i64)),
    |vo: &AdmAppVo| vo.realm_id.map(|value| value.value() as i64)
);

/// # 应用服务
///
/// 排序值由服务端维护：新增取同一领域 `max(sort_order) + 1`；修改时忽略客户端传入值，
/// 改 `realm_id`（含改为空）时新领域追加末尾、旧领域后续记录前移；删除后同领域
/// 后续记录前移，批量删除只对出现空洞的领域整组重算。
#[svc(
    before_add = sort_hooks_add,
    before_modify = sort_hooks_modify,
    after_del_by_id = sort_hooks_after_del_by_id,
    after_del_by_query_dto = sort_hooks_after_del_by_query_dto
)]
pub struct AdmAppSvc;
