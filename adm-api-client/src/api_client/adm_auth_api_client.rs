use crate::dto::{AdmVerifyAuditPasswordDto, AdmVerifyPasswordDto};
use crate::vo::AdmVerifyAuditPasswordVo;
use reqwest::Method;
use reqwest::header::{AUTHORIZATION, HeaderMap, HeaderValue};
use robotech::api::Ro;
use robotech::api_client::ApiClientError;
use robotech::micro_svc::FeignApiClient;
use serde::de::DeserializeOwned;
use serde::Serialize;

/// # 认证 API 客户端
///
/// 对应 `AdmAuthCtrl`。认证路由是手写接口，`#[feign]` 不会生成 CRUD 方法，
/// 这里只补调用方真正需要的那一个：口令二次确认。
pub struct AdmAuthApiClient {
    client: FeignApiClient,
}

impl AdmAuthApiClient {
    pub fn new(client: FeignApiClient) -> Self {
        Self { client }
    }

    /// # 校验当前登录用户口令
    ///
    /// 身份只取自 `authorization`，请求体里不传账号；adm-rs 按令牌里的用户
    /// 做口令比对，失败时返回 `ADM00007` / `ADM00008` 等业务码。
    pub async fn verify_password(
        &self,
        authorization: &str,
        dto: &AdmVerifyPasswordDto,
    ) -> Result<Ro<()>, ApiClientError> {
        self.post_verify("/adm/auth/verify-password", authorization, dto)
            .await
    }

    /// # 校验当前登录用户的审核口令
    ///
    /// 与登录口令校验同一条处理链，优先比对用户表中独立的审核口令
    /// `audit_pswd`。审核口令为空时由服务端回退校验登录口令，调用方仍然只传
    /// 一个口令摘要；响应里的 `pswdKind` 说明本次实际校验的类型，仅用于提示
    /// 文案，不参与判定。
    pub async fn verify_audit_password(
        &self,
        authorization: &str,
        dto: &AdmVerifyAuditPasswordDto,
    ) -> Result<Ro<AdmVerifyAuditPasswordVo>, ApiClientError> {
        self.post_verify("/adm/auth/verify-audit-password", authorization, dto)
            .await
    }

    /// 两个口令校验接口共用的请求构造：身份只从认证头取，请求体只放摘要
    async fn post_verify<D, T>(
        &self,
        path: &str,
        authorization: &str,
        dto: &D,
    ) -> Result<Ro<T>, ApiClientError>
    where
        D: Serialize + Sync + std::fmt::Debug,
        T: DeserializeOwned + std::fmt::Debug,
    {
        let mut headers = HeaderMap::new();
        let value = HeaderValue::from_str(authorization).map_err(|error| {
            ApiClientError::Runtime(anyhow::anyhow!("非法的 Authorization 头：{error}"))
        })?;
        headers.insert(AUTHORIZATION, value);
        self.client
            .request::<D, T>(Method::POST, path, None, Some(dto), Some(&headers))
            .await
    }
}
