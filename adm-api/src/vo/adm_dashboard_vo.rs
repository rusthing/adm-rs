//! # 首页配置与 widget 数据契约
//!
//! adm-svr 只提供自己的首页配置与 adm 域 widget 数据；跨服务数据由前端经
//! gatex 网关并行直连各服务获取。因此这里定义的是**统一信封**与**逻辑端点
//! 目录**，不含任何服务地址、凭据或健康探测结果。
//!
//! 所有可选 ID 用字符串下发，避免 JS 精度问题；必填 ID 继续用 `u64_serde`。

use serde::{Deserialize, Serialize};
use serde_json::Value;
use serde_with::skip_serializing_none;
use utoipa::ToSchema;
use wheel_rs::serde::u64_serde;

/// # 首页 widget 配置明细
#[skip_serializing_none]
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AdmDashboardWidgetVo {
    /// widget 明细 ID
    #[serde(with = "u64_serde")]
    pub id: u64,
    /// 所属首页配置 ID
    #[serde(with = "u64_serde")]
    pub dashboard_id: u64,
    /// widget 类型：kpi / trend / todo / recent_logs / shortcuts / my_permissions
    pub widget_type: String,
    /// 卡片标题（管理员可改）
    pub title: String,
    /// 逻辑服务标识，如 `adm` / `jobx`；实际地址由 gatex 按服务名解析
    pub service: String,
    /// 逻辑端点键，如 `stats.count`
    pub endpoint: String,
    /// 传给端点的参数（对象）
    #[schema(value_type = Object)]
    pub params: Option<Value>,
    /// 查看该 widget 所需的权限 URN 前缀；为空表示所有登录用户可见
    pub perm_urn: Option<String>,
    /// 是否按角色可见范围（领域 / 组织 / 应用）过滤统计口径
    pub scope_aware: bool,
    /// 排序值，越小越靠前
    pub sort_order: i32,
    /// 是否启用
    pub enabled: bool,
}

/// # 一份首页配置
///
/// `role_id` 为空表示全局兜底模板；`source` 为 `role` / `global`。
#[skip_serializing_none]
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AdmDashboardVo {
    #[serde(with = "u64_serde")]
    pub id: u64,
    /// 绑定的角色 ID；全局模板为 null
    pub role_id: Option<String>,
    /// 角色名，便于管理页与 `/me` 直接展示
    pub role_name: Option<String>,
    /// 配置名
    pub name: String,
    /// 备注
    pub remark: Option<String>,
    /// 配置是否启用
    pub enabled: bool,
    /// `role` = 角色级生效配置；`global` = 全局兜底
    pub source: String,
    /// 配置里的 widget（管理接口返回全部，含停用项）
    pub widgets: Vec<AdmDashboardWidgetVo>,
    /// 任意一个 widget 是否带 scopeAware 标记
    pub scope_aware: bool,
}

/// # 角色可见范围
///
/// 三条独立轴各一张表：`adm_role_realm_scope` / `adm_role_org_scope` /
/// `adm_role_app_scope`，这里合并成一个带 `scopeType` 的列表下发给 `/me`。
/// 可见范围是白名单，只决定「能看/能进哪些」，不决定功能权限；
/// 角色没有配置任何行时该维度全量可见。
#[skip_serializing_none]
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AdmRoleScopeVo {
    #[serde(with = "u64_serde")]
    pub id: u64,
    #[serde(with = "u64_serde")]
    pub role_id: u64,
    pub role_name: Option<String>,
    /// 领域 ID（`scopeType=realm`）
    pub realm_id: Option<String>,
    /// 组织 ID（`scopeType=org`）
    pub org_id: Option<String>,
    /// 应用 ID（`scopeType=app`）
    pub app_id: Option<String>,
    /// `realm` / `org` / `app`
    pub scope_type: String,
}

/// # 统一 widget 数据信封
///
/// 所有服务按同一契约返回；前端只渲染这个结构，不感知数据来自哪个服务。
/// 单个 widget 失败时 `status=error`、`error` 有原因，其它卡片不受影响。
#[skip_serializing_none]
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AdmWidgetDataVo {
    /// widget 类型，用于前端选择渲染器
    pub widget_type: String,
    /// 卡片标题；前端可用首页配置里的标题覆盖
    pub title: String,
    /// `ok` / `error` / `disabled` / `forbidden`
    pub status: String,
    /// 数据源返回的原始 data，前端按 widgetType 渲染
    #[schema(value_type = Object)]
    pub data: Option<Value>,
    /// 失败原因（status=error / forbidden）
    pub error: Option<String>,
    /// 数据生成时间戳（毫秒）
    #[serde(with = "u64_serde")]
    pub generated_ms: u64,
}

/// # widget 类型元数据
#[skip_serializing_none]
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AdmWidgetTypeVo {
    #[serde(with = "u64_serde")]
    pub id: u64,
    pub code: String,
    pub name: String,
    pub default_service: String,
    pub default_endpoint: String,
    pub description: Option<String>,
    /// 默认参数
    #[schema(value_type = Object)]
    pub default_params: Option<Value>,
    pub default_perm_urn: Option<String>,
    pub default_scope_aware: bool,
    pub sort_order: i32,
    pub enabled: bool,
}

/// # widget 逻辑端点目录项
///
/// 仅用于配置层校验与管理页下拉，让管理员无法填写任意 URL / 端点。
/// 真实地址与凭据由 gatex / Consul 管理，adm-svr 不保存。
#[skip_serializing_none]
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AdmWidgetEndpointVo {
    pub key: String,
    pub name: String,
    pub method: String,
    pub params_hint: Option<String>,
    pub enabled: bool,
    pub note: Option<String>,
}

/// # 逻辑服务与其端点
#[skip_serializing_none]
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AdmWidgetServiceVo {
    /// 逻辑服务键，如 `adm`；网关按 `/{service}-svr` 寻址
    pub code: String,
    pub name: String,
    pub enabled: bool,
    pub note: Option<String>,
    pub endpoints: Vec<AdmWidgetEndpointVo>,
}
