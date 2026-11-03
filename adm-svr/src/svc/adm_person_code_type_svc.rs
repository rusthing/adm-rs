use crate::dto::{AdmPersonCodeTypeAddDto, AdmPersonCodeTypeModifyDto};
use crate::svc::next_sort_order;
use robotech::macros::svc;

/// # 人员编码类型服务
///
/// 排序值由服务端维护：新增取全表 `max(sort_order) + 1`，修改时忽略客户端传入值。
#[svc(
    before_add = fill_person_code_type_sort_order_on_add,
    before_modify = ignore_person_code_type_sort_order_on_modify
)]
pub struct AdmPersonCodeTypeSvc;

pub async fn fill_person_code_type_sort_order_on_add<C>(
    mut dto: AdmPersonCodeTypeAddDto,
    db: &C,
) -> Result<AdmPersonCodeTypeAddDto, SvcError>
where
    C: ConnectionTrait + Sync,
{
    dto.sort_order = Some(next_sort_order(db, "adm_person_code_type", None, None).await?);
    Ok(dto)
}

pub async fn ignore_person_code_type_sort_order_on_modify<C>(
    mut dto: AdmPersonCodeTypeModifyDto,
    _db: &C,
) -> Result<AdmPersonCodeTypeModifyDto, SvcError>
where
    C: ConnectionTrait + Sync,
{
    dto.sort_order = None;
    Ok(dto)
}
