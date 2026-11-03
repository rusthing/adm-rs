use crate::dto::{AdmOpTypeAddDto, AdmOpTypeModifyDto};
use crate::svc::next_sort_order;
use robotech::macros::svc;

/// # 操作类型服务
///
/// 排序值由服务端维护：新增取全表 `max(sort_order) + 1`，修改时忽略客户端传入值。
#[svc(
    before_add = fill_op_type_sort_order_on_add,
    before_modify = ignore_op_type_sort_order_on_modify
)]
pub struct AdmOpTypeSvc;

pub async fn fill_op_type_sort_order_on_add<C>(
    mut dto: AdmOpTypeAddDto,
    db: &C,
) -> Result<AdmOpTypeAddDto, SvcError>
where
    C: ConnectionTrait + Sync,
{
    dto.sort_order = Some(next_sort_order(db, "adm_op_type", None, None).await?);
    Ok(dto)
}

pub async fn ignore_op_type_sort_order_on_modify<C>(
    mut dto: AdmOpTypeModifyDto,
    _db: &C,
) -> Result<AdmOpTypeModifyDto, SvcError>
where
    C: ConnectionTrait + Sync,
{
    dto.sort_order = None;
    Ok(dto)
}
