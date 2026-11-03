use crate::dto::{AdmRealmAddDto, AdmRealmModifyDto};
use crate::svc::next_sort_order;
use robotech::macros::svc;

/// # 领域服务
///
/// 排序值由服务端维护：新增取全表 `max(sort_order) + 1`，修改时忽略客户端传入值。
#[svc(
    before_add = fill_realm_sort_order_on_add,
    before_modify = ignore_realm_sort_order_on_modify
)]
pub struct AdmRealmSvc;

pub async fn fill_realm_sort_order_on_add<C>(
    mut dto: AdmRealmAddDto,
    db: &C,
) -> Result<AdmRealmAddDto, SvcError>
where
    C: ConnectionTrait + Sync,
{
    dto.sort_order = Some(next_sort_order(db, "adm_realm", None, None).await?);
    Ok(dto)
}

pub async fn ignore_realm_sort_order_on_modify<C>(
    mut dto: AdmRealmModifyDto,
    _db: &C,
) -> Result<AdmRealmModifyDto, SvcError>
where
    C: ConnectionTrait + Sync,
{
    dto.sort_order = None;
    Ok(dto)
}
