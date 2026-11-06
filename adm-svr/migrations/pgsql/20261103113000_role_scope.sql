/*==============================================================*/
/* 角色可见范围：领域 / 组织 / 应用，三条独立轴各一张表           */
/*                                                              */
/* 口径：这三张表只管「角色能看哪些、能进哪些」，是可见范围白名单，*/
/*      不管功能权限。功能权限由 adm_role_menu / adm_role_perm 决定。*/
/*      角色没有对应行 = 该维度全量可见（配了才限制）；多角色取并集。 */
/*                                                              */
/* 为什么拆表：领域、组织、应用是三个不同的父表，合并成单表会逼出  */
/*      nullable 外键 + check 二选一约束。拆开后每张表都是干净的   */
/*      (role_id, target_id) 关联表，外键与唯一键都无歧义。        */
/*                                                              */
/* 删除角色 / 领域 / 组织 / 应用时级联清理。                       */
/*                                                              */
/* 主建表脚本（create-table.sql）已包含这三张表；本文件用          */
/* if not exists 幂等补建，供已有环境增量升级时跳过。              */
/*==============================================================*/

create table if not exists adm_role_realm_scope (
    id         bigint primary key,
    role_id    bigint not null references adm_role(id)
                 on update cascade on delete cascade,
    realm_id   bigint not null references adm_realm(id)
                 on update cascade on delete cascade,
    creater_id bigint not null default 0,
    create_ms  bigint not null default 0,
    updater_id bigint not null default 0,
    update_ms  bigint not null default 0
);

create unique index if not exists ak_role_id_and_realm_id_adm_role_realm_scope
    on adm_role_realm_scope (role_id, realm_id);

create index if not exists idx_realm_id_adm_role_realm_scope
    on adm_role_realm_scope (realm_id);

create table if not exists adm_role_org_scope (
    id         bigint primary key,
    role_id    bigint not null references adm_role(id)
                 on update cascade on delete cascade,
    org_id     bigint not null references adm_org(id)
                 on update cascade on delete cascade,
    creater_id bigint not null default 0,
    create_ms  bigint not null default 0,
    updater_id bigint not null default 0,
    update_ms  bigint not null default 0
);

create unique index if not exists ak_role_id_and_org_id_adm_role_org_scope
    on adm_role_org_scope (role_id, org_id);

create index if not exists idx_org_id_adm_role_org_scope
    on adm_role_org_scope (org_id);

create table if not exists adm_role_app_scope (
    id         bigint primary key,
    role_id    bigint not null references adm_role(id)
                 on update cascade on delete cascade,
    app_id     bigint not null references adm_app(id)
                 on update cascade on delete cascade,
    creater_id bigint not null default 0,
    create_ms  bigint not null default 0,
    updater_id bigint not null default 0,
    update_ms  bigint not null default 0
);

create unique index if not exists ak_role_id_and_app_id_adm_role_app_scope
    on adm_role_app_scope (role_id, app_id);

create index if not exists idx_app_id_adm_role_app_scope
    on adm_role_app_scope (app_id);

/* 按 user_id 反查归属：现有唯一键前缀是 org_id / realm_id，用不上 */
create index if not exists idx_user_id_adm_org_user
    on adm_org_user (user_id);

create index if not exists idx_user_id_adm_realm_user
    on adm_realm_user (user_id);
