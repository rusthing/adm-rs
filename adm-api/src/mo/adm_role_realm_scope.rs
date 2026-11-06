//! `SeaORM` Entity for 角色可见的领域范围

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize, Default)]
#[sea_orm(table_name = "adm_role_realm_scope")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false, unique)]
    pub id: i64,
    #[sea_orm(unique_key = "ak_role_id_and_realm_id_adm_role_realm_scope")]
    pub role_id: i64,
    #[sea_orm(unique_key = "ak_role_id_and_realm_id_adm_role_realm_scope")]
    pub realm_id: i64,
    pub creater_id: i64,
    pub create_ms: i64,
    pub updater_id: i64,
    pub update_ms: i64,
    #[sea_orm(
        belongs_to,
        from = "realm_id",
        to = "id",
        on_update = "Cascade",
        on_delete = "Cascade"
    )]
    pub adm_realm: BelongsTo<super::adm_realm::Entity>,
    #[sea_orm(
        belongs_to,
        from = "role_id",
        to = "id",
        on_update = "Cascade",
        on_delete = "Cascade"
    )]
    pub adm_role: BelongsTo<super::adm_role::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
