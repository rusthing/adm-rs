/*==============================================================*/
/* 后端配置化角色首页（方案三）                                   */
/*                                                              */
/* 结构：                                                        */
/* 1. adm_widget_type：widget 元数据（默认 service/endpoint + 参数）*/
/* 2. adm_dashboard：一份首页配置头；role_id 为空 = 全局兜底      */
/* 3. adm_dashboard_widget：widget 明细，sort_order 决定顺序      */
/*                                                              */
/* 约定（微服务 / BFF 架构）：                                    */
/* - 只存逻辑 service + endpoint 键（如 service=adm,             */
/*   endpoint=stats.count）；**不存 URL**，真实地址与凭据放在     */
/*   adm-svr 的服务注册表（dashboard-services.json / 环境变量）。 */
/* - params 以 JSON 文本存放，避免依赖数据库 JSON 类型。          */
/* - 本迁移可重复执行：先清掉 4 个角色 + 全局这 5 份预置配置，    */
/*   再按固定 id 重建；其它角色/用户自建的配置不受影响。          */
/*==============================================================*/

begin;

/*--------------------------------------------------------------*/
/* 1. 表结构                                                     */
/*--------------------------------------------------------------*/
create table if not exists adm_widget_type (
    id                  bigint primary key,
    code                varchar(32)  not null,
    name                varchar(64)  not null,
    default_service     varchar(32)  not null,
    default_endpoint    varchar(64)  not null,
    description         varchar(255) null,
    default_params      text         null,
    default_perm_urn    varchar(128) null,
    default_scope_aware boolean      not null default false,
    sort_order         integer      not null default 0,
    enabled            boolean      not null default true,
    creater_id         bigint       not null default 0,
    create_ms          bigint       not null default 0,
    updater_id         bigint       not null default 0,
    update_ms          bigint       not null default 0
);

create unique index if not exists ak_code_adm_widget_type
    on adm_widget_type (code);

create table if not exists adm_dashboard (
    id         bigint primary key,
    role_id    bigint       null references adm_role(id)
                 on update cascade on delete cascade,
    name       varchar(64)  not null,
    remark     varchar(255) null,
    enabled    boolean      not null default true,
    creater_id bigint       not null default 0,
    create_ms  bigint       not null default 0,
    updater_id bigint       not null default 0,
    update_ms  bigint       not null default 0
);

/* 每个角色最多一份；全局兜底只允许一份 */
create unique index if not exists ak_role_id_adm_dashboard
    on adm_dashboard (role_id) where role_id is not null;

create unique index if not exists ak_global_adm_dashboard
    on adm_dashboard ((role_id is null)) where role_id is null;

create table if not exists adm_dashboard_widget (
    id           bigint primary key,
    dashboard_id bigint       not null references adm_dashboard(id)
                   on update cascade on delete cascade,
    widget_type  varchar(32)  not null,
    title        varchar(64)  not null,
    service      varchar(32)  not null,
    endpoint     varchar(64)  not null,
    params       text         null,
    perm_urn     varchar(128) null,
    scope_aware  boolean      not null default false,
    sort_order   integer      not null default 0,
    enabled      boolean      not null default true,
    creater_id   bigint       not null default 0,
    create_ms    bigint       not null default 0,
    updater_id   bigint       not null default 0,
    update_ms    bigint       not null default 0,
    constraint adm_dashboard_widget_widget_type_adm_widget_type
        foreign key (widget_type) references adm_widget_type(code)
        on update cascade on delete restrict
);

create index if not exists idx_dashboard_id_and_sort_order_adm_dashboard_widget
    on adm_dashboard_widget (dashboard_id, sort_order);

/*--------------------------------------------------------------*/
/* 2. 首批 6 类 widget 元数据                                    */
/*--------------------------------------------------------------*/
insert into adm_widget_type (id, code, name, default_service, default_endpoint, description,
                             default_params, default_perm_urn, default_scope_aware,
                             sort_order, enabled,
                             creater_id, create_ms, updater_id, update_ms)
values
  (1, 'kpi', 'KPI 指标卡', 'adm', 'stats.count', '单个计数指标，参数 metric 决定统计对象',
   '{"metric":"users","label":"用户账号","path":"/users"}', 'GET:/adm/user', false,
   10, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2, 'trend', '趋势图', 'adm', 'stats.trend', '按天统计登录 / 操作日志，参数 days 支持 7 或 30',
   '{"days":7,"metric":"login"}', 'GET:/adm/login-log', false,
   20, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (3, 'todo', '待办清单', 'adm', 'stats.todos', '初始口令 / 锁定 / 过期 / 停用账号等待办',
   '{}', 'GET:/adm/user', false,
   30, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (4, 'recent_logs', '最近日志', 'adm', 'logs.recent', '最近登录或操作日志，参数 limit/source',
   '{"limit":5,"source":"login"}', 'GET:/adm/login-log', false,
   40, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (5, 'shortcuts', '快捷入口', 'adm', 'menu.shortcuts', '当前用户可见菜单里的快捷链接，参数 limit',
   '{"limit":8}', null, false,
   50, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (6, 'my_permissions', '我的权限摘要', 'adm', 'auth.my_permissions', '当前用户的角色 / 权限 / 菜单与可见范围说明',
   '{}', null, false,
   60, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict (id) do update
   set code               = excluded.code,
       name               = excluded.name,
       default_service    = excluded.default_service,
       default_endpoint   = excluded.default_endpoint,
       description        = excluded.description,
       default_params     = excluded.default_params,
       default_perm_urn   = excluded.default_perm_urn,
       default_scope_aware = excluded.default_scope_aware,
       sort_order         = excluded.sort_order,
       enabled            = excluded.enabled,
       update_ms          = excluded.update_ms;

/*--------------------------------------------------------------*/
/* 3. 清掉 5 份预置配置（4 角色 + 全局），其它角色配置保留        */
/*--------------------------------------------------------------*/
delete from adm_dashboard_widget
 where dashboard_id in (
     select id from adm_dashboard
      where role_id in (1, 2, 3, 4) or role_id is null
 );

delete from adm_dashboard
 where role_id in (1, 2, 3, 4) or role_id is null;

/*--------------------------------------------------------------*/
/* 4. 配置头                                                     */
/*--------------------------------------------------------------*/
insert into adm_dashboard (id, role_id, name, remark, enabled,
                           creater_id, create_ms, updater_id, update_ms)
values
  (1, null, '全局兜底首页', '没有任何角色级配置时使用', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2, 1, '平台管理员首页', '全量数据视图，含用户 / 角色 / 趋势 / 待办 / 日志 / 快捷入口',
   true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (3, 2, '系统管理员首页', '客户管理员视图，聚焦账号与角色治理',
   true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (4, 3, '组织管理员首页', '组织与人员视图；按领域 / 应用可见范围强制过滤',
   true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (5, 4, '审计员首页', '登录趋势与日志只读视图',
   true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8);

/*--------------------------------------------------------------*/
/* 5. widget 明细                                                */
/*--------------------------------------------------------------*/
insert into adm_dashboard_widget (id, dashboard_id, widget_type, title, service, endpoint,
                                  params, perm_urn, scope_aware, sort_order, enabled,
                                  creater_id, create_ms, updater_id, update_ms)
values
  /* 全局兜底 */
  (1001, 1, 'kpi',            '用户账号',       'adm', 'stats.count', '{"metric":"users","label":"用户账号","path":"/users"}',
   'GET:/adm/user', false, 10, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1002, 1, 'trend',          '登录趋势（7 日）', 'adm', 'stats.trend', '{"days":7,"metric":"login"}',
   'GET:/adm/login-log', false, 20, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1003, 1, 'todo',           '待办事项',       'adm', 'stats.todos', '{}',
   'GET:/adm/user', false, 30, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1004, 1, 'recent_logs',    '最近登录',       'adm', 'logs.recent', '{"limit":5,"source":"login"}',
   'GET:/adm/login-log', false, 40, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1005, 1, 'shortcuts',      '快捷入口',       'adm', 'menu.shortcuts', '{"limit":8}',
   null, false, 50, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1006, 1, 'my_permissions', '我的权限摘要',   'adm', 'auth.my_permissions', '{}',
   null, false, 60, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  /* 平台管理员：全量视图 */
  (2001, 2, 'kpi',            '用户账号',       'adm', 'stats.count', '{"metric":"users","label":"用户账号","path":"/users"}',
   'GET:/adm/user', false, 10, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2002, 2, 'kpi',            '角色数量',       'adm', 'stats.count', '{"metric":"roles","label":"角色数量","path":"/roles"}',
   'GET:/adm/role', false, 20, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2003, 2, 'trend',          '登录趋势（30 日）', 'adm', 'stats.trend', '{"days":30,"metric":"login"}',
   'GET:/adm/login-log', false, 30, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2004, 2, 'todo',           '待办事项',       'adm', 'stats.todos', '{}',
   'GET:/adm/user', false, 40, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2005, 2, 'recent_logs',    '最近登录',       'adm', 'logs.recent', '{"limit":5,"source":"login"}',
   'GET:/adm/login-log', false, 50, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2006, 2, 'shortcuts',      '快捷入口',       'adm', 'menu.shortcuts', '{"limit":8}',
   null, false, 60, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2007, 2, 'my_permissions', '我的权限摘要',   'adm', 'auth.my_permissions', '{}',
   null, false, 70, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  /* 系统管理员：账号 / 角色治理 */
  (3001, 3, 'kpi',            '用户账号',       'adm', 'stats.count', '{"metric":"users","label":"用户账号","path":"/users"}',
   'GET:/adm/user', false, 10, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (3002, 3, 'kpi',            '角色数量',       'adm', 'stats.count', '{"metric":"roles","label":"角色数量","path":"/roles"}',
   'GET:/adm/role', false, 20, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (3003, 3, 'trend',          '登录趋势（7 日）', 'adm', 'stats.trend', '{"days":7,"metric":"login"}',
   'GET:/adm/login-log', false, 30, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (3004, 3, 'todo',           '待办事项',       'adm', 'stats.todos', '{}',
   'GET:/adm/user', false, 40, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (3005, 3, 'shortcuts',      '快捷入口',       'adm', 'menu.shortcuts', '{"limit":8}',
   null, false, 50, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (3006, 3, 'my_permissions', '我的权限摘要',   'adm', 'auth.my_permissions', '{}',
   null, false, 60, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  /* 组织管理员：组织 / 人员；scopeAware 只标记，不启用过滤 */
  (4001, 4, 'kpi',            '组织数量',       'adm', 'stats.count', '{"metric":"orgs","label":"组织数量","path":"/orgs"}',
   'GET:/adm/org', true, 10, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (4002, 4, 'kpi',            '人员数量',       'adm', 'stats.count', '{"metric":"persons","label":"人员数量","path":"/persons"}',
   'GET:/adm/person', true, 20, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (4003, 4, 'todo',           '待办事项',       'adm', 'stats.todos', '{}',
   'GET:/adm/user', true, 30, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (4004, 4, 'shortcuts',      '快捷入口',       'adm', 'menu.shortcuts', '{"limit":8}',
   null, true, 40, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (4005, 4, 'my_permissions', '我的权限摘要',   'adm', 'auth.my_permissions', '{}',
   null, true, 50, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  /* 审计员：登录趋势 + 日志只读 */
  (5001, 5, 'kpi',            '登录次数',       'adm', 'stats.count', '{"metric":"login_logs","label":"登录次数","path":"/login-logs"}',
   'GET:/adm/login-log', false, 10, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (5002, 5, 'trend',          '登录趋势（30 日）', 'adm', 'stats.trend', '{"days":30,"metric":"login"}',
   'GET:/adm/login-log', false, 20, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (5003, 5, 'recent_logs',    '最近登录',       'adm', 'logs.recent', '{"limit":8,"source":"login"}',
   'GET:/adm/login-log', false, 30, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (5004, 5, 'shortcuts',      '快捷入口',       'adm', 'menu.shortcuts', '{"limit":8}',
   null, false, 40, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (5005, 5, 'my_permissions', '我的权限摘要',   'adm', 'auth.my_permissions', '{}',
   null, false, 50, true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8);

/*--------------------------------------------------------------*/
/* 6. 配置管理页菜单 + 权限                                     */
/*--------------------------------------------------------------*/
insert into adm_menu (id, app_id, tree_code, code, name, path, component, link_type,
                      icon, keep_alive, visible, remark, enabled,
                      creater_id, create_ms, updater_id, update_ms)
values
  (1008, 1, '003005', 'dashboard-config', '首页配置', '/dashboard-config', 'dashboard-config', 1,
   'layout-dashboard', false, true, '按角色配置首页 widget 列表', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict (id) do update
   set tree_code = excluded.tree_code,
       code = excluded.code,
       name = excluded.name,
       path = excluded.path,
       component = excluded.component,
       icon = excluded.icon,
       remark = excluded.remark,
       enabled = excluded.enabled,
       update_ms = excluded.update_ms;

insert into adm_perm (id, group_id, op_type_code, name, urn, sort_order, remark, enabled,
                      creater_id, create_ms, updater_id, update_ms)
values
  (1021, 1003, 'query',  '首页-聚合查询',   'GET:/adm/dashboard/summary',     230, '首页 widget 数据聚合', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1022, 1003, 'query',  '首页配置-查询',   'GET:/adm/dashboard/config',      231, '读取角色 / 全局首页配置', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1023, 1003, 'modify', '首页配置-保存',   'PUT:/adm/dashboard/config',      232, '整份替换角色 / 全局首页配置', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1024, 1003, 'del',    '首页配置-删除',   'DELETE:/adm/dashboard/config',   233, '删除角色配置，回落到全局模板', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1025, 1003, 'query',  'widget 类型-查询', 'GET:/adm/dashboard/widget-type', 234, 'widget 元数据目录', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict (id) do update
   set group_id     = excluded.group_id,
       op_type_code = excluded.op_type_code,
       name         = excluded.name,
       urn          = excluded.urn,
       sort_order   = excluded.sort_order,
       remark       = excluded.remark,
       enabled      = excluded.enabled,
       update_ms    = excluded.update_ms;

/*--------------------------------------------------------------*/
/* 7. 授权                                                       */
/*--------------------------------------------------------------*/
/* 平台管理员（role=1）：菜单 1008 + 5 个新权限 */
insert into adm_role_menu (id, menu_id, role_id, creater_id, create_ms, updater_id, update_ms)
values (92001, 1008, 1, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict do nothing;

insert into adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms)
values
  (92021, 1, 1021, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (92022, 1, 1022, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (92023, 1, 1023, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (92024, 1, 1024, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (92025, 1, 1025, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict do nothing;

/* 系统管理员（role=2，admin）：补父目录 1/8、首页配置菜单与 5 个权限 */
insert into adm_role_menu (id, menu_id, role_id, creater_id, create_ms, updater_id, update_ms)
values
  (2026, 1,    2, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2027, 8,    2, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2028, 1008, 2, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict do nothing;

insert into adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms)
values
  (2026, 2, 1021, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2027, 2, 1022, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2028, 2, 1023, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2029, 2, 1024, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2030, 2, 1025, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict do nothing;

/* 组织管理员（role=3）与审计员（role=4）：补「概览」目录 + 工作台菜单 + 首页聚合权限 */
insert into adm_role_menu (id, menu_id, role_id, creater_id, create_ms, updater_id, update_ms)
values
  (3019, 1, 3, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (3020, 2, 3, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (4003, 1, 4, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (4004, 2, 4, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict do nothing;

insert into adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms)
values
  (3019, 3, 1021, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (4003, 4, 1021, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict do nothing;

commit;
