-- 外键命名规范化：robotech 运行时按 `{表}_{列}_{被引用表}` 查找外键，
-- 初始迁移用的是 `fk_{列}__from__{表}`，导致删除被引用数据时元数据查询失败：
--   adm_login_log_user_id_adm_user不存在
--
-- 本迁移把全部业务外键改为框架期望的名字。做法是先 drop 旧约束，再按规范名重建。
--
-- 删除行为：
-- * 登录 / 锁定 / 操作日志的 user_id 外键使用 ON DELETE CASCADE：
--   用户被删除时清掉其审计日志，否则 RESTRICT 会让「删除有过登录记录的用户」永远失败；
-- * 其余业务关联仍保持 ON UPDATE RESTRICT ON DELETE RESTRICT，避免误删授权关系。
--
-- 可重复执行：旧约束与规范名约束都先 `if exists` 删除，再按上表重建。

do $$
declare
    r record;
begin
    for r in
        select * from (values
            ('adm_app',        'fk_realm_id__from__adm_realm',         'adm_app_realm_id_adm_realm',                 'realm_id',       'adm_realm',           'id',   'restrict'),
            ('adm_lock_log',   'fk_user_id__from__adm_user',           'adm_lock_log_user_id_adm_user',               'user_id',        'adm_user',            'id',   'cascade'),
            ('adm_login_log',  'fk_user_id__from__adm_user',           'adm_login_log_user_id_adm_user',              'user_id',        'adm_user',            'id',   'cascade'),
            ('adm_menu',       'fk_app_id__from__adm_app',             'adm_menu_app_id_adm_app',                     'app_id',         'adm_app',             'id',   'restrict'),
            ('adm_menu_perm',  'fk_menu_id__from__adm_menu',           'adm_menu_perm_menu_id_adm_menu',              'menu_id',        'adm_menu',            'id',   'restrict'),
            ('adm_menu_perm',  'fk_perm_id__from__adm_perm',           'adm_menu_perm_perm_id_adm_perm',              'perm_id',        'adm_perm',            'id',   'restrict'),
            ('adm_op_log',     'fk_op_type_code__from__adm_op_type',   'adm_op_log_op_type_code_adm_op_type',         'op_type_code',   'adm_op_type',         'code', 'restrict'),
            ('adm_op_log',     'fk_user_id__from__adm_user',           'adm_op_log_user_id_adm_user',                 'user_id',        'adm_user',            'id',   'cascade'),
            ('adm_org',        'fk_org_type_id__from__adm_org_type',   'adm_org_org_type_id_adm_org_type',            'org_type_id',    'adm_org_type',        'id',   'restrict'),
            ('adm_org_user',   'fk_org_id__from__adm_org',             'adm_org_user_org_id_adm_org',                 'org_id',         'adm_org',             'id',   'restrict'),
            ('adm_org_user',   'fk_user_id__from__adm_user',           'adm_org_user_user_id_adm_user',               'user_id',        'adm_user',            'id',   'restrict'),
            ('adm_perm',       'fk_group_id__from__adm_perm_group',    'adm_perm_group_id_adm_perm_group',            'group_id',       'adm_perm_group',      'id',   'restrict'),
            ('adm_perm',       'fk_op_type_code__from__adm_op_type',   'adm_perm_op_type_code_adm_op_type',           'op_type_code',   'adm_op_type',         'code', 'restrict'),
            ('adm_perm_group', 'fk_realm_id__from__adm_realm',         'adm_perm_group_realm_id_adm_realm',           'realm_id',       'adm_realm',           'id',   'restrict'),
            ('adm_person',     'fk_code_type_id__from__adm_person_code_type', 'adm_person_code_type_id_adm_person_code_type', 'code_type_id', 'adm_person_code_type', 'id', 'restrict'),
            ('adm_realm_org',  'fk_org_id__from__adm_org',             'adm_realm_org_org_id_adm_org',                'org_id',         'adm_org',             'id',   'restrict'),
            ('adm_realm_org',  'fk_realm_id__from__adm_realm',         'adm_realm_org_realm_id_adm_realm',            'realm_id',       'adm_realm',           'id',   'restrict'),
            ('adm_realm_user', 'fk_realm_id__from__adm_realm',         'adm_realm_user_realm_id_adm_realm',           'realm_id',       'adm_realm',           'id',   'restrict'),
            ('adm_realm_user', 'fk_user_id__from__adm_user',           'adm_realm_user_user_id_adm_user',             'user_id',        'adm_user',            'id',   'restrict'),
            ('adm_role',       'fk_group_id__from__adm_role_group',    'adm_role_group_id_adm_role_group',            'group_id',       'adm_role_group',      'id',   'restrict'),
            ('adm_role_group', 'fk_realm_id__from__adm_realm',         'adm_role_group_realm_id_adm_realm',           'realm_id',       'adm_realm',           'id',   'restrict'),
            ('adm_role_menu',  'fk_menu_id__from__adm_menu',           'adm_role_menu_menu_id_adm_menu',              'menu_id',        'adm_menu',            'id',   'restrict'),
            ('adm_role_menu',  'fk_role_id__from__adm_role',           'adm_role_menu_role_id_adm_role',              'role_id',        'adm_role',            'id',   'restrict'),
            ('adm_role_perm',  'fk_perm_id__from__adm_perm',           'adm_role_perm_perm_id_adm_perm',              'perm_id',        'adm_perm',            'id',   'restrict'),
            ('adm_role_perm',  'fk_role_id__from__adm_role',           'adm_role_perm_role_id_adm_role',              'role_id',        'adm_role',            'id',   'restrict'),
            ('adm_role_user',  'fk_role_id__from__adm_role',           'adm_role_user_role_id_adm_role',              'role_id',        'adm_role',            'id',   'restrict'),
            ('adm_role_user',  'fk_user_id__from__adm_user',           'adm_role_user_user_id_adm_user',              'user_id',        'adm_user',            'id',   'restrict'),
            ('adm_user',       'fk_person_id__from__adm_person',       'adm_user_person_id_adm_person',               'person_id',      'adm_person',           'id',   'restrict')
        ) as v(tbl, old_name, new_name, col, ref_tbl, ref_col, on_delete)
    loop
        execute format('alter table %I drop constraint if exists %I', r.tbl, r.old_name);
        execute format('alter table %I drop constraint if exists %I', r.tbl, r.new_name);
        execute format(
            'alter table %I add constraint %I foreign key (%I) references %I(%I) on update restrict on delete %s',
            r.tbl, r.new_name, r.col, r.ref_tbl, r.ref_col, r.on_delete
        );
    end loop;
end $$;
