use crate::dto::{AdmOrgTypeAddDto, AdmOrgTypeModifyDto};
use crate::svc::next_sort_order;
use robotech::macros::svc;

/// # 组织类型服务
///
/// 排序值由服务端维护：新增取全表 `max(sort_order) + 1`，修改时忽略客户端传入值。
#[svc(
    before_add = fill_org_type_sort_order_on_add,
    before_modify = ignore_org_type_sort_order_on_modify
)]
pub struct AdmOrgTypeSvc;

pub async fn fill_org_type_sort_order_on_add<C>(
    mut dto: AdmOrgTypeAddDto,
    db: &C,
) -> Result<AdmOrgTypeAddDto, SvcError>
where
    C: ConnectionTrait + Sync,
{
    dto.sort_order = Some(next_sort_order(db, "adm_org_type", None, None).await?);
    Ok(dto)
}

pub async fn ignore_org_type_sort_order_on_modify<C>(
    mut dto: AdmOrgTypeModifyDto,
    _db: &C,
) -> Result<AdmOrgTypeModifyDto, SvcError>
where
    C: ConnectionTrait + Sync,
{
    dto.sort_order = None;
    Ok(dto)
}
