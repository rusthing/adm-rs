use robotech::macros::api_doc;

/// # 首页配置与 adm 域 widget 数据接口文档
#[api_doc(
    effective,
    list_configs,
    get_config,
    save_config,
    delete_config,
    widget_types,
    endpoints,
    widget_data
)]
pub struct AdmDashboardApiDoc;
