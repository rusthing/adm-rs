-- 首页 widget 逻辑端点目录
--
-- 只登记 `service` + `endpoint` 逻辑键，用于配置层校验与管理页下拉；
-- 不保存任何 URL / 凭据 / 健康状态，寻址与鉴权由 gatex 网关和 Consul 负责。
-- 可重复执行。

/*--------------------------------------------------------------*/
/* 1. 端点目录表                                                 */
/*--------------------------------------------------------------*/
create table if not exists adm_widget_endpoint (
    id            bigint       not null,
    service       varchar(32)  not null,
    endpoint      varchar(64)  not null,
    name          varchar(64)  not null,
    method        varchar(8)   not null default 'POST',
    params_hint   varchar(255),
    enabled       boolean      not null default true,
    note          varchar(255),
    sort_order    integer      not null default 0,
    creater_id    bigint       not null default 0,
    create_ms     bigint       not null default 0,
    updater_id    bigint       not null default 0,
    update_ms     bigint       not null default 0,
    constraint pk_adm_widget_endpoint primary key (id)
);
create unique index if not exists ak_service_and_endpoint_adm_widget_endpoint
    on adm_widget_endpoint (service, endpoint);

/*--------------------------------------------------------------*/
/* 2. 首批 adm 域端点 + 后续服务占位（停用，待各服务补齐）        */
/*--------------------------------------------------------------*/
insert into adm_widget_endpoint
    (id, service, endpoint, name, method, params_hint, enabled, note, sort_order,
     creater_id, create_ms, updater_id, update_ms)
values
  (6001, 'adm', 'stats.count', '指标计数', 'POST', 'metric=users|roles|menus|perms|orgs|persons|realms|login_logs|op_logs', true, 'adm 自身账号域统计', 10, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (6002, 'adm', 'stats.trend', '趋势统计', 'POST', 'days=1..90, metric=login|op', true, 'adm 自身登录 / 操作趋势', 20, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (6003, 'adm', 'stats.todos', '账号治理待办', 'POST', '{}', true, '初始口令 / 锁定 / 过期 / 停用账号', 30, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (6004, 'adm', 'logs.recent', '最近日志', 'POST', 'limit=1..20, source=login|op', true, 'adm 登录 / 操作日志', 40, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (6005, 'adm', 'menu.shortcuts', '快捷入口', 'POST', 'limit=1..20', true, '当前用户可见菜单', 50, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (6006, 'adm', 'auth.my_permissions', '我的权限摘要', 'POST', '{}', true, '当前用户角色 / 权限 / 菜单', 60, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (6101, 'jobx', 'stats.today', '今日任务执行', 'POST', '{}', false, 'jobx-svr 需补齐：今日成功 / 失败任务数与趋势', 70, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (6102, 'jobx', 'todo.my', '我的任务待办', 'POST', '{}', false, 'jobx-svr 需补齐：当前用户待处理任务', 80, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (6201, 'oss', 'stats.storage', '存储概览', 'POST', '{}', false, 'oss-svr 需补齐：对象数 / 容量 / 今日上传', 90, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (6202, 'oss', 'todo.unbound_person', '无账号人员', 'POST', '{}', false, 'oss-svr 需补齐：组织内未绑定账号的人员数', 100, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (6301, 'msg', 'stats.today', '消息发送概览', 'POST', '{}', false, 'msg-svr 需补齐：今日发送 / 失败消息数', 110, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (6302, 'msg', 'todo.unread', '未读消息提醒', 'POST', '{}', false, 'msg-svr 需补齐：当前用户未读消息数', 120, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict (id) do update
   set service     = excluded.service,
       endpoint    = excluded.endpoint,
       name        = excluded.name,
       method      = excluded.method,
       params_hint = excluded.params_hint,
       enabled     = excluded.enabled,
       note        = excluded.note,
       sort_order  = excluded.sort_order,
       update_ms   = excluded.update_ms;

/*--------------------------------------------------------------*/
/* 3. 权限 URN 调整                                              */
/*--------------------------------------------------------------*/
/* 1021 原为 summary 聚合；最终架构下 summary 取消，改为「生效配置」。 */
update adm_perm
   set name      = '首页-生效配置',
       urn       = 'GET:/adm/dashboard/effective',
       remark    = '读取当前用户按角色优先级生效的首页配置',
       update_ms = (extract(epoch from now()) * 1000)::int8
 where id = 1021;

insert into adm_perm (id, group_id, op_type_code, name, urn, sort_order, remark, enabled,
                      creater_id, create_ms, updater_id, update_ms)
values
  (1026, 1003, 'query', 'widget 端点目录', 'GET:/adm/dashboard/endpoints', 235, '逻辑 service/endpoint 白名单', true,
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

/* 配置管理页只给平台 / 系统管理员 */
insert into adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms)
values
  (92026, 1, 1026, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2031,  2, 1026, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict do nothing;
