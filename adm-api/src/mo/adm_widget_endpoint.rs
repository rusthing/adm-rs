//! `SeaORM` Entity for widget 逻辑端点目录
//!
//! 只存 `service + endpoint` 逻辑键和展示信息；不存 URL、凭据或健康状态。

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize, Default)]
#[sea_orm(table_name = "adm_widget_endpoint")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false, unique)]
    pub id: i64,
    #[sea_orm(unique_key = "ak_service_and_endpoint_adm_widget_endpoint")]
    pub service: String,
    #[sea_orm(unique_key = "ak_service_and_endpoint_adm_widget_endpoint")]
    pub endpoint: String,
    pub name: String,
    pub method: String,
    pub params_hint: Option<String>,
    pub enabled: bool,
    pub note: Option<String>,
    pub sort_order: i32,
    pub creater_id: i64,
    pub create_ms: i64,
    pub updater_id: i64,
    pub update_ms: i64,
}

impl ActiveModelBehavior for ActiveModel {}
