-- 基础字典：把组织类型 / 人员类型 / 人员编码类型 / 人员标签类型从「系统配置」抽出来，
-- 统一挂到新的顶级目录「基础字典」下；页面 path 与 component 保持不变，只调整 tree_code。
-- 权限分组仍留在「系统配置」下：分组树固定四层，字典资源同属一类，不动层级。

-- 目录：基础字典（006）
INSERT INTO public.adm_menu (id, app_id, tree_code, code, name, path, component, link_type, icon, keep_alive, visible, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (1011, 1, '006', 'basic-dict', '基础字典', '/basic-dict', NULL, 1, 'book-open', false, true, '组织类型 / 人员类型 / 人员编码类型 / 人员标签类型等基础字典', true, 0, 1795858000, 0, 1795858000);

-- 已有三个字典菜单迁移到基础字典下（id / path / component 全部不变，只改 tree_code）
UPDATE public.adm_menu SET tree_code = '006001', update_ms = 1795858000 WHERE id = 1003;
UPDATE public.adm_menu SET tree_code = '006002', update_ms = 1795858000 WHERE id = 1010;
UPDATE public.adm_menu SET tree_code = '006003', update_ms = 1795858000 WHERE id = 1006;

-- 系统配置目录的说明不再包含字典（字典已迁到 006）
UPDATE public.adm_menu SET remark = '领域 / 应用 / 权限与菜单 / 首页配置入口', update_ms = 1795858000 WHERE id = 8;

-- 人员标签类型菜单：与另外三个字典页同级
INSERT INTO public.adm_menu (id, app_id, tree_code, code, name, path, component, link_type, icon, keep_alive, visible, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (1012, 1, '006004', 'person-tag-types', '人员标签类型', '/person-tag-types', 'person-tag-types', 1, 'tags', false, true, NULL, true, 0, 1795858000, 0, 1795858000);

-- 菜单授权：目录给到平台管理员 / 组织管理员 / 系统组；人员标签类型同样三组
INSERT INTO public.adm_role_menu (id, menu_id, role_id, creater_id, create_ms, updater_id, update_ms) VALUES (92201, 1011, 1, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_menu (id, menu_id, role_id, creater_id, create_ms, updater_id, update_ms) VALUES (92202, 1011, 3, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_menu (id, menu_id, role_id, creater_id, create_ms, updater_id, update_ms) VALUES (92203, 1011, 5, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_menu (id, menu_id, role_id, creater_id, create_ms, updater_id, update_ms) VALUES (92204, 1012, 1, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_menu (id, menu_id, role_id, creater_id, create_ms, updater_id, update_ms) VALUES (92205, 1012, 3, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_menu (id, menu_id, role_id, creater_id, create_ms, updater_id, update_ms) VALUES (92206, 1012, 5, 0, 1795858000, 0, 1795858000);

-- 权限分组：系统配置 → 人员标签类型 → 操作类型（与人员类型同层，001004015）
INSERT INTO public.adm_perm_group (id, tree_code, name, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (2028, '001004015', '人员标签类型', 'adm_person_tag_type：人员标签类型字典', true, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_perm_group (id, tree_code, name, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (3131, '001004015001', '新增', NULL, true, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_perm_group (id, tree_code, name, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (3132, '001004015002', '修改', NULL, true, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_perm_group (id, tree_code, name, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (3133, '001004015003', '删除', NULL, true, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_perm_group (id, tree_code, name, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (3134, '001004015004', '查询', NULL, true, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_perm_group (id, tree_code, name, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (3135, '001004015005', '同步', NULL, true, 0, 1795858000, 0, 1795858000);

-- 权限点：与 /adm/person-tag-type 下的真实接口一一对应
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (582, 3131, 'person_tag_type', 'add', '新增', 'POST:/adm/person-tag-type', 10, NULL, true, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (583, 3131, 'person_tag_type', 'add', '保存', 'POST:/adm/person-tag-type/save', 20, NULL, true, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (584, 3131, 'person_tag_type', 'add', '新增或更新', 'POST:/adm/person-tag-type/upsert', 30, NULL, true, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (585, 3132, 'person_tag_type', 'modify', '修改', 'PUT:/adm/person-tag-type', 10, NULL, true, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (607, 3132, 'person_tag_type', 'modify', '排序', 'POST:/adm/person-tag-type/reorder', 20, NULL, true, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (586, 3133, 'person_tag_type', 'del', '按条件删除', 'DELETE:/adm/person-tag-type', 10, NULL, true, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (587, 3133, 'person_tag_type', 'del', '按 ID 删除', 'DELETE:/adm/person-tag-type/{id}', 20, NULL, true, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (588, 3134, 'person_tag_type', 'query', '条件查询', 'GET:/adm/person-tag-type', 10, NULL, true, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (589, 3134, 'person_tag_type', 'query', '扩展查询', 'GET:/adm/person-tag-type/ex', 20, NULL, true, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (590, 3134, 'person_tag_type', 'query', '按 ID 扩展查询', 'GET:/adm/person-tag-type/ex/{id}', 30, NULL, true, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (591, 3134, 'person_tag_type', 'query', '列表查询', 'GET:/adm/person-tag-type/list', 40, NULL, true, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (592, 3134, 'person_tag_type', 'query', '数量查询', 'GET:/adm/person-tag-type/count', 50, NULL, true, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (593, 3134, 'person_tag_type', 'query', '列表扩展查询', 'GET:/adm/person-tag-type/list-ex', 60, NULL, true, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (594, 3134, 'person_tag_type', 'query', '分页查询', 'GET:/adm/person-tag-type/page', 70, NULL, true, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (595, 3134, 'person_tag_type', 'query', '分页扩展查询', 'GET:/adm/person-tag-type/page-ex', 80, NULL, true, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (596, 3134, 'person_tag_type', 'query', '条件检索', 'GET:/adm/person-tag-type/search', 90, NULL, true, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (597, 3134, 'person_tag_type', 'query', '条件扩展检索', 'GET:/adm/person-tag-type/search/ex', 100, NULL, true, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (598, 3134, 'person_tag_type', 'query', '按 ID 条件扩展检索', 'GET:/adm/person-tag-type/search/ex/{id}', 110, NULL, true, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (599, 3134, 'person_tag_type', 'query', '条件列表查询', 'GET:/adm/person-tag-type/search/list', 120, NULL, true, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (600, 3134, 'person_tag_type', 'query', '条件列表扩展查询', 'GET:/adm/person-tag-type/search/list-ex', 130, NULL, true, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (601, 3134, 'person_tag_type', 'query', '条件分页查询', 'GET:/adm/person-tag-type/search/page', 140, NULL, true, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (602, 3134, 'person_tag_type', 'query', '条件分页扩展查询', 'GET:/adm/person-tag-type/search/page-ex', 150, NULL, true, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (603, 3134, 'person_tag_type', 'query', '按 ID 条件检索', 'GET:/adm/person-tag-type/search/{id}', 160, NULL, true, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (604, 3134, 'person_tag_type', 'query', '按 ID 查询', 'GET:/adm/person-tag-type/{id}', 170, NULL, true, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (605, 3135, 'person_tag_type', 'sync', '同步', 'POST:/adm/person-tag-type/sync', 10, NULL, true, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_perm (id, group_id, subject_code, op_type_code, name, urn, sort_order, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (606, 3135, 'person_tag_type', 'sync', '同步删除', 'DELETE:/adm/person-tag-type/sync/{id}', 20, NULL, true, 0, 1795858000, 0, 1795858000);

-- 权限授权：平台管理员与系统组全量；组织管理员与人员类型口径一致（查询 + 同步）
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92210, 1, 582, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92211, 1, 583, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92212, 1, 584, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92213, 1, 585, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92214, 1, 586, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92215, 1, 587, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92216, 1, 588, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92217, 1, 589, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92218, 1, 590, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92219, 1, 591, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92220, 1, 592, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92221, 1, 593, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92222, 1, 594, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92223, 1, 595, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92224, 1, 596, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92225, 1, 597, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92226, 1, 598, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92227, 1, 599, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92228, 1, 600, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92229, 1, 601, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92230, 1, 602, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92231, 1, 603, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92232, 1, 604, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92233, 1, 605, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92234, 1, 606, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92235, 5, 582, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92236, 5, 583, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92237, 5, 584, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92238, 5, 585, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92239, 5, 586, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92240, 5, 587, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92241, 5, 588, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92242, 5, 589, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92243, 5, 590, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92244, 5, 591, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92245, 5, 592, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92246, 5, 593, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92247, 5, 594, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92248, 5, 595, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92249, 5, 596, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92250, 5, 597, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92251, 5, 598, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92252, 5, 599, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92253, 5, 600, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92254, 5, 601, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92255, 5, 602, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92256, 5, 603, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92257, 5, 604, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92258, 5, 605, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92259, 5, 606, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92260, 3, 588, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92261, 3, 589, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92262, 3, 590, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92263, 3, 591, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92264, 3, 592, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92265, 3, 593, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92266, 3, 594, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92267, 3, 595, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92268, 3, 596, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92269, 3, 597, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92270, 3, 598, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92271, 3, 599, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92272, 3, 600, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92273, 3, 601, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92274, 3, 602, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92275, 3, 603, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92276, 3, 604, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92277, 3, 605, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92278, 3, 606, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92279, 1, 607, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92280, 3, 607, 0, 1795858000, 0, 1795858000);
INSERT INTO public.adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms) VALUES (92281, 5, 607, 0, 1795858000, 0, 1795858000);
