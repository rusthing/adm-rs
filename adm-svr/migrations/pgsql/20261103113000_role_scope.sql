/*==============================================================*/
/* adm_role_scope：角色 ↔ 领域/组织 的授权范围绑定             */
/*                                                              */
/* 用途：组织管理员这类角色，需要限制只能管理指定组织；          */
/*      平台/系统管理员可以不绑定 scope（代表全局）。            */
/*                                                              */
/* 规则：                                                       */
/* 1. realm_id / org_id 二选一（check constraint）。            */
/* 2. 同一 (role_id, scope) 唯一。                              */
/* 3. 删除角色 / 领域 / 组织 时级联清理。                       */
/*                                                              */
/* 说明：本轮只建表 + 种子绑定，CRUD 数据过滤钩子留待下一轮     */
/*      在 adm_user_svc / adm_org_svc 的查询层注入。            */
/*==============================================================*/

create table if not exists adm_role_scope (
    id        bigint primary key,
    role_id   bigint not null references adm_role(id)
                on update cascade on delete cascade,
    realm_id  bigint null references adm_realm(id)
                on update cascade on delete cascade,
    org_id    bigint null references adm_org(id)
                on update cascade on delete cascade,
    creater_id bigint not null default 0,
    create_ms  bigint not null default 0,
    updater_id bigint not null default 0,
    update_ms  bigint not null default 0,
    check ((realm_id is not null) <> (org_id is not null))
);

create unique index if not exists ak_role_id_and_realm_id_adm_role_scope
    on adm_role_scope (role_id, realm_id) where realm_id is not null;

create unique index if not exists ak_role_id_and_org_id_adm_role_scope
    on adm_role_scope (role_id, org_id) where org_id is not null;
