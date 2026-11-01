use crate::config::{ADM_CONFIG_KEY, AdmConfig, set_adm_config};
use config::Value;
use std::collections::HashMap;
use tracing::info;
use wheel_rs::config_utils::has_config_changed;

/// # 装配业务配置
///
/// 只有 `[adm]` 段真的变了才替换全局配置：配置中心每次推送的是整棵配置树，
/// 其它段（比如 `[web]`）变化也会走到这里，不做判断会让业务配置无谓地换一遍。
///
/// ## 参数
/// * `adm_config` - 新的业务配置
/// * `changed` - 变更信息；`None` 表示首次加载
///
/// ## 返回值
/// * `Ok(())` - 装配完成
/// * `Err(anyhow::Error)` - 装配失败（当前实现不会失败，保留签名以便后续扩展）
pub async fn setup_adm_config(
    adm_config: AdmConfig,
    changed: &Option<HashMap<String, Value>>,
) -> anyhow::Result<()> {
    if changed
        .as_ref()
        .map(|changed| has_config_changed(ADM_CONFIG_KEY, changed))
        .unwrap_or(true)
    {
        info!("setup adm config: {adm_config:?}");
        set_adm_config(&adm_config);
    }
    Ok(())
}
