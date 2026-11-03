use crate::dto::{AdmDashboardSaveDto, AdmWidgetDataReq};
use crate::vo::{AdmDashboardVo, AdmWidgetDataVo, AdmWidgetServiceVo, AdmWidgetTypeVo};
use robotech::api::Ro;
use robotech::api_client::ApiClientError;
use robotech::micro_svc::FeignApiClient;
use reqwest::Method;
use reqwest::header::{HeaderMap, HeaderValue};
use std::collections::HashMap;

/// # 首页配置与 widget 数据 API 客户端
///
/// 对应 `AdmDashboardCtrl`。与其它 `*ApiClient` 一样，用户身份通过
/// `X-User-Id` 头传递；鉴权、路由与限流由 gatex 网关负责。
///
/// 这些接口是 adm-svr 自己的 API（首页配置与 adm 域 widget 数据），
/// 不是跨服务聚合入口。
pub struct AdmDashboardApiClient {
    client: FeignApiClient,
}

impl AdmDashboardApiClient {
    pub fn new(client: FeignApiClient) -> Self {
        Self { client }
    }

    /// 当前用户生效的首页配置。
    pub async fn effective(
        &self,
        current_user_id: u64,
        current_ms: Option<u64>,
    ) -> Result<Ro<Option<AdmDashboardVo>>, ApiClientError> {
        self.client
            .request::<(), Option<AdmDashboardVo>>(
                Method::GET,
                "/adm/dashboard/effective",
                None,
                None,
                Some(&Self::build_headers(current_user_id, current_ms)?),
            )
            .await
    }

    /// 调用 adm 自身域的 widget 数据端点，返回统一信封。
    pub async fn widget_data(
        &self,
        endpoint: &str,
        current_user_id: u64,
        current_ms: Option<u64>,
        req: &AdmWidgetDataReq,
    ) -> Result<Ro<AdmWidgetDataVo>, ApiClientError> {
        let url = format!("/adm/widget-data/{endpoint}");
        self.client
            .request::<AdmWidgetDataReq, AdmWidgetDataVo>(
                Method::POST,
                &url,
                None,
                Some(req),
                Some(&Self::build_headers(current_user_id, current_ms)?),
            )
            .await
    }

    /// 全部首页配置（含全局兜底模板）。
    pub async fn list_configs(
        &self,
        current_user_id: u64,
        current_ms: Option<u64>,
    ) -> Result<Ro<Vec<AdmDashboardVo>>, ApiClientError> {
        self.client
            .request::<(), Vec<AdmDashboardVo>>(
                Method::GET,
                "/adm/dashboard/config/list",
                None,
                None,
                Some(&Self::build_headers(current_user_id, current_ms)?),
            )
            .await
    }

    /// 读取指定角色（`None` 表示全局）的首页配置。
    pub async fn get_config(
        &self,
        role_id: Option<u64>,
        current_user_id: u64,
        current_ms: Option<u64>,
    ) -> Result<Ro<Option<AdmDashboardVo>>, ApiClientError> {
        let query = role_query(role_id);
        self.client
            .request::<HashMap<String, String>, Option<AdmDashboardVo>>(
                Method::GET,
                "/adm/dashboard/config",
                Some(&query),
                None,
                Some(&Self::build_headers(current_user_id, current_ms)?),
            )
            .await
    }

    /// 整份替换保存首页配置，widget 顺序即最终顺序。
    pub async fn save_config(
        &self,
        dto: &AdmDashboardSaveDto,
        current_user_id: u64,
        current_ms: Option<u64>,
    ) -> Result<Ro<AdmDashboardVo>, ApiClientError> {
        self.client
            .request::<AdmDashboardSaveDto, AdmDashboardVo>(
                Method::PUT,
                "/adm/dashboard/config",
                None,
                Some(dto),
                Some(&Self::build_headers(current_user_id, current_ms)?),
            )
            .await
    }

    /// 删除指定角色配置（全局配置不可删除）。
    pub async fn delete_config(
        &self,
        role_id: Option<u64>,
        current_user_id: u64,
        current_ms: Option<u64>,
    ) -> Result<Ro<bool>, ApiClientError> {
        let query = role_query(role_id);
        self.client
            .request::<HashMap<String, String>, bool>(
                Method::DELETE,
                "/adm/dashboard/config",
                Some(&query),
                None,
                Some(&Self::build_headers(current_user_id, current_ms)?),
            )
            .await
    }

    /// widget 类型目录。
    pub async fn widget_types(
        &self,
        current_user_id: u64,
        current_ms: Option<u64>,
    ) -> Result<Ro<Vec<AdmWidgetTypeVo>>, ApiClientError> {
        self.client
            .request::<(), Vec<AdmWidgetTypeVo>>(
                Method::GET,
                "/adm/dashboard/widget-type",
                None,
                None,
                Some(&Self::build_headers(current_user_id, current_ms)?),
            )
            .await
    }

    /// 逻辑端点目录，按服务分组；地址由 gatex 按服务名解析。
    pub async fn endpoints(
        &self,
        current_user_id: u64,
        current_ms: Option<u64>,
    ) -> Result<Ro<Vec<AdmWidgetServiceVo>>, ApiClientError> {
        self.client
            .request::<(), Vec<AdmWidgetServiceVo>>(
                Method::GET,
                "/adm/dashboard/endpoints",
                None,
                None,
                Some(&Self::build_headers(current_user_id, current_ms)?),
            )
            .await
    }

    fn build_headers(
        current_user_id: u64,
        current_ms: Option<u64>,
    ) -> Result<HeaderMap, ApiClientError> {
        let mut headers = HeaderMap::new();
        headers.insert(
            robotech::cst::user_id_cst::USER_ID_HEADER_NAME,
            HeaderValue::from_str(&current_user_id.to_string())
                .map_err(|e| anyhow::anyhow!("current_user_id: {e}"))?,
        );
        if let Some(ms) = current_ms {
            headers.insert(
                robotech::cst::user_id_cst::CURRENT_MS_HEADER_NAME,
                HeaderValue::from_str(&ms.to_string())
                    .map_err(|e| anyhow::anyhow!("current_ms: {e}"))?,
            );
        }
        Ok(headers)
    }
}

fn role_query(role_id: Option<u64>) -> HashMap<String, String> {
    let mut query = HashMap::new();
    if let Some(id) = role_id {
        query.insert("roleId".to_string(), id.to_string());
    }
    query
}
