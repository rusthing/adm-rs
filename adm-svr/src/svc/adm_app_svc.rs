use robotech::macros::sortable;

/// # 应用服务
///
/// 排序值由服务端维护：新增取同一领域 `max(sort_order) + 1`；修改时忽略客户端传入值，
/// 改 `realm_id`（含改为空）时新领域追加末尾、旧领域后续记录前移；删除后同领域
/// 后续记录前移，批量删除只对出现空洞的领域整组重算。
#[sortable(
    kind = "flat",
    spec = "crate::svc::SORT_APP",
    group = "realm_id"
)]
pub struct AdmAppSvc;
