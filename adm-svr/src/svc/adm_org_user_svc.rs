use crate::dto::AdmOrgUserSyncDto;
use crate::mo::adm_realm_org;
use robotech::dao::DaoError;
use robotech::macros::svc;
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};

// `SvcError`、`ConnectionTrait` 由 `#[svc]` 注入，这里不能重复 use（E0252）。

/// # 组织用户服务
///
/// 框架生成的 CRUD 之外，只挂一个 `before_sync`：旧库 `ADM_ORG_USER` 没有 `REALM_ID`
/// 列，dbz→syn 推过来的报文补不出领域，而新表 `realm_id` 非空。这里在 sync 写库前
/// 用 `org_id` 查新库的 `adm_realm_org`（组织↔领域绑定）把领域补上。
///
/// ## 为什么不改源端 / syn 映射
///
/// - 源库不让动；syn 映射是纯函数，没有查表 / 跨任务状态能力，补不出这个字段。
/// - `adm_realm_org` 已随 dbz→syn 同步进新库，且一个组织只属一个领域（无一对多），
///   以它为准能自动跟随组织领域关系的后续变更，不用在链路里写死映射。
///
/// ## 取不到时怎么办
///
/// 保持 `realm_id = None`，让 NOT NULL 约束把它挡进死信，而不是兜一个错误领域——
/// 静默写进错领域会让「按领域看组织成员」得到错数据，进死信至少能被发现。
#[svc(before_sync = fill_realm_id_on_sync)]
pub struct AdmOrgUserSvc;

/// # sync 写库前补领域
///
/// 只补 `realm_id` 缺失（None 或 0）的记录；syn 若已带合法值则原样放行，避免覆盖
/// 将来可能补齐的源端映射。查库走钩子的事务连接，与主写同事务。
pub async fn fill_realm_id_on_sync<C>(
    mut dto: AdmOrgUserSyncDto,
    db: &C,
) -> Result<AdmOrgUserSyncDto, SvcError>
where
    C: ConnectionTrait,
{
    let realm_missing = dto
        .realm_id
        .map(|v| v.value() == 0)
        .unwrap_or(true);
    if !realm_missing {
        return Ok(dto);
    }
    let Some(org_id) = dto.org_id else {
        return Ok(dto);
    };

    // 组织↔领域绑定：一个组织只属一个领域。万一出现多条，取最小 realm_id 保证
    // 结论确定（不同副本、不同重投批次补出同一个值），真正的一对多交给数据治理。
    let bindings = adm_realm_org::Entity::find()
        .filter(adm_realm_org::Column::OrgId.eq(org_id.value() as i64))
        .all(db)
        .await
        .map_err(DaoError::parse_db_err)?;
    if let Some(realm_id) = bindings.iter().map(|b| b.realm_id).min() {
        dto.realm_id = Some(realm_id.into());
    }
    Ok(dto)
}
