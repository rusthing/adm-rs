use crate::api_client::adm_menu_api_client::AdmMenuApiClient;
use crate::api_client::adm_role_api_client::AdmRoleApiClient;
use crate::api_client::adm_user_api_client::AdmUserApiClient;
use robotech::macros::api_client;

/// # 管理后台客户端
///
/// 把三组 CRUD 客户端收在一个结构里，调用方只需要持有 [`AdmApiClient`] 一个实例，
/// 不必逐个初始化。初始化与热更新由 `#[api_client]` 生成的
/// `setup_adm_api_client` / `get_adm_api_client` 负责。
#[api_client]
pub struct AdmApiClient {
    /// 用户
    pub user: AdmUserApiClient,
    /// 角色
    pub role: AdmRoleApiClient,
    /// 菜单
    pub menu: AdmMenuApiClient,
}
