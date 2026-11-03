//! `SeaORM` Entity for widget 类型元数据

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize, Default)]
#[sea_orm(table_name = "adm_widget_type")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false, unique)]
    pub id: i64,
    #[sea_orm(unique_key = "ak_code_adm_widget_type")]
    pub code: String,
    pub name: String,
    pub default_service: String,
    pub default_endpoint: String,
    pub description: Option<String>,
    /// JSON 文本
    pub default_params: Option<String>,
    pub default_perm_urn: Option<String>,
    pub default_scope_aware: bool,
    pub sort_order: i32,
    pub enabled: bool,
    pub creater_id: i64,
    pub create_ms: i64,
    pub updater_id: i64,
    pub update_ms: i64,
}

impl ActiveModelBehavior for ActiveModel {}
