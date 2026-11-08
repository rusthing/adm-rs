-- 权限种子补齐：分组树调整 + 权限点覆盖全部路由 + 角色授权
--
-- 目标：
-- 1. 权限分组保持两级（后台管理 → 4 个域 → 9 个子组），1001-1004 沿用原 ID 改名，
--    新增 2001-2009；现有权限只改 group_id，ID / URN / 名称一律不动；
-- 2. 按「HTTP 方法 + 资源根路径」补齐所有缺失权限点；关联表（role_* / realm_* /
--    menu_perm）同样补 CRUD 点；reorder / sync / reset-password 单独成点，
--    方便后续按高危操作精确授权；
-- 3. 日志只读：登录 / 操作 / 锁定日志只有 GET，不再有写权限点；
-- 4. adm_perm.op_type_code 先回填再升级为 NOT NULL，并加取值 CHECK；
-- 5. 角色授权：平台管理员与开发系统组全量，系统管理员 / 审计员按下面清单补；
--    菜单树与 role_menu 不做迁移（菜单归属不变）。
--
-- 本迁移可重复执行（insert 一律 on conflict do nothing / 按 id 更新）。

/*--------------------------------------------------------------*/
/* 1. 操作类型：补排序、同步、重置口令                            */
/*--------------------------------------------------------------*/
insert into adm_op_type (id, code, name, sort_order, remark,
                         creater_id, create_ms, updater_id, update_ms)
select (select coalesce(max(id), 0) + 1 from adm_op_type),
       'reorder', '排序', 50, '调整同级记录顺序', 0,
       (extract(epoch from now()) * 1000)::int8,
       0, (extract(epoch from now()) * 1000)::int8
where not exists (select 1 from adm_op_type where code = 'reorder');

insert into adm_op_type (id, code, name, sort_order, remark,
                         creater_id, create_ms, updater_id, update_ms)
select (select coalesce(max(id), 0) + 1 from adm_op_type),
       'sync', '同步', 51, '把外部 / 缓存数据同步进库', 0,
       (extract(epoch from now()) * 1000)::int8,
       0, (extract(epoch from now()) * 1000)::int8
where not exists (select 1 from adm_op_type where code = 'sync');

insert into adm_op_type (id, code, name, sort_order, remark,
                         creater_id, create_ms, updater_id, update_ms)
select (select coalesce(max(id), 0) + 1 from adm_op_type),
       'reset_password', '重置口令', 52, '管理员重置他人登录口令', 0,
       (extract(epoch from now()) * 1000)::int8,
       0, (extract(epoch from now()) * 1000)::int8
where not exists (select 1 from adm_op_type where code = 'reset_password');

/*--------------------------------------------------------------*/
/* 2. 权限分组：1001-1004 改名，新增 2001-2009 子组              */
/*--------------------------------------------------------------*/
insert into adm_perm_group (id, tree_code, name, remark, enabled,
                            creater_id, create_ms, updater_id, update_ms)
values
  (1001, '001001', '用户与身份',   '账号 / 人员 / 组织成员', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1002, '001002', '角色与授权',   '角色 / 菜单 / 权限 / 授权关系 / 首页配置', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1003, '001003', '系统配置',     '领域 / 应用 / 组织 / 字典', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1004, '001004', '日志审计',     '登录 / 操作 / 锁定日志只读查询', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  (2001, '001001001', '账号管理',     '用户账号、重置口令', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2002, '001001002', '人员管理',     '人员、人员编码类型', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2003, '001001003', '组织成员',     '组织与用户的绑定关系', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  (2004, '001002001', '角色管理',     '角色、角色分组、角色首页配置', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2005, '001002002', '菜单与权限',   '菜单、权限、权限分组、菜单绑定', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2006, '001002003', '授权关系',     '角色-菜单 / 角色-权限 / 角色-用户', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  (2007, '001003001', '领域与应用',   '领域、应用、领域成员与组织', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2008, '001003002', '组织体系',     '组织、组织类型', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2009, '001003003', '字典与选项',   '操作类型、选项字典', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict (id) do update
   set tree_code = excluded.tree_code,
       name      = excluded.name,
       remark    = excluded.remark,
       enabled   = excluded.enabled,
       update_ms = excluded.update_ms;

/* 现有权限重新挂到子组；ID / URN / 名称不动 */
update adm_perm set group_id = 2001, update_ms = (extract(epoch from now()) * 1000)::int8 where id between 1 and 4;
update adm_perm set group_id = 2002, update_ms = (extract(epoch from now()) * 1000)::int8 where id between 1009 and 1016;
update adm_perm set group_id = 2003, update_ms = (extract(epoch from now()) * 1000)::int8 where id between 1018 and 1020;
update adm_perm set group_id = 2004, update_ms = (extract(epoch from now()) * 1000)::int8 where id between 5 and 8;
update adm_perm set group_id = 2004, update_ms = (extract(epoch from now()) * 1000)::int8 where id between 17 and 20;
update adm_perm set group_id = 2004, update_ms = (extract(epoch from now()) * 1000)::int8 where id between 1021 and 1026;
update adm_perm set group_id = 2005, update_ms = (extract(epoch from now()) * 1000)::int8 where id between 9 and 16;
update adm_perm set group_id = 2005, update_ms = (extract(epoch from now()) * 1000)::int8 where id between 21 and 24;
update adm_perm set group_id = 2007, update_ms = (extract(epoch from now()) * 1000)::int8 where id between 25 and 32;
update adm_perm set group_id = 2008, update_ms = (extract(epoch from now()) * 1000)::int8 where id between 1001 and 1008;
update adm_perm set group_id = 1004, update_ms = (extract(epoch from now()) * 1000)::int8 where id = 33;
update adm_perm set group_id = 1004, update_ms = (extract(epoch from now()) * 1000)::int8 where id = 1017;

/*--------------------------------------------------------------*/
/* 3. 补齐缺失的 CRUD / 关联表 / 首页配置权限点                   */
/*--------------------------------------------------------------*/
insert into adm_perm (id, group_id, op_type_code, name, urn, sort_order, remark, enabled,
                      creater_id, create_ms, updater_id, update_ms)
values
  /* 组织成员补 PUT；锁定日志只读 */
  (1027, 2003, 'modify', '组织成员-修改', 'PUT:/adm/org-user',       133, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1028, 1004, 'query',  '锁定日志-查询', 'GET:/adm/lock-log',       12, '账号锁定 / 解锁记录只读', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  /* 领域成员 */
  (1029, 2007, 'query',  '领域成员-查询', 'GET:/adm/realm-user',     250, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1030, 2007, 'add',    '领域成员-绑定', 'POST:/adm/realm-user',    251, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1031, 2007, 'modify', '领域成员-修改', 'PUT:/adm/realm-user',     252, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1032, 2007, 'del',    '领域成员-解绑', 'DELETE:/adm/realm-user',  253, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  /* 领域组织 */
  (1033, 2007, 'query',  '领域组织-查询', 'GET:/adm/realm-org',      260, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1034, 2007, 'add',    '领域组织-绑定', 'POST:/adm/realm-org',     261, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1035, 2007, 'modify', '领域组织-修改', 'PUT:/adm/realm-org',      262, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1036, 2007, 'del',    '领域组织-解绑', 'DELETE:/adm/realm-org',   263, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  /* 角色菜单 */
  (1037, 2006, 'query',  '角色菜单-查询', 'GET:/adm/role-menu',      150, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1038, 2006, 'add',    '角色菜单-授权', 'POST:/adm/role-menu',     151, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1039, 2006, 'modify', '角色菜单-修改', 'PUT:/adm/role-menu',      152, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1040, 2006, 'del',    '角色菜单-回收', 'DELETE:/adm/role-menu',   153, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  /* 角色权限 */
  (1041, 2006, 'query',  '角色权限-查询', 'GET:/adm/role-perm',      160, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1042, 2006, 'add',    '角色权限-授权', 'POST:/adm/role-perm',     161, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1043, 2006, 'modify', '角色权限-修改', 'PUT:/adm/role-perm',      162, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1044, 2006, 'del',    '角色权限-回收', 'DELETE:/adm/role-perm',   163, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  /* 角色用户 */
  (1045, 2006, 'query',  '角色用户-查询', 'GET:/adm/role-user',      170, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1046, 2006, 'add',    '角色用户-绑定', 'POST:/adm/role-user',     171, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1047, 2006, 'modify', '角色用户-修改', 'PUT:/adm/role-user',      172, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1048, 2006, 'del',    '角色用户-解绑', 'DELETE:/adm/role-user',   173, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  /* 菜单权限绑定 */
  (1049, 2005, 'query',  '菜单绑定-查询', 'GET:/adm/menu-perm',      70, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1050, 2005, 'add',    '菜单绑定-授权', 'POST:/adm/menu-perm',     71, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1051, 2005, 'modify', '菜单绑定-修改', 'PUT:/adm/menu-perm',      72, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1052, 2005, 'del',    '菜单绑定-回收', 'DELETE:/adm/menu-perm',   73, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  /* 操作类型字典 */
  (1053, 2009, 'query',  '操作类型-查询', 'GET:/adm/op-type',        270, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1054, 2009, 'add',    '操作类型-新增', 'POST:/adm/op-type',       271, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1055, 2009, 'modify', '操作类型-修改', 'PUT:/adm/op-type',        272, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1056, 2009, 'del',    '操作类型-删除', 'DELETE:/adm/op-type',     273, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  /* 选项字典 */
  (1057, 2009, 'query',  '选项-查询', 'GET:/adm/option',             280, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1058, 2009, 'add',    '选项-新增', 'POST:/adm/option',            281, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1059, 2009, 'modify', '选项-修改', 'PUT:/adm/option',             282, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1060, 2009, 'del',    '选项-删除', 'DELETE:/adm/option',          283, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  /* 首页 widget 运行时数据（POST 但语义为查询） */
  (1061, 2004, 'query',  'widget 数据-查询', 'POST:/adm/widget-data', 236, '按端点读取 widget 数据，只读语义', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict (id) do nothing;

/*--------------------------------------------------------------*/
/* 4. sync 独立权限点（每个可写资源一个）                        */
/*--------------------------------------------------------------*/
insert into adm_perm (id, group_id, op_type_code, name, urn, sort_order, remark, enabled,
                      creater_id, create_ms, updater_id, update_ms)
values
  (1062, 2001, 'sync', '用户-同步',           'POST:/adm/user/sync',              140, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1063, 2004, 'sync', '角色-同步',           'POST:/adm/role/sync',              140, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1064, 2005, 'sync', '菜单-同步',           'POST:/adm/menu/sync',              140, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1065, 2005, 'sync', '权限-同步',           'POST:/adm/perm/sync',              141, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1066, 2004, 'sync', '角色分组-同步',       'POST:/adm/role-group/sync',        141, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1067, 2005, 'sync', '权限分组-同步',       'POST:/adm/perm-group/sync',        142, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1068, 2007, 'sync', '领域-同步',           'POST:/adm/realm/sync',              240, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1069, 2007, 'sync', '应用-同步',           'POST:/adm/app/sync',                241, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1070, 2008, 'sync', '组织-同步',           'POST:/adm/org/sync',                240, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1071, 2008, 'sync', '组织类型-同步',       'POST:/adm/org-type/sync',           241, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1072, 2002, 'sync', '人员-同步',           'POST:/adm/person/sync',             140, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1073, 2002, 'sync', '人员编码类型-同步',   'POST:/adm/person-code-type/sync',   141, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1074, 2003, 'sync', '组织成员-同步',       'POST:/adm/org-user/sync',           140, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1075, 2007, 'sync', '领域成员-同步',       'POST:/adm/realm-user/sync',         242, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1076, 2007, 'sync', '领域组织-同步',       'POST:/adm/realm-org/sync',          243, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1077, 2006, 'sync', '角色菜单-同步',       'POST:/adm/role-menu/sync',          140, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1078, 2006, 'sync', '角色权限-同步',       'POST:/adm/role-perm/sync',          141, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1079, 2006, 'sync', '角色用户-同步',       'POST:/adm/role-user/sync',          142, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1080, 2005, 'sync', '菜单绑定-同步',       'POST:/adm/menu-perm/sync',          143, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1081, 2009, 'sync', '操作类型-同步',       'POST:/adm/op-type/sync',            240, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1082, 2009, 'sync', '选项-同步',           'POST:/adm/option/sync',             241, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict (id) do nothing;

/*--------------------------------------------------------------*/
/* 5. reorder 独立权限点（树形 / 有序资源）                       */
/*--------------------------------------------------------------*/
insert into adm_perm (id, group_id, op_type_code, name, urn, sort_order, remark, enabled,
                      creater_id, create_ms, updater_id, update_ms)
values
  (1083, 2007, 'reorder', '领域-排序',         'POST:/adm/realm/reorder',             250, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1084, 2007, 'reorder', '应用-排序',         'POST:/adm/app/reorder',               251, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1085, 2005, 'reorder', '权限-排序',         'POST:/adm/perm/reorder',              150, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1086, 2004, 'reorder', '角色-排序',         'POST:/adm/role/reorder',              150, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1087, 2009, 'reorder', '操作类型-排序',     'POST:/adm/op-type/reorder',           250, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1088, 2008, 'reorder', '组织类型-排序',     'POST:/adm/org-type/reorder',          250, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1089, 2002, 'reorder', '人员编码类型-排序', 'POST:/adm/person-code-type/reorder',  150, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1090, 2005, 'reorder', '菜单-排序',         'POST:/adm/menu/reorder',              151, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1091, 2004, 'reorder', '角色分组-排序',     'POST:/adm/role-group/reorder',        151, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1092, 2005, 'reorder', '权限分组-排序',     'POST:/adm/perm-group/reorder',        152, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1093, 2008, 'reorder', '组织-排序',         'POST:/adm/org/reorder',               251, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict (id) do nothing;

/*--------------------------------------------------------------*/
/* 6. 重置口令独立权限点                                          */
/*--------------------------------------------------------------*/
insert into adm_perm (id, group_id, op_type_code, name, urn, sort_order, remark, enabled,
                      creater_id, create_ms, updater_id, update_ms)
values
  (1094, 2001, 'reset_password', '用户-重置口令', 'POST:/adm/user/{id}/reset-password', 141,
   '管理员重置他人登录口令；不能重置自己的口令', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict (id) do nothing;

/*--------------------------------------------------------------*/
/* 7. op_type_code 回填并升级为 NOT NULL + CHECK                 */
/*--------------------------------------------------------------*/
/* 历史数据可能由旧版界面写入空值；统一回填为查询，保持可追溯 */
update adm_perm
   set op_type_code = 'query',
       update_ms    = (extract(epoch from now()) * 1000)::int8
 where op_type_code is null or btrim(op_type_code) = '';

alter table adm_perm alter column op_type_code set not null;

alter table adm_perm drop constraint if exists CK_ADM_PERM_OP_TYPE;
alter table adm_perm
  add constraint CK_ADM_PERM_OP_TYPE check (op_type_code in (
    'query', 'add', 'modify', 'del', 'reorder', 'sync', 'reset_password'
  ));

/*--------------------------------------------------------------*/
/* 8. 角色授权                                                   */
/*--------------------------------------------------------------*/
/* 平台管理员（role=1）：全部权限（含新增） */
insert into adm_role_perm (id, role_id, perm_id,
                           creater_id, create_ms, updater_id, update_ms)
select (select coalesce(max(id), 0) from adm_role_perm) + row_number() over (order by p.id),
       1, p.id,
       0, (extract(epoch from now()) * 1000)::int8,
       0, (extract(epoch from now()) * 1000)::int8
from adm_perm p
where p.enabled = true
  and not exists (
    select 1 from adm_role_perm rp where rp.role_id = 1 and rp.perm_id = p.id
  )
on conflict do nothing;

/* 开发系统组（role=5）：全部权限，与平台管理员一致 */
insert into adm_role_perm (id, role_id, perm_id,
                           creater_id, create_ms, updater_id, update_ms)
select (select coalesce(max(id), 0) from adm_role_perm) + row_number() over (order by p.id),
       5, p.id,
       0, (extract(epoch from now()) * 1000)::int8,
       0, (extract(epoch from now()) * 1000)::int8
from adm_perm p
where p.enabled = true
  and not exists (
    select 1 from adm_role_perm rp where rp.role_id = 5 and rp.perm_id = p.id
  )
on conflict do nothing;

/* 系统管理员（role=2）：补客户管理员日常需要的新点
 *   - 首页配置全量（1021-1026）与 widget 运行时数据（1061）
 *   - 领域 / 组织成员绑定（realm-user、realm-org、role-user）
 *   - 锁定日志只读（1028）
 *   - 用户重置口令（1094）
 *   - 表单字典只读：操作类型（1053）、选项（1057）
 *   - 已管资源的 sync / reorder：user、role、role-group、perm-group、realm、app
 * 不授予：菜单 / 权限 / 授权关系 / 字典增删改 / 组织域配置（归组织管理员） */
insert into adm_role_perm (id, role_id, perm_id,
                           creater_id, create_ms, updater_id, update_ms)
select (select coalesce(max(id), 0) from adm_role_perm) + row_number() over (order by g.perm_id),
       2, g.perm_id,
       0, (extract(epoch from now()) * 1000)::int8,
       0, (extract(epoch from now()) * 1000)::int8
from (values
  (1021), (1022), (1023), (1024), (1025), (1026), (1061),
  (1028),
  (1029), (1030), (1031), (1032),
  (1033), (1034), (1035), (1036),
  (1045), (1046), (1047), (1048),
  (1094),
  (1053), (1057),
  (1062), (1063), (1066), (1067), (1068), (1069),
  (1083), (1084), (1086), (1091), (1092)
) as g(perm_id)
where exists (select 1 from adm_perm p where p.id = g.perm_id and p.enabled = true)
  and not exists (
    select 1 from adm_role_perm rp where rp.role_id = 2 and rp.perm_id = g.perm_id
  )
on conflict do nothing;

/* 审计员（role=4）：日志只读全部补齐；首页生效配置与 widget 数据用于正常进入后台 */
insert into adm_role_perm (id, role_id, perm_id,
                           creater_id, create_ms, updater_id, update_ms)
select (select coalesce(max(id), 0) from adm_role_perm) + row_number() over (order by g.perm_id),
       4, g.perm_id,
       0, (extract(epoch from now()) * 1000)::int8,
       0, (extract(epoch from now()) * 1000)::int8
from (values (1028), (1021), (1061)) as g(perm_id)
where exists (select 1 from adm_perm p where p.id = g.perm_id and p.enabled = true)
  and not exists (
    select 1 from adm_role_perm rp where rp.role_id = 4 and rp.perm_id = g.perm_id
  )
on conflict do nothing;

/* 组织管理员（role=3）：维持现有能力——组织成员补 PUT，并给已有资源的 sync / reorder；
 * 首页只补生效配置与 widget 运行时数据；重置口令、日志审计与底层配置仍不授予 */
insert into adm_role_perm (id, role_id, perm_id,
                           creater_id, create_ms, updater_id, update_ms)
select (select coalesce(max(id), 0) from adm_role_perm) + row_number() over (order by g.perm_id),
       3, g.perm_id,
       0, (extract(epoch from now()) * 1000)::int8,
       0, (extract(epoch from now()) * 1000)::int8
from (values
  (1021), (1061),
  (1027),
  (1062), (1070), (1071), (1072), (1073), (1074),
  (1088), (1089), (1093)
) as g(perm_id)
where exists (select 1 from adm_perm p where p.id = g.perm_id and p.enabled = true)
  and not exists (
    select 1 from adm_role_perm rp where rp.role_id = 3 and rp.perm_id = g.perm_id
  )
on conflict do nothing;
