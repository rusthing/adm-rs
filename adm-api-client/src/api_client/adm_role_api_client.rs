use crate::dto::*;
use crate::vo::{AdmRoleExVo, AdmRoleVo};
use robotech::macros::feign;
use robotech::micro_svc::FeignApiClient;

/// # 角色 API 客户端
///
/// 路由前缀 `/adm/role`，与 `AdmRoleCtrl` 一一对应。
#[feign]
pub struct AdmRoleApiClient {
    client: FeignApiClient,
}

impl AdmRoleApiClient {
    pub fn new(client: FeignApiClient) -> Self {
        Self { client }
    }
}
