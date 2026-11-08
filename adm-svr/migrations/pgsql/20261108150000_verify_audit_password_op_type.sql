-- 补「审核口令二次确认」操作类型
--
-- 背景：删除等高风险操作会调用 POST /adm/auth/verify-audit-password，
-- 校验结果写入 adm_op_log 时使用 op_type_code = 'verify_audit_password'。
-- 该类型此前没有任何种子/迁移，adm_op_log 的 op_type_code 外键会在写审计日志时失败，
-- 导致口令校验接口返回 500。本迁移只补字典行，可重复执行。

insert into adm_op_type (id, code, name, sort_order, remark, creater_id, create_ms, updater_id, update_ms)
select
    coalesce((select max(id) from adm_op_type), 0) + 1,
    'verify_audit_password',
    '审核口令二次确认',
    46,
    '高危操作（如删除）前校验本人审核口令',
    0,
    (extract(epoch from now()) * 1000)::bigint,
    0,
    (extract(epoch from now()) * 1000)::bigint
where not exists (
    select 1 from adm_op_type where code = 'verify_audit_password'
);
