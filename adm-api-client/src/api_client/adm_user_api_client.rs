use crate::dto::*;
use crate::vo::{AdmUserExVo, AdmUserVo};
use robotech::macros::feign;
use robotech::micro_svc::FeignApiClient;

/// # 用户 API 客户端
///
/// 路由前缀 `/adm/user`，与 `AdmUserCtrl` 一一对应。
#[feign]
pub struct AdmUserApiClient {
    client: FeignApiClient,
}

impl AdmUserApiClient {
    pub fn new(client: FeignApiClient) -> Self {
        Self { client }
    }
}
