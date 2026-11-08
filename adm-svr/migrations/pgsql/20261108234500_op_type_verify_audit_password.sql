-- 审核口令确认：操作类型
--
-- adm_auth_svc 的 verify-audit-password 会往 adm_op_log 写
-- op_type_code='verify_audit_password'，外键要求 adm_op_type 里先有这一行。
-- 「不存在才插入」，重复执行不会产生重复行。

insert into adm_op_type (id, code, name, sort_order, remark,
                         creater_id, create_ms, updater_id, update_ms)
select (select coalesce(max(id), 0) + 1 from adm_op_type),
       'verify_audit_password', '审核口令确认', 46, null,
       0, (extract(epoch from now()) * 1000)::int8,
       0, (extract(epoch from now()) * 1000)::int8
where not exists (select 1 from adm_op_type where code = 'verify_audit_password');
