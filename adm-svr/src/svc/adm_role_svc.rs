use crate::dto::{AdmRoleAddDto, AdmRoleModifyDto};
use crate::svc::next_sort_order;
use robotech::macros::svc;

/// # 角色服务
///
/// 排序值由服务端维护：新增取同一分组 `max(sort_order) + 1`，修改时忽略客户端传入值。
#[svc(
    before_add = fill_role_sort_order_on_add,
    before_modify = ignore_role_sort_order_on_modify
)]
pub struct AdmRoleSvc;

pub async fn fill_role_sort_order_on_add<C>(
    mut dto: AdmRoleAddDto,
    db: &C,
) -> Result<AdmRoleAddDto, SvcError>
where
    C: ConnectionTrait + Sync,
{
    let next = next_sort_order(
        db,
        "adm_role",
        Some("group_id"),
        dto.group_id.map(|value| value.value() as i64),
    )
    .await?;
    dto.sort_order = Some(next);
    Ok(dto)
}

pub async fn ignore_role_sort_order_on_modify<C>(
    mut dto: AdmRoleModifyDto,
    _db: &C,
) -> Result<AdmRoleModifyDto, SvcError>
where
    C: ConnectionTrait + Sync,
{
    dto.sort_order = None;
    Ok(dto)
}
