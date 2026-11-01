use robotech::macros::svc;

/// # 选项（字典）服务
///
/// 写操作提交后立即重建选项缓存快照（[`crate::utils::refresh_adm_option_cache`]）：
/// 改完登录锁定阈值，下一次登录就要按新值判，不能等定时刷新。
///
/// `save` 与 `get_*` / `search_*` 不在 `after_write` 的覆盖范围内——框架只在
/// add / modify / del_by_id / del_by_query_dto 后触发它。用 `save` 改选项时
/// 靠定时兜底刷新收敛（默认 60 秒），改配置这种低频操作不值得为它再挂一个钩子。
#[svc(after_write = crate::utils::refresh_adm_option_cache)]
pub struct AdmOptionSvc;
