-- adm 数据库迁移基线：init-index（普通索引）
--
-- 约束型索引随建表语句定义；此处只放独立 CREATE INDEX（含部分/表达式索引）。

CREATE INDEX idx_app_id_adm_role_app_scope ON public.adm_role_app_scope USING btree (app_id);

CREATE INDEX idx_dashboard_id_and_sort_order_adm_dashboard_widget ON public.adm_dashboard_widget USING btree (dashboard_id, sort_order);

CREATE INDEX idx_org_id_adm_role_org_scope ON public.adm_role_org_scope USING btree (org_id);

CREATE INDEX idx_realm_id_adm_role_realm_scope ON public.adm_role_realm_scope USING btree (realm_id);

CREATE INDEX idx_user_id_adm_org_user ON public.adm_org_user USING btree (user_id);

CREATE INDEX idx_user_id_adm_realm_user ON public.adm_realm_user USING btree (user_id);

CREATE INDEX relationship_10_fk ON public.adm_org_user USING btree (org_id);

CREATE INDEX relationship_11_fk ON public.adm_org_user USING btree (user_id);

CREATE INDEX relationship_12_fk ON public.adm_person USING btree (code_type_id);

CREATE INDEX relationship_13_fk ON public.adm_user USING btree (person_id);

CREATE INDEX relationship_14_fk ON public.adm_role USING btree (group_id);

CREATE INDEX relationship_16_fk ON public.adm_role_user USING btree (user_id);

CREATE INDEX relationship_17_fk ON public.adm_role_user USING btree (role_id);

CREATE INDEX relationship_18_fk ON public.adm_perm USING btree (group_id);

CREATE INDEX relationship_1_fk ON public.adm_org USING btree (org_type_id);

CREATE INDEX relationship_20_fk ON public.adm_role_perm USING btree (role_id);

CREATE INDEX relationship_21_fk ON public.adm_role_perm USING btree (perm_id);

CREATE INDEX relationship_23_fk ON public.adm_menu USING btree (app_id);

CREATE INDEX relationship_24_fk ON public.adm_menu_perm USING btree (menu_id);

CREATE INDEX relationship_25_fk ON public.adm_menu_perm USING btree (perm_id);

CREATE INDEX relationship_26_fk ON public.adm_role_menu USING btree (menu_id);

CREATE INDEX relationship_27_fk ON public.adm_role_menu USING btree (role_id);

CREATE INDEX relationship_28_fk ON public.adm_op_log USING btree (user_id);

CREATE INDEX relationship_29_fk ON public.adm_login_log USING btree (user_id);

CREATE INDEX relationship_30_fk ON public.adm_lock_log USING btree (user_id);

CREATE INDEX relationship_31_fk ON public.adm_op_log USING btree (op_type_code);

CREATE INDEX relationship_32_fk ON public.adm_perm USING btree (op_type_code);

CREATE INDEX relationship_3_fk ON public.adm_realm_org USING btree (realm_id);

CREATE INDEX relationship_4_fk ON public.adm_realm_org USING btree (org_id);

CREATE INDEX relationship_8_fk ON public.adm_realm_user USING btree (realm_id);

CREATE INDEX relationship_9_fk ON public.adm_realm_user USING btree (user_id);
