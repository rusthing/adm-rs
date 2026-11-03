//! `SeaORM` Entity for 角色首页配置头

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize, Default)]
#[sea_orm(table_name = "adm_dashboard")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false, unique)]
    pub id: i64,
    /// 为空表示全局兜底模板
    pub role_id: Option<i64>,
    pub name: String,
    pub remark: Option<String>,
    pub enabled: bool,
    pub creater_id: i64,
    pub create_ms: i64,
    pub updater_id: i64,
    pub update_ms: i64,
}

impl ActiveModelBehavior for ActiveModel {}
