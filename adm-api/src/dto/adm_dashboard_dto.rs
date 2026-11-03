//! # 首页配置 DTO
//!
//! 保存采用「整份替换」语义：请求里的 widget 顺序就是最终顺序，
//! 排序值由服务端按 `(index + 1) * 10` 重算，管理页不需要自己维护数字。

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// # 单个 widget 编辑项
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AdmDashboardWidgetDto {
    /// widget 类型 code，必须在 `adm_widget_type` 里存在
    pub widget_type: String,
    /// 卡片标题；为空时用类型名兜底
    pub title: Option<String>,
    /// 逻辑服务标识；为空时用类型元数据的 defaultService
    pub service: Option<String>,
    /// 注册表端点键；为空时用类型元数据的 defaultEndpoint
    pub endpoint: Option<String>,
    /// 端点参数（对象）
    #[schema(value_type = Object)]
    pub params: Option<Value>,
    /// 权限 URN 前缀；空 / null 表示所有登录用户可见
    pub perm_urn: Option<String>,
    /// 数据范围标记
    pub scope_aware: Option<bool>,
    /// 是否启用
    pub enabled: Option<bool>,
}

/// # 保存首页配置
///
/// `role_id` 为空表示全局兜底模板；`widgets` 为完整列表，保存时整份替换。
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AdmDashboardSaveDto {
    pub role_id: Option<String>,
    pub name: Option<String>,
    pub remark: Option<String>,
    pub enabled: Option<bool>,
    pub widgets: Vec<AdmDashboardWidgetDto>,
}

/// # 调用 widget 数据端点
///
/// 各服务按同一契约接收：逻辑端点键在 URL 里，参数与可选标题在 body 里。
/// 不传 token；用户身份沿用项目现有的 `X-User-Id` 请求头。
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AdmWidgetDataReq {
    /// 端点参数（对象）
    #[serde(default)]
    #[schema(value_type = Object)]
    pub params: Value,
    /// 期望的卡片标题；服务可原样回填，前端也可用配置标题覆盖
    pub title: Option<String>,
}
