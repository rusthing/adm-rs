-- 人员类型字典：选项值来自旧 ADM 字典 DTW_LOCATION_LOGO_TYPE 的人员项（VALUE 0-3）
-- 人员档案只存字典 value（INT2），不建外键：同步链路是按值直传，不做 ID 映射

create table adm_person_type (
   id                   INT8                 not null,
   code                 VARCHAR(50)          not null,
   name                 VARCHAR(50)          not null,
   value                INT2                 not null,
   remark               VARCHAR(50)          null,
   enabled              BOOL                 not null default true,
   creater_id           INT8                 not null,
   create_ms            INT8                 not null,
   updater_id           INT8                 not null,
   update_ms            INT8                 not null,
   constraint PK_ADM_PERSON_TYPE primary key (id),
   constraint AK_CODE_ADM_PERSON_TYPE unique (code),
   constraint AK_NAME_ADM_PERSON_TYPE unique (name),
   constraint AK_VALUE_ADM_PERSON_TYPE unique (value)
);

comment on table adm_person_type is
'人员类型
选项值来自旧 ADM 字典 DTW_LOCATION_LOGO_TYPE 的人员项（0-3），业务表只存 value、不建外键';

comment on column adm_person_type.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_person_type.code is
'编码
与旧字典项 CODE 一致（INTERNAL_EMPLOYEES 等），全局唯一（AK）
@len 1..=50
@check is_code';

comment on column adm_person_type.name is
'名称
与旧字典项 NAME 一致，全局唯一（AK）
@len 1..=50';

comment on column adm_person_type.value is
'值
与旧字典项 VALUE 一致，人员档案的 person_type 存这个值；全局唯一（AK）
@range 0..=999';

comment on column adm_person_type.remark is
'备注
@len 0..=50';

comment on column adm_person_type.enabled is
'是否启用
false 时不可再被选择，历史数据与关联全部保留
与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用';

comment on column adm_person_type.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_person_type.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_person_type.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_person_type.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

create unique index adm_person_type_PK on adm_person_type (
id
);

alter table adm_person add column person_type INT2 null;

comment on column adm_person.person_type is
'人员类型
存 person_type.value（0 内部员工、1 第三方施工人员、2 访客、3 其他人员）；为空表示未分类
字典为弱引用，不建外键
@range 0..=999';

-- 种子：DTW_LOCATION_LOGO_TYPE 中的人员项（车辆项 4-9 不进入人员类型字典）
INSERT INTO public.adm_person_type (id, code, name, value, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (1, 'INTERNAL_EMPLOYEES', '柳化内部员工', 0, NULL, true, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_person_type (id, code, name, value, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (2, 'EXTERNAL_EMPLOYEES', '第三方施工人员', 1, NULL, true, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_person_type (id, code, name, value, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (3, 'VISITOR', '访客', 2, NULL, true, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_person_type (id, code, name, value, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (4, 'OTHER_USER', '其他人员', 3, NULL, true, 0, 1795500000, 0, 1795500000);

-- 权限分组：系统配置 → 人员类型 → 操作类型
INSERT INTO public.adm_perm_group (id, tree_code, name, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (2027, '001004014', '人员类型', 'adm_person_type：人员类型字典', true, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_perm_group (id, tree_code, name, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (3126, '001004014001', '新增', NULL, true, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_perm_group (id, tree_code, name, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (3127, '001004014002', '修改', NULL, true, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_perm_group (id, tree_code, name, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (3128, '001004014003', '删除', NULL, true, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_perm_group (id, tree_code, name, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (3129, '001004014004', '查询', NULL, true, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_perm_group (id, tree_code, name, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (3130, '001004014005', '同步', NULL, true, 0, 1795500000, 0, 1795500000);

-- 权限点：与 /adm/person-type 下的真实接口一一对应
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (557, 3126, 'person_type', 'add', '新增', 'POST:/adm/person-type', 10, NULL, true, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (558, 3126, 'person_type', 'add', '保存', 'POST:/adm/person-type/save', 20, NULL, true, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (559, 3126, 'person_type', 'add', '新增或更新', 'POST:/adm/person-type/upsert', 30, NULL, true, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (560, 3127, 'person_type', 'modify', '修改', 'PUT:/adm/person-type', 10, NULL, true, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (561, 3128, 'person_type', 'del', '按条件删除', 'DELETE:/adm/person-type', 10, NULL, true, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (562, 3128, 'person_type', 'del', '按 ID 删除', 'DELETE:/adm/person-type/{id}', 20, NULL, true, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (563, 3129, 'person_type', 'query', '条件查询', 'GET:/adm/person-type', 10, NULL, true, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (564, 3129, 'person_type', 'query', '扩展查询', 'GET:/adm/person-type/ex', 20, NULL, true, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (565, 3129, 'person_type', 'query', '按 ID 扩展查询', 'GET:/adm/person-type/ex/{id}', 30, NULL, true, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (566, 3129, 'person_type', 'query', '列表查询', 'GET:/adm/person-type/list', 40, NULL, true, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (567, 3129, 'person_type', 'query', '数量查询', 'GET:/adm/person-type/count', 50, NULL, true, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (568, 3129, 'person_type', 'query', '列表扩展查询', 'GET:/adm/person-type/list-ex', 60, NULL, true, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (569, 3129, 'person_type', 'query', '分页查询', 'GET:/adm/person-type/page', 70, NULL, true, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (570, 3129, 'person_type', 'query', '分页扩展查询', 'GET:/adm/person-type/page-ex', 80, NULL, true, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (571, 3129, 'person_type', 'query', '条件检索', 'GET:/adm/person-type/search', 90, NULL, true, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (572, 3129, 'person_type', 'query', '条件扩展检索', 'GET:/adm/person-type/search/ex', 100, NULL, true, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (573, 3129, 'person_type', 'query', '按 ID 条件扩展检索', 'GET:/adm/person-type/search/ex/{id}', 110, NULL, true, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (574, 3129, 'person_type', 'query', '条件列表查询', 'GET:/adm/person-type/search/list', 120, NULL, true, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (575, 3129, 'person_type', 'query', '条件列表扩展查询', 'GET:/adm/person-type/search/list-ex', 130, NULL, true, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (576, 3129, 'person_type', 'query', '条件分页查询', 'GET:/adm/person-type/search/page', 140, NULL, true, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (577, 3129, 'person_type', 'query', '条件分页扩展查询', 'GET:/adm/person-type/search/page-ex', 150, NULL, true, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (578, 3129, 'person_type', 'query', '按 ID 条件检索', 'GET:/adm/person-type/search/{id}', 160, NULL, true, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (579, 3129, 'person_type', 'query', '按 ID 查询', 'GET:/adm/person-type/{id}', 170, NULL, true, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (580, 3130, 'person_type', 'sync', '同步', 'POST:/adm/person-type/sync', 10, NULL, true, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (581, 3130, 'person_type', 'sync', '同步删除', 'DELETE:/adm/person-type/sync/{id}', 20, NULL, true, 0, 1795500000, 0, 1795500000);

-- 菜单：系统配置 → 人员类型
INSERT INTO public.adm_menu (id, app_id, tree_code, code, name, path, component, link_type, icon, keep_alive, visible, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (1010, 1, '004009', 'person-types', '人员类型', '/person-types', 'person-types', 1, 'profile', false, true, NULL, true, 0, 1795500000, 0, 1795500000);

-- 菜单授权：平台管理员 / 组织管理员 / 系统组
INSERT INTO public.adm_role_menu (id, menu_id, role_id, creater_id, create_ms, updater_id, update_ms) VALUES (92101, 1010, 1, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_menu (id, menu_id, role_id, creater_id, create_ms, updater_id, update_ms) VALUES (92102, 1010, 3, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_menu (id, menu_id, role_id, creater_id, create_ms, updater_id, update_ms) VALUES (92103, 1010, 5, 0, 1795500000, 0, 1795500000);

-- 权限授权：平台管理员 / 系统组全量；组织管理员与人员编码类型口径一致（查询 + 同步）
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92110, 1, 557, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92111, 1, 558, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92112, 1, 559, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92113, 1, 560, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92114, 1, 561, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92115, 1, 562, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92116, 1, 563, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92117, 1, 564, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92118, 1, 565, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92119, 1, 566, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92120, 1, 567, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92121, 1, 568, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92122, 1, 569, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92123, 1, 570, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92124, 1, 571, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92125, 1, 572, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92126, 1, 573, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92127, 1, 574, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92128, 1, 575, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92129, 1, 576, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92130, 1, 577, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92131, 1, 578, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92132, 1, 579, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92133, 1, 580, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92134, 1, 581, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92135, 5, 557, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92136, 5, 558, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92137, 5, 559, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92138, 5, 560, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92139, 5, 561, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92140, 5, 562, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92141, 5, 563, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92142, 5, 564, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92143, 5, 565, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92144, 5, 566, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92145, 5, 567, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92146, 5, 568, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92147, 5, 569, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92148, 5, 570, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92149, 5, 571, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92150, 5, 572, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92151, 5, 573, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92152, 5, 574, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92153, 5, 575, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92154, 5, 576, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92155, 5, 577, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92156, 5, 578, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92157, 5, 579, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92158, 5, 580, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92159, 5, 581, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92160, 3, 563, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92161, 3, 564, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92162, 3, 565, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92163, 3, 566, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92164, 3, 567, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92165, 3, 568, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92166, 3, 569, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92167, 3, 570, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92168, 3, 571, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92169, 3, 572, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92170, 3, 573, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92171, 3, 574, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92172, 3, 575, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92173, 3, 576, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92174, 3, 577, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92175, 3, 578, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92176, 3, 579, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92177, 3, 580, 0, 1795500000, 0, 1795500000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92178, 3, 581, 0, 1795500000, 0, 1795500000);
