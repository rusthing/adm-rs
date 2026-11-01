use crate::dto::*;
use crate::vo::{AdmMenuExVo, AdmMenuVo};
use robotech::macros::feign;
use robotech::micro_svc::FeignApiClient;

/// # 菜单 API 客户端
///
/// 路由前缀 `/adm/menu`，与 `AdmMenuCtrl` 一一对应。
#[feign]
pub struct AdmMenuApiClient {
    client: FeignApiClient,
}

impl AdmMenuApiClient {
    pub fn new(client: FeignApiClient) -> Self {
        Self { client }
    }
}
