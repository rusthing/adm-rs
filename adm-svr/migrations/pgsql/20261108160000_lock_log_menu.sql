-- 补齐「锁定日志」菜单与授权
--
-- 后端 `/adm/lock-log` 只读接口、权限点 GET:/adm/lock-log（id=1028）都已存在，
-- 但 adm_menu 里没有对应节点，前端只能直接拼 URL，侧栏无法进入。这里补一个
-- 与「操作日志」同级的菜单，并按操作日志的授权范围补 role_menu：
-- 平台管理员（1）/ 审计员（4）/ 开发系统组（5）。
-- 系统管理员（2）与操作日志保持一致——不给菜单（权限点保留，接口层仍可控）。
--
-- 可重复执行：菜单按 (app_id, code) 判重，授权按 (menu_id, role_id) 判重。

insert into adm_menu (id, app_id, tree_code, code, name, path, component, link_type,
                      icon, keep_alive, visible, remark, enabled,
                      creater_id, create_ms, updater_id, update_ms)
select 1009,
       1,
       '004003',
       'lock-logs',
       '锁定日志',
       '/lock-logs',
       'lock-logs',
       1,
       'lock',
       false,
       true,
       '账号锁定 / 解锁记录只读',
       true,
       0,
       (extract(epoch from now()) * 1000)::int8,
       0,
       (extract(epoch from now()) * 1000)::int8
where not exists (
  select 1
    from adm_menu
   where id = 1009
      or (app_id = 1 and code = 'lock-logs')
      or (app_id = 1 and tree_code = '004003')
);

insert into adm_role_menu (id, menu_id, role_id, creater_id, create_ms, updater_id, update_ms)
select (select coalesce(max(id), 0) from adm_role_menu) + row_number() over (order by v.role_id),
       m.id,
       v.role_id,
       0,
       (extract(epoch from now()) * 1000)::int8,
       0,
       (extract(epoch from now()) * 1000)::int8
  from (values (1), (4), (5)) as v(role_id)
  join adm_menu m on m.app_id = 1 and m.code = 'lock-logs'
  join adm_role r on r.id = v.role_id
 where not exists (
   select 1 from adm_role_menu x where x.menu_id = m.id and x.role_id = v.role_id
 );
