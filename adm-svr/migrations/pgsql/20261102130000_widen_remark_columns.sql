-- 放宽备注列宽：修复全新库初始化失败
--
-- 背景：20261103120000_seed_realistic_rbac.sql 中「组织管理员」角色备注为
-- 「只管指定领域 / 组织 / 应用内的人员与组织；可见范围由三张 adm_role_*_scope 表决定」，
-- 共 52 个字符；而 adm_role.remark 建表时为 varchar(50)，空库执行种子时直接报
-- value too long for type character varying(50)，后续迁移全部无法执行。
--
-- 为什么新增前置迁移，而不是改历史迁移：
-- sqlx 会校验 `_sqlx_migrations` 中已应用迁移的 checksum，直接修改
-- 20261102093000_create-table.sql 或 20261103120000_seed_realistic_rbac.sql，
-- 已上线环境下次启动会因 checksum 不一致直接失败。这里只新增一个版本号更小的迁移：
--   * 空库：按版本顺序先于种子执行，种子正常写入；
--   * 存量库：sqlx 0.9 会把「未应用的低版本迁移」当作普通待应用迁移补跑，
--     仅放宽列宽，不读写业务数据，可重复执行。
--
-- varchar -> varchar 放宽在 PostgreSQL 中只改元数据、不重写表，锁持有时间极短；
-- 200 字符也覆盖后续种子 / 运营备注的常见长度。

alter table adm_role alter column remark type varchar(200);
