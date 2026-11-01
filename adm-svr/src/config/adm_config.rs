//! # 管理后台业务配置
//!
//! 定义 adm 服务自身相关的配置项：令牌签名密钥与有效期、重置口令的默认值、
//! 选项缓存的兜底刷新间隔。
//!
//! 「几次失败锁多久」这类**业务可调**的参数不放这里，放 `adm_option` 表
//! （见 [`crate::utils::adm_option_cache_utils`]）：改一次不用重启服务。

use arc_swap::ArcSwapOption;
use robotech::cfg::CfgError;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// 本配置在配置文件里的键名，用于热更新时判断「这一段有没有变」
pub const ADM_CONFIG_KEY: &str = "adm";

static ADM_CONFIG: ArcSwapOption<AdmConfig> = ArcSwapOption::const_empty();

/// # 获取业务配置
///
/// ## 返回值
/// * `Ok(Arc<AdmConfig>)` - 业务配置的只读引用
/// * `Err(CfgError)` - 业务配置尚未初始化
pub fn get_adm_config() -> Result<Arc<AdmConfig>, CfgError> {
    ADM_CONFIG
        .load_full()
        .ok_or(CfgError::NotInit("ADM config not initialized".to_string()))
}

/// # 写入业务配置
pub fn set_adm_config(config: &AdmConfig) {
    ADM_CONFIG.store(Some(Arc::new(config.clone())));
}

/// # 管理后台业务配置
///
/// 对应配置文件中的 `[adm]` 配置段。
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "kebab-case")]
pub struct AdmConfig {
    /// 重置口令时使用的默认口令（明文，仅用于生成初始摘要）
    #[serde(default = "default_password_default")]
    pub default_password: String,
    /// 令牌签名密钥
    ///
    /// HS256 的对称密钥，**换掉它等于让所有已发出的令牌立即失效**。
    /// 用默认值时服务启动会打一条 warn：默认值只够开发用。
    #[serde(default = "jwt_secret_default")]
    pub jwt_secret: String,
    /// 令牌有效期（毫秒）
    ///
    /// 从签发时刻算起，服务端不续期；到期后前端要重新登录。
    /// 默认 2 小时：够一个工作半天，又短到泄露后窗口可控。
    #[serde(default = "token_ttl_ms_default")]
    pub token_ttl_ms: u64,
    /// 选项缓存的兜底刷新间隔（毫秒）
    ///
    /// 本进程改 `adm_option` 会立即刷新快照，这个定时器只负责收敛**别的节点**
    /// 的改动。默认 60 秒：登录锁定阈值改错了，最多一分钟就全集群生效。
    #[serde(default = "option_refresh_ms_default")]
    pub option_refresh_ms: u64,
}

/// 默认重置口令
const DEFAULT_PASSWORD_DEFAULT: &str = "123456";
/// 默认令牌密钥（仅开发用）
const JWT_SECRET_DEFAULT: &str = "adm-change-me-in-production";
/// 默认令牌有效期：2 小时
const TOKEN_TTL_MS_DEFAULT: u64 = 2 * 60 * 60 * 1000;
/// 默认选项缓存兜底刷新间隔：60 秒
const OPTION_REFRESH_MS_DEFAULT: u64 = 60 * 1000;

impl Default for AdmConfig {
    fn default() -> AdmConfig {
        AdmConfig {
            default_password: default_password_default(),
            jwt_secret: jwt_secret_default(),
            token_ttl_ms: token_ttl_ms_default(),
            option_refresh_ms: option_refresh_ms_default(),
        }
    }
}

impl AdmConfig {
    /// # 是否还在用默认的令牌密钥
    ///
    /// 启动时用它决定要不要警告：默认密钥写在代码里，任何人都能伪造令牌。
    pub fn is_jwt_secret_default(&self) -> bool {
        self.jwt_secret == JWT_SECRET_DEFAULT
    }
}

fn default_password_default() -> String {
    DEFAULT_PASSWORD_DEFAULT.to_string()
}

fn jwt_secret_default() -> String {
    JWT_SECRET_DEFAULT.to_string()
}

fn token_ttl_ms_default() -> u64 {
    TOKEN_TTL_MS_DEFAULT
}

fn option_refresh_ms_default() -> u64 {
    OPTION_REFRESH_MS_DEFAULT
}
