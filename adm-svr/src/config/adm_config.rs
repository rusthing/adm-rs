//! # 管理后台业务配置
//!
//! 定义 adm 服务自身相关的配置项，包括口令加盐与重置口令的默认值。
//! 该配置作为 [`crate::config::AppConfig`] 的一个配置段被读取。

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
    /// 口令加盐用的盐值
    #[serde(default = "password_salt_default")]
    pub password_salt: String,
    /// 重置口令时使用的默认口令
    #[serde(default = "default_password_default")]
    pub default_password: String,
}

/// 默认盐值
///
/// 与 `init-data.sql` 里种子用户的口令摘要保持一致；改这个值等于让所有旧口令失效。
const PASSWORD_SALT_DEFAULT: &str = "adm";
/// 默认重置口令
const DEFAULT_PASSWORD_DEFAULT: &str = "123456";

impl Default for AdmConfig {
    fn default() -> AdmConfig {
        AdmConfig {
            password_salt: password_salt_default(),
            default_password: default_password_default(),
        }
    }
}

fn password_salt_default() -> String {
    PASSWORD_SALT_DEFAULT.to_string()
}

fn default_password_default() -> String {
    DEFAULT_PASSWORD_DEFAULT.to_string()
}
