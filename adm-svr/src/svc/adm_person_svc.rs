use crate::dto::{AdmPersonModifyDto, AdmPersonSaveDto, AdmPersonSyncDto};
use crate::utils::normalize_id_card;
use robotech::macros::svc;

/// # 人员（自然人）服务
///
/// 批量查询返回 `AdmPersonListVo`：姓名、手机号、邮箱、身份证四个可定位
/// 个人的字段只出遮蔽结果；单条详情继续用 `AdmPersonVo` 回显原值。
///
/// `SyncDto` / `ModifyDto` / `SaveDto` 的字段级 `validate` 被框架刻意去掉，
/// 所以身份证格式在服务层再校验一次；`AddDto` 仍由 DTO 自带的
/// `@check is_id_card_cn` 兜底。
#[svc(
    list_vo = AdmPersonListVo,
    before_modify = validate_id_card_on_modify,
    before_save = validate_id_card_on_save,
    before_sync = validate_id_card_on_sync
)]
pub struct AdmPersonSvc;

/// # 修改人员前校验身份证
pub async fn validate_id_card_on_modify<C>(
    mut dto: AdmPersonModifyDto,
    _db: &C,
) -> Result<AdmPersonModifyDto, SvcError>
where
    C: ConnectionTrait,
{
    dto.id_card = normalize_id_card(dto.id_card)?;
    Ok(dto)
}

/// # 保存（upsert）人员前校验身份证
pub async fn validate_id_card_on_save(
    mut dto: AdmPersonSaveDto,
) -> Result<AdmPersonSaveDto, SvcError> {
    dto.id_card = normalize_id_card(dto.id_card)?;
    Ok(dto)
}

/// # 同步人员前校验身份证
///
/// `/sync` 是 CDC 的复制入口，源端脏数据不能靠数据库列类型兜住；
/// 校验失败会返回 `result<0`，同步任务按 fatal 进死信留痕。
pub async fn validate_id_card_on_sync<C>(
    mut dto: AdmPersonSyncDto,
    _db: &C,
) -> Result<AdmPersonSyncDto, SvcError>
where
    C: ConnectionTrait,
{
    dto.id_card = normalize_id_card(dto.id_card)?;
    Ok(dto)
}
