use robotech::macros::sortable;

/// # 应用服务
///
/// 排序值由服务端维护：新增取全表 `max(sort_order) + 1`；修改时忽略客户端传入值；
/// 删除后后续记录前移，批量删除只对出现空洞的整表重算。
/// 应用是全局配置，与领域无关，排序不按领域分组。
#[sortable(
    kind = "flat",
    spec = "crate::svc::SORT_APP"
)]
pub struct AdmAppSvc;
