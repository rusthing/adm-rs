//! `SeaORM` Entity for 角色数据范围

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize, Default)]
#[sea_orm(table_name = "adm_role_scope")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false, unique)]
    pub id: i64,
    pub role_id: i64,
    pub realm_id: Option<i64>,
    pub org_id: Option<i64>,
    pub creater_id: i64,
    pub create_ms: i64,
    pub updater_id: i64,
    pub update_ms: i64,
}

impl ActiveModelBehavior for ActiveModel {}
