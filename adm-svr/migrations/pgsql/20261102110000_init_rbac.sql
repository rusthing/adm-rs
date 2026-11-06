/*==============================================================*/
/* RBAC 种子：领域 / 应用 / 角色 / 权限 / 菜单 / 授权            */
/*                                                              */
/* 目标：开箱登录（admin/admin123）即可拿到完整菜单与权限。        */
/*                                                              */
/* 说明：                                                         */
/* 1. 全部 insert 带 on conflict do nothing，可在既有库与新库上    */
/*    重复执行（既有库这些表当前为空，新库上同样安全）。            */
/* 2. 菜单 component 为空表示目录，非空时前端按约定映射到页面组件。 */
/* 3. 权限 URN 统一 METHOD:路径，与业务接口前缀一一对应。          */
/*==============================================================*/

/*--------------------------------------------------------------*/
/* 1. admin 只保留登录口令，审计/支付口令留空（列 NOT NULL，写空串） */
/*--------------------------------------------------------------*/
update adm_user
set audit_pswd      = '',
    audit_pswd_salt = '',
    pay_pswd        = '',
    pay_pswd_salt   = ''
where id = 1;

/*--------------------------------------------------------------*/
/* 2. 领域与应用                                                  */
/*--------------------------------------------------------------*/
insert into adm_realm (id, code, name, sort_order, remark, enabled,
                       creater_id, create_ms, updater_id, update_ms)
values (1, 'adm', '管理后台', 10, '内置管理后台领域', true,
        0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict do nothing;

insert into adm_app (id, code, name, sort_order, remark, enabled,
                     creater_id, create_ms, updater_id, update_ms)
values (1, 'adm', '管理后台', 10, '内置管理后台应用', true,
        0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict do nothing;

/*--------------------------------------------------------------*/
/* 3. 角色分组与角色                                              */
/*--------------------------------------------------------------*/
insert into adm_role_group (id, tree_code, name, remark, enabled,
                            creater_id, create_ms, updater_id, update_ms)
values (1, '001', '超级管理员组', '内置角色分组', true,
        0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict do nothing;

insert into adm_role (id, group_id, name, sort_order, remark, enabled,
                      creater_id, create_ms, updater_id, update_ms)
values (1, 1, '超级管理员', 10, '拥有全部菜单与权限', true,
        0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict do nothing;

/*--------------------------------------------------------------*/
/* 4. 权限分组                                                    */
/*--------------------------------------------------------------*/
insert into adm_perm_group (id, tree_code, name, remark, enabled,
                            creater_id, create_ms, updater_id, update_ms)
values (1, '001', '管理后台权限', '内置权限分组', true,
        0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict do nothing;

/*--------------------------------------------------------------*/
/* 5. 权限（URN = METHOD:路径）                                   */
/*--------------------------------------------------------------*/
insert into adm_perm (id, group_id, op_type_code, name, urn, sort_order, remark, enabled,
                      creater_id, create_ms, updater_id, update_ms)
values
  (1,  1, 'query',  '用户-查询',   'GET:/adm/user',          10, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2,  1, 'add',    '用户-新增',   'POST:/adm/user',         11, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (3,  1, 'modify', '用户-修改',   'PUT:/adm/user',          12, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (4,  1, 'del',    '用户-删除',   'DELETE:/adm/user',       13, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  (5,  1, 'query',  '角色-查询',   'GET:/adm/role',          20, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (6,  1, 'add',    '角色-新增',   'POST:/adm/role',         21, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (7,  1, 'modify', '角色-修改',   'PUT:/adm/role',          22, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (8,  1, 'del',    '角色-删除',   'DELETE:/adm/role',       23, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  (9,  1, 'query',  '菜单-查询',   'GET:/adm/menu',          30, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (10, 1, 'add',    '菜单-新增',   'POST:/adm/menu',         31, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (11, 1, 'modify', '菜单-修改',   'PUT:/adm/menu',          32, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (12, 1, 'del',    '菜单-删除',   'DELETE:/adm/menu',       33, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  (13, 1, 'query',  '权限-查询',   'GET:/adm/perm',          40, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (14, 1, 'add',    '权限-新增',   'POST:/adm/perm',         41, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (15, 1, 'modify', '权限-修改',   'PUT:/adm/perm',          42, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (16, 1, 'del',    '权限-删除',   'DELETE:/adm/perm',       43, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  (17, 1, 'query',  '角色分组-查询', 'GET:/adm/role-group',   50, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (18, 1, 'add',    '角色分组-新增', 'POST:/adm/role-group',  51, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (19, 1, 'modify', '角色分组-修改', 'PUT:/adm/role-group',   52, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (20, 1, 'del',    '角色分组-删除', 'DELETE:/adm/role-group', 53, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  (21, 1, 'query',  '权限分组-查询', 'GET:/adm/perm-group',   60, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (22, 1, 'add',    '权限分组-新增', 'POST:/adm/perm-group',  61, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (23, 1, 'modify', '权限分组-修改', 'PUT:/adm/perm-group',   62, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (24, 1, 'del',    '权限分组-删除', 'DELETE:/adm/perm-group', 63, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  (25, 1, 'query',  '领域-查询',   'GET:/adm/realm',         70, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (26, 1, 'add',    '领域-新增',   'POST:/adm/realm',        71, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (27, 1, 'modify', '领域-修改',   'PUT:/adm/realm',         72, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (28, 1, 'del',    '领域-删除',   'DELETE:/adm/realm',      73, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  (29, 1, 'query',  '应用-查询',   'GET:/adm/app',           80, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (30, 1, 'add',    '应用-新增',   'POST:/adm/app',          81, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (31, 1, 'modify', '应用-修改',   'PUT:/adm/app',           82, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (32, 1, 'del',    '应用-删除',   'DELETE:/adm/app',        83, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  (33, 1, 'query',  '登录日志-查询', 'GET:/adm/login-log',    90, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict do nothing;

/*--------------------------------------------------------------*/
/* 6. 菜单树                                                      */
/*                                                              */
/* component 为空 = 目录；非空 = 前端页面组件标识                  */
/*--------------------------------------------------------------*/
insert into adm_menu (id, app_id, tree_code, code, name, path, component, link_type,
                      icon, keep_alive, visible, remark, enabled,
                      creater_id, create_ms, updater_id, update_ms)
values
  (1, 1, '001',    'overview',          '概览',     '/overview',   null,             1,
   'layout-dashboard', false, true, '概览目录', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2, 1, '001001', 'dashboard',         '工作台',   '/dashboard',  'dashboard',      1,
   'gauge', false, true, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  (3, 1, '002',    'access',            '权限体系', '/access',     null,             1,
   'shield', false, true, '权限体系目录', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (4, 1, '002001', 'users',             '用户管理', '/users',      'users',          1,
   'users', false, true, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (5, 1, '002002', 'roles',             '角色管理', '/roles',      'roles',          1,
   'user-cog', false, true, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (6, 1, '002003', 'menus',             '菜单管理', '/menus',      'menus',          1,
   'menu', false, true, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (7, 1, '002004', 'permissions',       '权限管理', '/permissions','permissions',    1,
   'key-round', false, true, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  (8, 1, '003',    'settings',          '配置管理', '/settings',   null,             1,
   'settings', false, true, '配置管理目录', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (9, 1, '003001', 'role-groups',       '角色分组', '/role-groups','role-groups',    1,
   'folder-tree', false, true, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (10,1, '003002', 'permission-groups', '权限分组', '/permission-groups','permission-groups', 1,
   'layers', false, true, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (11,1, '003003', 'realms',            '领域管理', '/realms',     'realms',         1,
   'globe', false, true, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (12,1, '003004', 'apps',              '应用管理', '/apps',       'apps',           1,
   'app-window', false, true, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  (13,1, '004',    'audit',             '审计日志', '/audit',      null,             1,
   'file-text', false, true, '审计日志目录', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (14,1, '004001', 'login-logs',        '登录日志', '/login-logs', 'login-logs',     1,
   'log-in', false, true, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict do nothing;

/*--------------------------------------------------------------*/
/* 7. 授权：超管角色 → 全部菜单 / 全部权限；admin → 超管角色        */
/*--------------------------------------------------------------*/
insert into adm_role_menu (id, menu_id, role_id,
                           creater_id, create_ms, updater_id, update_ms)
select gs.id, gs.id, 1,
       0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8
from generate_series(1, 14) as gs(id)
on conflict do nothing;

insert into adm_role_perm (id, role_id, perm_id,
                           creater_id, create_ms, updater_id, update_ms)
select gs.id, 1, gs.id,
       0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8
from generate_series(1, 33) as gs(id)
on conflict do nothing;

insert into adm_role_user (id, user_id, role_id,
                           creater_id, create_ms, updater_id, update_ms)
values (1, 1, 1,
        0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict do nothing;
