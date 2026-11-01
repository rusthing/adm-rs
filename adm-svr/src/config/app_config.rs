use crate::config::AdmConfig;
use arc_swap::ArcSwapOption;
use config::Value;
use idworker::IdWorkerConfig;
use robotech::cfg::CfgError;
use robotech::db::DbConnConfig;
use robotech::redis::RedisConfig;
use robotech::web::WebServerConfig;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;
use tracing::info;

/// # 全局应用配置
///
/// 使用 `ArcSwapOption` 保存，支持配置热更新时的无锁替换。
static APP_CONFIG: ArcSwapOption<AppConfig> = ArcSwapOption::const_empty();

/// # 获取全局应用配置
///
/// ## 返回值
/// * `Ok(Arc<AppConfig>)` - 应用配置的只读引用
/// * `Err(CfgError)` - 应用配置尚未初始化
pub fn get_app_config() -> Result<Arc<AppConfig>, CfgError> {
    APP_CONFIG
        .load_full()
        .ok_or(CfgError::NotInit("AppConfig not initialized".to_string()))
}

/// # 初始化全局应用配置
///
/// ## 参数
/// * `app_config` - 应用配置
/// * `changed` - 配置变更信息（应用配置为根配置，变更时整体替换，此处仅保留签名一致）
pub fn setup_app_config(app_config: AppConfig, _changed: &Option<HashMap<String, Value>>) {
    info!("setup app config...");
    APP_CONFIG.store(Some(Arc::new(app_config)));
}

/// # 配置文件结构
///
/// 字段名与配置文件里的配置段一一对应（`rename_all = "kebab-case"`）。
/// 除 `db` 外都有默认值，最小可用配置只需要一段 `[db]`。
#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "kebab-case")]
pub struct AppConfig {
    /// 数据库
    pub db: DbConnConfig,
    /// Web服务器
    #[serde(default = "WebServerConfig::default")]
    pub web: WebServerConfig,
    /// 分布式ID生成器
    #[serde(default = "IdWorkerConfig::default")]
    pub id_worker: IdWorkerConfig,
    /// Redis（骨架阶段只装配连接，尚未承载业务缓存）
    pub redis: RedisConfig,
    /// 管理后台业务配置
    #[serde(default = "AdmConfig::default")]
    pub adm: AdmConfig,
}
