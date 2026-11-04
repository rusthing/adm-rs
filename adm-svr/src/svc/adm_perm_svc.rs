use robotech::macros::sortable;

/// # 权限服务
///
/// 排序值由服务端维护：新增取同一分组 `max(sort_order) + 1`；修改时忽略客户端传入值，
/// 改分组时新分组追加末尾、旧分组后续记录前移；删除后同分组后续记录前移，
/// 批量删除只对出现空洞的分组整组重算。
#[sortable(
    kind = "flat",
    spec = "crate::svc::SORT_PERM",
    group = "group_id"
)]
pub struct AdmPermSvc;
