//! `SeaORM` Entity for 首页 widget 明细

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize, Default)]
#[sea_orm(table_name = "adm_dashboard_widget")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false, unique)]
    pub id: i64,
    pub dashboard_id: i64,
    pub widget_type: String,
    pub title: String,
    /// 逻辑服务标识，如 adm；真实地址只在服务端注册表
    pub service: String,
    /// 注册表端点键，如 stats.count
    pub endpoint: String,
    /// JSON 文本
    pub params: Option<String>,
    pub perm_urn: Option<String>,
    pub scope_aware: bool,
    pub sort_order: i32,
    pub enabled: bool,
    pub creater_id: i64,
    pub create_ms: i64,
    pub updater_id: i64,
    pub update_ms: i64,
}

impl ActiveModelBehavior for ActiveModel {}
