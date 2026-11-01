/*==============================================================*/
/* DBMS name:      PostgreSQL 9.x                               */
/* Created on:     2026/10/27 8:15:00                           */
/*==============================================================*/


/*==============================================================*/
/* Table: adm_role                                              */
/*==============================================================*/
create table adm_role (
                          id                   INT8                 not null,
                          code                 VARCHAR(50)          not null,
                          name                 VARCHAR(50)          not null,
                          data_scope           INT2                 not null,
                          sort                 INT4                 not null default 0,
                          enabled              BOOL                 not null default true,
                          remark               VARCHAR(200)         null,
                          creater_id           INT8                 not null,
                          create_ms            INT8                 not null,
                          updater_id           INT8                 not null,
                          update_ms            INT8                 not null,
                          constraint PK_ADM_ROLE primary key (id),
                          constraint AK_CODE_ADM_ROLE unique (code),
                          constraint AK_NAME_ADM_ROLE unique (name)
);

comment on table adm_role is
'角色';

comment on column adm_role.id is
'ID';

comment on column adm_role.code is
'角色编码';

comment on column adm_role.name is
'角色名称';

comment on column adm_role.data_scope is
'数据范围
1-全部数据
2-指定部门
3-本部门及下级部门
4-仅本部门
5-仅本人';

comment on column adm_role.sort is
'排序(升序)';

comment on column adm_role.enabled is
'启用';

comment on column adm_role.remark is
'备注';

comment on column adm_role.creater_id is
'创建者ID';

comment on column adm_role.create_ms is
'创建时间戳';

comment on column adm_role.updater_id is
'更新者ID';

comment on column adm_role.update_ms is
'更新时间戳';

/*==============================================================*/
/* Index: adm_role_PK                                           */
/*==============================================================*/
create unique index adm_role_PK on adm_role (
                                             id
    );

/*==============================================================*/
/* Table: adm_user                                              */
/*==============================================================*/
create table adm_user (
                          id                   INT8                 not null,
                          role_id              INT8                 not null,
                          username             VARCHAR(50)          not null,
                          nickname             VARCHAR(50)          not null,
                          password             VARCHAR(100)         null,
                          mobile               VARCHAR(20)          null,
                          email                VARCHAR(100)         null,
                          avatar               VARCHAR(500)         null,
                          status               INT2                 not null,
                          last_login_ms        INT8                 null,
                          remark               VARCHAR(200)         null,
                          creater_id           INT8                 not null,
                          create_ms            INT8                 not null,
                          updater_id           INT8                 not null,
                          update_ms            INT8                 not null,
                          constraint PK_ADM_USER primary key (id),
                          constraint AK_USERNAME_ADM_USER unique (username),
                          constraint AK_MOBILE_ADM_USER unique (mobile)
);

comment on table adm_user is
'用户';

comment on column adm_user.id is
'ID';

comment on column adm_user.role_id is
'角色ID';

comment on column adm_user.username is
'登录账号';

comment on column adm_user.nickname is
'昵称';

comment on column adm_user.password is
'口令摘要(加盐SHA-256)
为空表示未设置口令(外部认证用户)';

comment on column adm_user.mobile is
'手机号';

comment on column adm_user.email is
'邮箱';

comment on column adm_user.avatar is
'头像地址';

comment on column adm_user.status is
'用户状态
1-正常
2-已停用
3-已锁定';

comment on column adm_user.last_login_ms is
'最近登录时间戳';

comment on column adm_user.remark is
'备注';

comment on column adm_user.creater_id is
'创建者ID';

comment on column adm_user.create_ms is
'创建时间戳';

comment on column adm_user.updater_id is
'更新者ID';

comment on column adm_user.update_ms is
'更新时间戳';

/*==============================================================*/
/* Index: adm_user_PK                                           */
/*==============================================================*/
create unique index adm_user_PK on adm_user (
                                             id
    );

/*==============================================================*/
/* Index: Relationship_1_FK                                     */
/*==============================================================*/
create  index Relationship_1_FK on adm_user (
                                              role_id
    );

/*==============================================================*/
/* Table: adm_menu                                              */
/*==============================================================*/
create table adm_menu (
                          id                   INT8                 not null,
                          parent_id            INT8                 null,
                          code                 VARCHAR(100)         not null,
                          name                 VARCHAR(50)          not null,
                          menu_type            INT2                 not null,
                          path                 VARCHAR(200)         null,
                          component            VARCHAR(200)         null,
                          perm                 VARCHAR(100)         null,
                          icon                 VARCHAR(50)          null,
                          sort                 INT4                 not null default 0,
                          visible              BOOL                 not null default true,
                          enabled              BOOL                 not null default true,
                          remark               VARCHAR(200)         null,
                          creater_id           INT8                 not null,
                          create_ms            INT8                 not null,
                          updater_id           INT8                 not null,
                          update_ms            INT8                 not null,
                          constraint PK_ADM_MENU primary key (id),
                          constraint AK_CODE_ADM_MENU unique (code)
);

comment on table adm_menu is
'菜单';

comment on column adm_menu.id is
'ID';

comment on column adm_menu.parent_id is
'父菜单ID
为空表示根节点';

comment on column adm_menu.code is
'菜单编码';

comment on column adm_menu.name is
'菜单名称';

comment on column adm_menu.menu_type is
'菜单类型
1-目录
2-菜单
3-按钮';

comment on column adm_menu.path is
'前端路由路径';

comment on column adm_menu.component is
'前端组件路径';

comment on column adm_menu.perm is
'权限标识';

comment on column adm_menu.icon is
'图标';

comment on column adm_menu.sort is
'排序(升序)';

comment on column adm_menu.visible is
'是否显示';

comment on column adm_menu.enabled is
'启用';

comment on column adm_menu.remark is
'备注';

comment on column adm_menu.creater_id is
'创建者ID';

comment on column adm_menu.create_ms is
'创建时间戳';

comment on column adm_menu.updater_id is
'更新者ID';

comment on column adm_menu.update_ms is
'更新时间戳';

/*==============================================================*/
/* Index: adm_menu_PK                                           */
/*==============================================================*/
create unique index adm_menu_PK on adm_menu (
                                             id
    );

/*==============================================================*/
/* Index: Relationship_2_FK                                     */
/*==============================================================*/
create  index Relationship_2_FK on adm_menu (
                                              parent_id
    );

alter table adm_user
    add constraint fk_role_id__from__adm_role foreign key (role_id)
        references adm_role (id)
        on delete restrict on update restrict;

alter table adm_menu
    add constraint fk_parent_id__from__adm_menu foreign key (parent_id)
        references adm_menu (id)
        on delete restrict on update restrict;
