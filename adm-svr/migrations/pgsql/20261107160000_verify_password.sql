-- 高危操作口令二次确认：操作类型与频控选项
--
-- 审计写入 adm_op_log 需要 op_type_code 外键，先补一行类型；
-- 频控参数写进 adm_option，运维改完不用重启服务。
-- 全部用「不存在才插入」，重复执行不会产生重复行。

insert into adm_op_type (id, code, name, sort_order, remark,
                         creater_id, create_ms, updater_id, update_ms)
select (select coalesce(max(id), 0) + 1 from adm_op_type),
       'verify_password', '口令二次确认', 45, null,
       0, (extract(epoch from now()) * 1000)::int8,
       0, (extract(epoch from now()) * 1000)::int8
where not exists (select 1 from adm_op_type where code = 'verify_password');

insert into adm_option (id, code, name, value, remark,
                        creater_id, create_ms, updater_id, update_ms)
select (select coalesce(max(id), 0) + 1 from adm_option),
       'verify_password_fail_limit', '口令二次确认失败阈值', '5',
       '同一用户窗口内错误达到该次数后进入频控',
       0, (extract(epoch from now()) * 1000)::int8,
       0, (extract(epoch from now()) * 1000)::int8
where not exists (select 1 from adm_option where code = 'verify_password_fail_limit');

insert into adm_option (id, code, name, value, remark,
                        creater_id, create_ms, updater_id, update_ms)
select (select coalesce(max(id), 0) + 1 from adm_option),
       'verify_password_window_ms', '口令二次确认失败计数窗口(毫秒)', '600000',
       '窗口从第一次失败开始计时，窗口内累计',
       0, (extract(epoch from now()) * 1000)::int8,
       0, (extract(epoch from now()) * 1000)::int8
where not exists (select 1 from adm_option where code = 'verify_password_window_ms');
