/*==============================================================*/
/* 初始化数据                                                    */
/*                                                              */
/* 种子 ID 用 1、2、3 这种小整数，方便人工对照；运行期新增的记录   */
/* 由 idworker 生成雪花 ID，不会撞车。                            */
/*                                                              */
/* 默认口令：admin123（盐值 adm，摘要见 adm-svr.toml 的 password-salt）*/
/* 上线前务必改掉，或直接删掉这条种子用户改用接口创建。            */
/*==============================================================*/


/*==============================================================*/
/* 角色                                                          */
/*==============================================================*/
insert into adm_role (id, code, name, data_scope, sort, enabled, remark,
                      creater_id, create_ms, updater_id, update_ms)
values (1, 'SUPER_ADMIN', '超级管理员', 1, 1, true, '内置角色，拥有全部权限',
        0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8);

insert into adm_role (id, code, name, data_scope, sort, enabled, remark,
                      creater_id, create_ms, updater_id, update_ms)
values (2, 'READONLY', '只读用户', 5, 2, true, '内置角色，只能查看本人数据',
        0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8);


/*==============================================================*/
/* 菜单：目录                                                    */
/*==============================================================*/
insert into adm_menu (id, parent_id, code, name, menu_type, path, component, perm, icon,
                      sort, visible, enabled, remark,
                      creater_id, create_ms, updater_id, update_ms)
values (1, null, 'system', '系统管理', 1, '/system', null, null, 'Setting',
        1, true, true, null,
        0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8);


/*==============================================================*/
/* 菜单：页面                                                    */
/*==============================================================*/
insert into adm_menu (id, parent_id, code, name, menu_type, path, component, perm, icon,
                      sort, visible, enabled, remark,
                      creater_id, create_ms, updater_id, update_ms)
values (2, 1, 'system:user', '用户管理', 2, '/system/user', 'system/user/index', 'system:user:list', 'User',
        1, true, true, null,
        0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8);

insert into adm_menu (id, parent_id, code, name, menu_type, path, component, perm, icon,
                      sort, visible, enabled, remark,
                      creater_id, create_ms, updater_id, update_ms)
values (3, 1, 'system:role', '角色管理', 2, '/system/role', 'system/role/index', 'system:role:list', 'Team',
        2, true, true, null,
        0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8);

insert into adm_menu (id, parent_id, code, name, menu_type, path, component, perm, icon,
                      sort, visible, enabled, remark,
                      creater_id, create_ms, updater_id, update_ms)
values (4, 1, 'system:menu', '菜单管理', 2, '/system/menu', 'system/menu/index', 'system:menu:list', 'Menu',
        3, true, true, null,
        0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8);


/*==============================================================*/
/* 菜单：按钮（visible 恒为 false，不显示在侧边栏）                */
/*==============================================================*/
insert into adm_menu (id, parent_id, code, name, menu_type, path, component, perm, icon,
                      sort, visible, enabled, remark,
                      creater_id, create_ms, updater_id, update_ms)
values (5, 2, 'system:user:add', '新增用户', 3, null, null, 'system:user:add', null,
        1, false, true, null,
        0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8);

insert into adm_menu (id, parent_id, code, name, menu_type, path, component, perm, icon,
                      sort, visible, enabled, remark,
                      creater_id, create_ms, updater_id, update_ms)
values (6, 2, 'system:user:modify', '编辑用户', 3, null, null, 'system:user:modify', null,
        2, false, true, null,
        0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8);

insert into adm_menu (id, parent_id, code, name, menu_type, path, component, perm, icon,
                      sort, visible, enabled, remark,
                      creater_id, create_ms, updater_id, update_ms)
values (7, 2, 'system:user:reset-password', '重置口令', 3, null, null, 'system:user:reset-password', null,
        3, false, true, null,
        0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8);

insert into adm_menu (id, parent_id, code, name, menu_type, path, component, perm, icon,
                      sort, visible, enabled, remark,
                      creater_id, create_ms, updater_id, update_ms)
values (8, 2, 'system:user:del', '删除用户', 3, null, null, 'system:user:del', null,
        4, false, true, null,
        0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8);


/*==============================================================*/
/* 用户                                                          */
/*==============================================================*/
insert into adm_user (id, role_id, username, nickname, password, mobile, email, avatar,
                      status, last_login_ms, remark,
                      creater_id, create_ms, updater_id, update_ms)
values (1, 1, 'admin', '超级管理员', 'c5fb8790c70419b9b7b2871cd70c9144eac4826b2ecda756788673f133c46753',
        null, null, null, 1, null, '内置管理员，默认口令 admin123',
        0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8);
