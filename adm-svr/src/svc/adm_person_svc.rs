use crate::dto::{AdmPersonAddDto, AdmPersonModifyDto, AdmPersonSaveDto, AdmPersonSyncDto};
use crate::utils::normalize_id_card;
use robotech::macros::svc;
use wheel_rs::pinyin_utils::name_pinyin;

/// 拼音列宽上限，与 `adm_person.name_pinyin_*` 的 VARCHAR(200) 对齐
const PINYIN_MAX_CHARS: usize = 200;

/// # 人员（自然人）服务
///
/// 批量查询返回 `AdmPersonListVo`：姓名、手机号、邮箱、身份证四个可定位
/// 个人的字段只出遮蔽结果；单条详情继续用 `AdmPersonVo` 回显原值。
///
/// 全拼 / 简拼两列不手工维护：`name_pinyin_custom = false`（默认）时新增和修改
/// 按姓名自动重算并覆盖请求值，`true` 时保留手工填写的值；`save` / `upsert`
/// 委托到 add / modify，同样生效。
///
/// `SyncDto` / `ModifyDto` / `SaveDto` 的字段级 `validate` 被框架刻意去掉，
/// 所以身份证格式在服务层再校验一次；`AddDto` 仍由 DTO 自带的
/// `@check is_id_card_cn` 兜底。
#[svc(
    list_vo = AdmPersonListVo,
    before_add = prepare_on_add,
    before_modify = prepare_on_modify,
    before_save = validate_id_card_on_save,
    before_sync = validate_id_card_on_sync
)]
pub struct AdmPersonSvc;

/// # 新增人员前补拼音
///
/// `name_pinyin_custom = true` 时保留调用方填写的简拼 / 全拼；否则按姓名
/// 重算，未传姓名时保持原样，由 `AddDto` 的必填校验兜底。
pub async fn prepare_on_add<C>(
    mut dto: AdmPersonAddDto,
    _db: &C,
) -> Result<AdmPersonAddDto, SvcError>
where
    C: ConnectionTrait,
{
    dto.name_pinyin_custom = fill_name_pinyin(
        dto.name.as_deref(),
        dto.name_pinyin_custom,
        &mut dto.name_pinyin_abbr,
        &mut dto.name_pinyin_full,
    );
    Ok(dto)
}

/// # 修改人员前校验身份证并补拼音
pub async fn prepare_on_modify<C>(
    mut dto: AdmPersonModifyDto,
    _db: &C,
) -> Result<AdmPersonModifyDto, SvcError>
where
    C: ConnectionTrait,
{
    dto.id_card = normalize_id_card(dto.id_card)?;
    dto.name_pinyin_custom = fill_name_pinyin(
        dto.name.as_deref(),
        dto.name_pinyin_custom,
        &mut dto.name_pinyin_abbr,
        &mut dto.name_pinyin_full,
    );
    Ok(dto)
}

/// # 按姓名写入拼音列
///
/// `custom` 为 `Some(true)` 时保留调用方填写的简拼 / 全拼，不重算；姓名为
/// `None`（请求没传这一列）时不动拼音。其余情况按姓名重算，并把标记明确
/// 落成 `false`，避免「标记为自定义、值却是自动生成」的错配。
fn fill_name_pinyin(
    name: Option<&str>,
    custom: Option<bool>,
    name_pinyin_abbr: &mut Option<Option<String>>,
    name_pinyin_full: &mut Option<Option<String>>,
) -> Option<bool> {
    if custom == Some(true) {
        return custom;
    }
    let Some(name) = name else {
        return custom;
    };
    let (abbr, full) = name_pinyin(name);
    *name_pinyin_abbr = Some(abbr.map(|value| truncate_chars(value, PINYIN_MAX_CHARS)));
    *name_pinyin_full = Some(full.map(|value| truncate_chars(value, PINYIN_MAX_CHARS)));
    Some(false)
}

/// 按字符数截断，避免超长的少数民族姓名把拼音列撑爆
fn truncate_chars(value: String, max: usize) -> String {
    if value.chars().count() <= max {
        return value;
    }
    value.chars().take(max).collect()
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
