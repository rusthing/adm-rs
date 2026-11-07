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
    /// 运行环境（dev / test / prod）
    ///
    /// 由配置文件根节点的 `profile` 读取，也可以用环境变量 `APP_PROFILE` 覆盖。
    /// 缺省视为 `prod`：没有显式声明环境时按最严格的口径处理。
    #[serde(default)]
    pub profile: Option<String>,
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
    /// 认证开关
    #[serde(default = "AuthConfig::default")]
    pub auth: AuthConfig,
}

/// # 认证开关
///
/// 对应配置文件中的 `[auth]` 配置段。开发环境可以整体关闭登录校验，
/// 但只在 `profile = dev` 时生效；生产环境写 `dev-bypass = true` 会直接启动失败。
#[derive(Debug, Deserialize, Clone, Default)]
#[serde(rename_all = "kebab-case")]
pub struct AuthConfig {
    /// 开发环境免登录
    ///
    /// 为 `true` 且 `profile = dev` 时，业务接口不再要求 Bearer 令牌，
    /// 当前用户固定为系统账号 `user_id = 0`。其它环境为 `true` 时启动报错。
    #[serde(default)]
    pub dev_bypass: bool,
}

impl AppConfig {
    /// 运行环境名；没有配置 profile 时按 `prod` 处理。
    pub fn profile_name(&self) -> &str {
        self.profile.as_deref().unwrap_or("prod")
    }

    /// 是否开发环境。
    pub fn is_dev(&self) -> bool {
        self.profile_name() == "dev"
    }

    /// 是否启用「开发环境免登录」。
    pub fn dev_bypass_enabled(&self) -> bool {
        self.is_dev() && self.auth.dev_bypass
    }
}

/// # 当前是否处于开发环境免登录
///
/// 供鉴权中间件与处理器判断；配置尚未初始化时按「不绕过」处理。
pub fn dev_bypass_enabled() -> bool {
    get_app_config()
        .map(|config| config.dev_bypass_enabled())
        .unwrap_or(false)
}

/// # 启动期认证配置校验
///
/// 两类配置错误会留下明显的安全口子，必须在监听端口前失败：
/// 1. 非 dev 环境开启 `auth.dev-bypass`；
/// 2. 非 dev 环境仍使用默认的 `adm.jwt-secret`。
pub fn validate_auth_config(config: &AppConfig, adm: &AdmConfig) -> Result<(), String> {
    if !config.is_dev() && config.auth.dev_bypass {
        return Err(format!(
            "profile={} 时不允许开启 auth.dev-bypass：免登录只在 dev 环境可用",
            config.profile_name()
        ));
    }
    if !config.is_dev() && adm.is_jwt_secret_default() {
        return Err(format!(
            "profile={} 时 adm.jwt-secret 仍是默认值：任何人都能伪造令牌，必须先替换",
            config.profile_name()
        ));
    }
    Ok(())
}
