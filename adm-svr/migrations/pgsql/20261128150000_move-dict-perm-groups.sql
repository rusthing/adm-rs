-- 权限分组跟着菜单一起调整：把四个字典主体从「系统配置」挪到新的二级分组「基础字典」。
-- 只改 tree_code（父子关系靠编码前缀），分组 id 与权限点的 group_id 全部不动，
-- 角色授权按 perm_id 绑定，也不需要重发。

-- 系统配置分组的说明同步去掉字典（字典主体已迁到 001006）
UPDATE public.adm_perm_group SET remark = '领域 / 应用 / 权限与菜单 / 首页配置', update_ms = 1795859000 WHERE id = 1003;

-- 二级分组：基础字典（与菜单 006 对齐；001006 在审计日志之后）
INSERT INTO public.adm_perm_group (id, tree_code, name, remark, enabled, creater_id, create_ms, updater_id, update_ms) VALUES (2029, '001006', '基础字典', '组织类型 / 人员编码类型 / 人员类型 / 人员标签类型', true, 0, 1795859000, 0, 1795859000);

-- 组织类型：001004004 → 001006001
UPDATE public.adm_perm_group SET tree_code = '001006001', update_ms = 1795859000 WHERE id = 2002;
UPDATE public.adm_perm_group SET tree_code = replace(tree_code, '001004004', '001006001'), update_ms = 1795859000 WHERE tree_code LIKE '001004004%' AND tree_code <> '001004004';

-- 人员编码类型：001004005 → 001006002
UPDATE public.adm_perm_group SET tree_code = '001006002', update_ms = 1795859000 WHERE id = 2005;
UPDATE public.adm_perm_group SET tree_code = replace(tree_code, '001004005', '001006002'), update_ms = 1795859000 WHERE tree_code LIKE '001004005%' AND tree_code <> '001004005';

-- 人员类型：001004014 → 001006003
UPDATE public.adm_perm_group SET tree_code = '001006003', update_ms = 1795859000 WHERE id = 2027;
UPDATE public.adm_perm_group SET tree_code = replace(tree_code, '001004014', '001006003'), update_ms = 1795859000 WHERE tree_code LIKE '001004014%' AND tree_code <> '001004014';

-- 人员标签类型：001004015 → 001006004
UPDATE public.adm_perm_group SET tree_code = '001006004', update_ms = 1795859000 WHERE id = 2028;
UPDATE public.adm_perm_group SET tree_code = replace(tree_code, '001004015', '001006004'), update_ms = 1795859000 WHERE tree_code LIKE '001004015%' AND tree_code <> '001004015';
