-- 开发环境免登录使用的系统账号
--
-- `[auth] dev-bypass` 下所有请求都固定为 `user_id = 0`，因此 adm_user 里必须有
-- 这个真实存在的行：`/adm/auth/me`、菜单展开、登录日志/操作日志的外键都按它走。
-- 同时建一个「系统组」角色并授予全部菜单与权限，让开发态界面与生产态一致。
--
-- 本迁移只写不执行；重复执行是安全的（全部 on conflict do nothing）。

/*--------------------------------------------------------------*/
/* 1. 系统账号                                                    */
/*--------------------------------------------------------------*/
-- login_pswd 留成 64 个 0：系统账号不是给人登录用的，任何口令都算不出这个摘要。
insert into adm_user (id, person_id, name, nick_name,
                      mobile, mobile_verified, email, email_verified,
                      id_card, real_name, real_name_verified,
                      login_pswd, login_pswd_salt, login_pswd_default,
                      audit_pswd, audit_pswd_salt, pay_pswd, pay_pswd_salt,
                      expire_ms, status, fail_count, lock_until_ms, last_login_ms,
                      remark, enabled, creater_id, create_ms, updater_id, update_ms)
values (0, null, 'system', '系统账号',
        null, false, null, false,
        null, null, false,
        repeat('0', 64), '000000', false,
        repeat('0', 64), '000000', repeat('0', 64), '000000',
        null, 1, 0, null, null,
        '开发环境免登录使用的系统账号', true,
        0, (extract(epoch from now()) * 1000)::int8,
        0, (extract(epoch from now()) * 1000)::int8)
on conflict (id) do nothing;

/*--------------------------------------------------------------*/
/* 2. 「系统组」角色                                              */
/*--------------------------------------------------------------*/
insert into adm_role (id, group_id, name, sort_order, remark, enabled,
                      creater_id, create_ms, updater_id, update_ms)
values (5, 1, '系统组', 90, '开发环境系统账号使用的角色，拥有全部菜单与权限', true,
        0, (extract(epoch from now()) * 1000)::int8,
        0, (extract(epoch from now()) * 1000)::int8)
on conflict (id) do nothing;

/*--------------------------------------------------------------*/
/* 3. 账号与角色关联                                              */
/*--------------------------------------------------------------*/
insert into adm_role_user (id, user_id, role_id,
                           creater_id, create_ms, updater_id, update_ms)
values (1004, 0, 5,
        0, (extract(epoch from now()) * 1000)::int8,
        0, (extract(epoch from now()) * 1000)::int8)
on conflict do nothing;

/*--------------------------------------------------------------*/
/* 4. 角色菜单：全部菜单                                          */
/*--------------------------------------------------------------*/
insert into adm_role_menu (id, menu_id, role_id,
                           creater_id, create_ms, updater_id, update_ms)
select (select coalesce(max(id), 0) from adm_role_menu) + row_number() over (order by m.id),
       m.id, 5,
       0, (extract(epoch from now()) * 1000)::int8,
       0, (extract(epoch from now()) * 1000)::int8
from adm_menu m
where m.enabled = true
on conflict do nothing;

/*--------------------------------------------------------------*/
/* 5. 角色权限：全部权限                                          */
/*--------------------------------------------------------------*/
insert into adm_role_perm (id, role_id, perm_id,
                           creater_id, create_ms, updater_id, update_ms)
select (select coalesce(max(id), 0) from adm_role_perm) + row_number() over (order by p.id),
       5, p.id,
       0, (extract(epoch from now()) * 1000)::int8,
       0, (extract(epoch from now()) * 1000)::int8
from adm_perm p
where p.enabled = true
on conflict do nothing;
