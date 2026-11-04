use robotech::macros::sortable;

/// # 人员编码类型服务
///
/// 排序值由服务端维护：新增取全表 `max(sort_order) + 1`；修改时忽略客户端传入值；
/// 删除后后续记录前移，批量删除只对出现空洞的整组重算。
#[sortable(kind = "flat", spec = "crate::svc::SORT_PERSON_CODE_TYPE")]
pub struct AdmPersonCodeTypeSvc;
