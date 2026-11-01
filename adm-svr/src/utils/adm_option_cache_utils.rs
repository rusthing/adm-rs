//! # 选项表缓存
//!
//! `adm_option` 是「一个 code 一行」的配置表，登录策略这类**运行期可调**的
//! 参数放在这里，改完不用重启服务。
//!
//! ## 刷新机制
//!
//! 快照存在 `ArcSwapOption<HashMap>` 里，读放大为零（一次原子 load）：
//!
//! 1. **启动加载**：`setup_adm_option_cache` 先同步查一次库，查不到就用代码里的
//!    默认值——不能让「表里还没插行」变成登录不可用。
//! 2. **写后立即刷新**：`AdmOptionSvc` 的 `after_write` 钩子调
//!    [`refresh_adm_option_cache`]，事务提交后全量重建本进程快照。
//! 3. **定时兜底**：按 `[adm] option-refresh-ms` 周期性重建，收敛**其它节点**
//!    写入的改动（本进程写自己的快照是即时的，跨节点要等一个周期）。
//!
//! 为什么不做「跨节点推送」：那要接 NATS（`robotech::cache::local` 的
//! `local-cache` feature 依赖它），为一张几行的小表引入一条消息通道不值当。
//! 登录锁定阈值晚一分钟生效没有业务影响。

use crate::config::get_adm_config;
use crate::mo::adm_option;
use arc_swap::ArcSwapOption;
use robotech::db::get_db_conn;
use sea_orm::EntityTrait;
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tracing::{error, info, warn};

/// 登录失败锁定阈值（次数）在 `adm_option` 里的 code
pub const OPTION_LOGIN_FAIL_LIMIT: &str = "login_fail_limit";
/// 登录锁定时长（毫秒）在 `adm_option` 里的 code
pub const OPTION_LOGIN_LOCK_MS: &str = "login_lock_ms";

/// 登录失败锁定阈值默认值：5 次
pub const DEFAULT_LOGIN_FAIL_LIMIT: i16 = 5;
/// 登录锁定时长默认值：1 小时
pub const DEFAULT_LOGIN_LOCK_MS: u64 = 60 * 60 * 1000;

/// 选项快照：`code -> value`
static ADM_OPTION_CACHE: ArcSwapOption<HashMap<String, String>> = ArcSwapOption::const_empty();

/// 定时刷新任务是否已启动
///
/// 配置热更新会再次调用 `setup_adm_option_cache`，没有这个标记会重复 spawn，
/// 每个副本都在刷同一份快照，白白放大数据库压力。
static REFRESH_TASK_STARTED: AtomicBool = AtomicBool::new(false);

/// # 全量重建选项快照
///
/// ## 返回值
/// * `Ok(HashMap<String, String>)` - 重建后的快照
/// * `Err(anyhow::Error)` - 查库失败
pub async fn rebuild_adm_option_cache() -> anyhow::Result<HashMap<String, String>> {
    let db = get_db_conn()?;
    let rows = adm_option::Entity::find().all(db.as_ref()).await?;
    Ok(rows
        .into_iter()
        .map(|row| (row.code, row.value))
        .collect())
}

/// # 重建并替换快照
///
/// 查库失败时**保留旧快照**：拿空表覆盖等于把登录策略悄悄改成默认值。
async fn refresh_inner() {
    match rebuild_adm_option_cache().await {
        Ok(cache) => {
            info!("adm option cache refreshed, {} entries", cache.len());
            ADM_OPTION_CACHE.store(Some(Arc::new(cache)));
        }
        Err(e) => error!("refresh adm option cache failed: {e}"),
    }
}

/// # 立即刷新选项快照
///
/// 供 `AdmOptionSvc` 的 `after_write` 钩子调用：钩子的签名是「无参、无返回值」，
/// 所以这里自己查库、自己吞错误（失败只打日志，不能让一次成功的写操作因为
/// 刷新缓存而报错）。
pub async fn refresh_adm_option_cache() {
    refresh_inner().await;
}

/// # 装配选项缓存
///
/// 启动时先同步加载一次，再起定时兜底任务。必须在数据库连接就绪之后调用。
///
/// ## 参数
/// * `changed` - 配置变更信息；`None` 表示首次启动（首次要等加载完成）
///
/// ## 返回值
/// * `Ok(())` - 装配完成
/// * `Err(anyhow::Error)` - 首次加载查库失败
pub async fn setup_adm_option_cache(changed: &Option<std::collections::HashMap<String, config::Value>>) -> anyhow::Result<()> {
    // 首次启动必须加载成功：没有快照就只能靠默认值，等于配置没生效
    if ADM_OPTION_CACHE.load().is_none() || changed.is_some() {
        let cache = rebuild_adm_option_cache().await?;
        info!("adm option cache loaded, {} entries", cache.len());
        ADM_OPTION_CACHE.store(Some(Arc::new(cache)));
    }

    // 定时兜底只起一次；间隔每轮重新读配置，热更新自动生效
    if !REFRESH_TASK_STARTED.swap(true, Ordering::SeqCst) {
        tokio::spawn(async {
            loop {
                let interval_ms = get_adm_config()
                    .map(|cfg| cfg.option_refresh_ms)
                    .unwrap_or(60 * 1000)
                    .max(1000);
                tokio::time::sleep(std::time::Duration::from_millis(interval_ms)).await;
                refresh_inner().await;
            }
        });
    }

    Ok(())
}

/// # 读取选项的原始字符串
///
/// ## 参数
/// * `code` - 选项编码
///
/// ## 返回值
/// * `Some(String)` - 表里配置了该行
/// * `None` - 没配置（调用方用自己的默认值），或快照尚未建立
pub fn get_option(code: &str) -> Option<String> {
    ADM_OPTION_CACHE
        .load()
        .as_ref()
        .and_then(|cache| cache.get(code).cloned())
}

/// # 读取整数形式的选项
///
/// ## 参数
/// * `code` - 选项编码
/// * `default` - 没有配置或配置的不是整数时返回它
///
/// ## 返回值
/// * `i64` - 解析出的值
pub fn get_option_i64(code: &str, default: i64) -> i64 {
    match get_option(code) {
        Some(raw) => match raw.trim().parse::<i64>() {
            Ok(value) => value,
            Err(_) => {
                // 配错了要留痕：否则「阈值怎么不生效」只能靠猜
                warn!("adm_option[{code}] is not an integer: {raw}, fallback to {default}");
                default
            }
        },
        None => default,
    }
}

/// # 登录失败锁定阈值（次数）
///
/// 取 `adm_option.login_fail_limit`，没配置用 [`DEFAULT_LOGIN_FAIL_LIMIT`]。
/// 小于 1 的值按默认处理：0 或负数会让「第一次失败就锁定」变成「永远锁不上」，
/// 都不是配置者的本意。
pub fn get_login_fail_limit() -> i16 {
    let value = get_option_i64(OPTION_LOGIN_FAIL_LIMIT, DEFAULT_LOGIN_FAIL_LIMIT as i64);
    if value < 1 {
        warn!("adm_option[{OPTION_LOGIN_FAIL_LIMIT}]={value} is invalid, fallback to {DEFAULT_LOGIN_FAIL_LIMIT}");
        return DEFAULT_LOGIN_FAIL_LIMIT;
    }
    value.min(i16::MAX as i64) as i16
}

/// # 登录锁定时长（毫秒）
///
/// 取 `adm_option.login_lock_ms`，没配置用 [`DEFAULT_LOGIN_LOCK_MS`]。
pub fn get_login_lock_ms() -> u64 {
    let value = get_option_i64(OPTION_LOGIN_LOCK_MS, DEFAULT_LOGIN_LOCK_MS as i64);
    if value < 1 {
        warn!("adm_option[{OPTION_LOGIN_LOCK_MS}]={value} is invalid, fallback to {DEFAULT_LOGIN_LOCK_MS}");
        return DEFAULT_LOGIN_LOCK_MS;
    }
    value as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 快照缺失走默认值；配了值以表为准；非法值回退默认
    ///
    /// 三种情形写成**一个**测试：快照是进程级静态，拆成多个测试会并发改写同一份
    /// 数据，出现「单独跑都过、一起跑偶发失败」。
    #[test]
    fn snapshot_and_fallback() {
        // 没有快照
        assert_eq!(get_option("not-exists"), None);
        assert_eq!(get_option_i64("not-exists", 7), 7);
        assert_eq!(get_login_fail_limit(), DEFAULT_LOGIN_FAIL_LIMIT);
        assert_eq!(get_login_lock_ms(), DEFAULT_LOGIN_LOCK_MS);

        // 表里配了值
        let mut map = HashMap::new();
        map.insert(OPTION_LOGIN_FAIL_LIMIT.to_string(), "3".to_string());
        map.insert(OPTION_LOGIN_LOCK_MS.to_string(), "60000".to_string());
        ADM_OPTION_CACHE.store(Some(Arc::new(map)));
        assert_eq!(get_login_fail_limit(), 3);
        assert_eq!(get_login_lock_ms(), 60_000);

        // 配错：非整数、0、负数都要回到默认，不能让阈值失效
        let mut bad = HashMap::new();
        bad.insert(OPTION_LOGIN_FAIL_LIMIT.to_string(), "abc".to_string());
        bad.insert(OPTION_LOGIN_LOCK_MS.to_string(), "0".to_string());
        ADM_OPTION_CACHE.store(Some(Arc::new(bad)));
        assert_eq!(get_login_fail_limit(), DEFAULT_LOGIN_FAIL_LIMIT);
        assert_eq!(get_login_lock_ms(), DEFAULT_LOGIN_LOCK_MS);
    }
}
