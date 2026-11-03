use crate::dto::{AdmAppAddDto, AdmAppModifyDto};
use crate::svc::next_sort_order;
use robotech::macros::svc;

/// # 应用服务
///
/// 排序值由服务端维护：新增取同一领域 `max(sort_order) + 1`，修改时忽略客户端传入值。
#[svc(
    before_add = fill_app_sort_order_on_add,
    before_modify = ignore_app_sort_order_on_modify
)]
pub struct AdmAppSvc;

pub async fn fill_app_sort_order_on_add<C>(
    mut dto: AdmAppAddDto,
    db: &C,
) -> Result<AdmAppAddDto, SvcError>
where
    C: ConnectionTrait + Sync,
{
    let next = next_sort_order(
        db,
        "adm_app",
        Some("realm_id"),
        dto.realm_id.flatten().map(|value| value.value() as i64),
    )
    .await?;
    dto.sort_order = Some(next);
    Ok(dto)
}

pub async fn ignore_app_sort_order_on_modify<C>(
    mut dto: AdmAppModifyDto,
    _db: &C,
) -> Result<AdmAppModifyDto, SvcError>
where
    C: ConnectionTrait + Sync,
{
    dto.sort_order = None;
    Ok(dto)
}
