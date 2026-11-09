-- adm 数据库迁移基线：create-index（PD 表达不了的补充对象）
--
-- 本文件与 create-table.sql 共同构成完整 DDL：
--   * create-table.sql 是 model/create-table-pgsql.sql（PowerDesigner 导出）的副本；
--   * 这里只放 PowerDesigner 无法生成的 CHECK 约束、部分/表达式索引、性能索引。
-- 约束型索引（PK / AK / 外键索引）一律由 create-table.sql 里的 PD 语句定义，
-- 不在此重复创建。
--
-- 与 create-table.sql 一样，本文件两侧共用，执行结果必须零差异。

-- CHECK 约束（PowerDesigner 9.x 模板不生成）

ALTER TABLE adm_perm ADD CONSTRAINT ck_adm_perm_op_type CHECK (op_type_code::text = ANY (ARRAY['query'::character varying::text, 'add'::character varying::text, 'modify'::character varying::text, 'del'::character varying::text, 'reorder'::character varying::text, 'sync'::character varying::text, 'reset_password'::character varying::text]));

ALTER TABLE adm_user ADD CONSTRAINT ck_adm_user_real_name_paired CHECK ((real_name IS NULL) = (id_card IS NULL));

-- 部分 / 表达式 / 性能索引（PowerDesigner 不能自动生成）

CREATE UNIQUE INDEX ak_global_adm_dashboard ON adm_dashboard USING btree (((role_id IS NULL))) WHERE (role_id IS NULL);

CREATE UNIQUE INDEX ak_role_id_adm_dashboard ON adm_dashboard USING btree (role_id) WHERE (role_id IS NOT NULL);

CREATE INDEX idx_dashboard_id_and_sort_order_adm_dashboard_widget ON adm_dashboard_widget USING btree (dashboard_id, sort_order);
