use adm_svr::config::{AppConfig, get_adm_config, setup_app_config};
use adm_svr::utils::{setup_adm_config, setup_adm_option_cache};
// `db_migrate!` 展开后会用到 `anyhow!`，必须在调用点可见
use anyhow::anyhow;
use config::Value;
use robotech::app::setup_id_worker;
use robotech::db::setup_db_conn;
use robotech::macros::{bootstrap, db_migrate, log_call};
use robotech::redis::setup_redis_conn;
use robotech::web::setup_web_server;
use std::collections::HashMap;
use std::sync::Arc;

bootstrap!(AppConfig);

/// # 服务装配
///
/// `bootstrap!` 负责 CLI 解析、配置加载、信号管理与优雅退出，这里只按依赖顺序
/// 把各个连接器装配起来。配置热更新时本函数会被再次调用，`changed` 说明哪几段变了，
/// 各个 `setup_*` 自己判断要不要真的重建。
///
/// ## 参数
/// * `app_config` - 应用配置
/// * `changed` - 变更信息；`None` 表示首次启动
/// * `port` - 命令行指定的端口（覆盖配置文件）
/// * `old_pid` - 上一次运行的进程号（优雅重启时用于等待旧进程退出）
///
/// ## 返回值
/// * `Ok(())` - 装配完成
/// * `Err(anyhow::Error)` - 任一步装配失败
#[log_call]
async fn setup(
    app_config: &Arc<AppConfig>,
    changed: &Option<HashMap<String, Value>>,
    port: Option<u16>,
    old_pid: Option<u32>,
) -> Result<(), anyhow::Error> {
    // 迁移必须先于建连：迁移自己按 db url 建一条独立连接
    let db_url = app_config.db.get_url();
    db_migrate!(db_url);

    setup_app_config(app_config.as_ref().clone(), changed);
    setup_id_worker(app_config.id_worker.clone(), changed).await?;
    setup_redis_conn(app_config.redis.clone(), changed).await?;
    setup_db_conn(app_config.db.clone(), changed).await?;
    setup_adm_config(app_config.adm.clone(), changed).await?;
    // 选项缓存要查库，必须排在 setup_db_conn 之后
    setup_adm_option_cache(changed).await?;
    setup_web_server(app_config.web.clone(), port, old_pid, changed).await?;

    // 默认令牌密钥写在代码里，谁都能伪造令牌：不拦住，但必须吵
    if get_adm_config()
        .map(|config| config.is_jwt_secret_default())
        .unwrap_or(false)
    {
        tracing::warn!("[adm] jwt-secret 使用默认值，只能用于开发环境！");
    }

    Ok(())
}
