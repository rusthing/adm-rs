/*==============================================================*/
/* RBAC 种子重构：更真实、可参考、便于后续扩展                    */
/*                                                              */
/* 目标：                                                       */
/*  1. 权限分组按「用户与身份 / 角色与授权 / 系统配置 / 日志审计」*/
/*     四层组织；第一层叫「后台管理」。                          */
/*  2. 角色分组两组：管理组下三种角色（平台管理员 / 系统管理员 / */
/*     组织管理员），审计组下审计员。                            */
/*  3. 三个 demo 用户：super / admin / owl，各自口令与默认角色。  */
/*  4. 菜单按角色重新收敛；新增组织 / 人员 / 操作日志节点。       */
/*  5. 授权：每角色只授自己工作范围的权限 / 菜单。                */
/*                                                              */
/* 幂等：所有 insert 带 on conflict do nothing；所有 update 有    */
/*      精确 where 条件，可在既有库 / 新库重复执行。             */
/*==============================================================*/

begin;

/*--------------------------------------------------------------*/
/* 1. 领域 / 应用：保持 id=1 不变，名字改成「后台」/「后台管理」 */
/*--------------------------------------------------------------*/
update adm_realm
   set name      = '后台',
       remark    = '默认管理后台领域',
       update_ms = (extract(epoch from now()) * 1000)::int8
 where id = 1;

update adm_app
   set name      = '后台管理',
       remark    = '默认管理后台应用',
       update_ms = (extract(epoch from now()) * 1000)::int8
 where id = 1;

/*--------------------------------------------------------------*/
/* 2. 权限分组：根节点改名，新增 4 个子分组并把现有权限重新归类    */
/*--------------------------------------------------------------*/
update adm_perm_group
   set name      = '后台管理',
       remark    = '内置根权限分组',
       update_ms = (extract(epoch from now()) * 1000)::int8
 where id = 1;

insert into adm_perm_group (id, tree_code, name, remark, enabled,
                           creater_id, create_ms, updater_id, update_ms)
values
  (1001, '001001', '用户与身份管理', '账号 / 人员 / 口令', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1002, '001002', '角色与授权管理', '角色 / 菜单 / 权限 / 分组', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1003, '001003', '系统配置', '领域 / 应用 / 组织 / 人员编码', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1004, '001004', '日志审计', '登录 / 操作日志只读查询', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict do nothing;

/* 现有 33 个权限重新分到 4 个子分组 */
update adm_perm set group_id = 1001, update_ms = (extract(epoch from now()) * 1000)::int8 where id between 1  and 4;
update adm_perm set group_id = 1002, update_ms = (extract(epoch from now()) * 1000)::int8 where id between 5  and 24;
update adm_perm set group_id = 1003, update_ms = (extract(epoch from now()) * 1000)::int8 where id between 25 and 32;
update adm_perm set group_id = 1004, update_ms = (extract(epoch from now()) * 1000)::int8 where id = 33;

/* 补齐系统配置 / 日志审计缺的权限（组织 / 人员 / 操作日志） */
insert into adm_perm (id, group_id, op_type_code, name, urn, sort_order, remark, enabled,
                     creater_id, create_ms, updater_id, update_ms)
values
  /* 组织 / 组织类型：系统配置 */
  (1001, 1003, 'query',  '组织-查询',   'GET:/adm/org',           210, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1002, 1003, 'add',    '组织-新增',   'POST:/adm/org',          211, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1003, 1003, 'modify', '组织-修改',   'PUT:/adm/org',           212, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1004, 1003, 'del',    '组织-删除',   'DELETE:/adm/org',        213, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  (1005, 1003, 'query',  '组织类型-查询', 'GET:/adm/org-type',    220, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1006, 1003, 'add',    '组织类型-新增', 'POST:/adm/org-type',   221, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1007, 1003, 'modify', '组织类型-修改', 'PUT:/adm/org-type',    222, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1008, 1003, 'del',    '组织类型-删除', 'DELETE:/adm/org-type', 223, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  /* 人员 / 人员编码类型：用户与身份管理 */
  (1009, 1001, 'query',  '人员-查询',      'GET:/adm/person',        110, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1010, 1001, 'add',    '人员-新增',      'POST:/adm/person',       111, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1011, 1001, 'modify', '人员-修改',      'PUT:/adm/person',        112, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1012, 1001, 'del',    '人员-删除',      'DELETE:/adm/person',     113, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  (1013, 1001, 'query',  '人员编码类型-查询', 'GET:/adm/person-code-type', 120, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1014, 1001, 'add',    '人员编码类型-新增', 'POST:/adm/person-code-type', 121, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1015, 1001, 'modify', '人员编码类型-修改', 'PUT:/adm/person-code-type', 122, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1016, 1001, 'del',    '人员编码类型-删除', 'DELETE:/adm/person-code-type', 123, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  /* 操作日志只读 */
  (1017, 1004, 'query',  '操作日志-查询',  'GET:/adm/op-log',        10, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  /* 组织体系用户 CRUD（组织管理员需要对本组织下用户做增改删 — 放在「用户与身份管理」下） */
  (1018, 1001, 'query',  '组织成员-查询',  'GET:/adm/org-user',      130, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1019, 1001, 'add',    '组织成员-绑定',  'POST:/adm/org-user',     131, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1020, 1001, 'del',    '组织成员-解绑',  'DELETE:/adm/org-user',   132, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict do nothing;

/*--------------------------------------------------------------*/
/* 3. 角色分组 + 角色                                           */
/*--------------------------------------------------------------*/
update adm_role_group
   set name      = '管理',
       tree_code = '001',
       remark    = '平台 / 系统 / 组织 三类管理角色',
       update_ms = (extract(epoch from now()) * 1000)::int8
 where id = 1;

insert into adm_role_group (id, tree_code, name, remark, enabled,
                           creater_id, create_ms, updater_id, update_ms)
values (2, '002', '审计', '审计员角色，只读日志', true,
        0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict do nothing;

/* id=1 现有超级管理员 → 平台管理员 */
update adm_role
   set group_id   = 1,
       name       = '平台管理员',
       sort_order = 10,
       remark     = '拥有全部权限；一般给运维 / 平台 owner',
       update_ms  = (extract(epoch from now()) * 1000)::int8
 where id = 1;

insert into adm_role (id, group_id, name, sort_order, remark, enabled,
                      creater_id, create_ms, updater_id, update_ms)
values
  (2, 1, '系统管理员', 20, '给客户管理员使用；隐藏底层权限管理 / 菜单管理等可能误操作的入口',
   true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (3, 1, '组织管理员', 30, '只管指定领域 / 组织 / 应用内的人员与组织；可见范围由三张 adm_role_*_scope 表决定',
   true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (4, 2, '审计员',     10, '只读登录 / 操作日志，不能改任何配置',
   true, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict do nothing;

/*--------------------------------------------------------------*/
/* 4. 菜单：保持原有 14 节点，新增组织 / 人员 / 操作日志         */
/*--------------------------------------------------------------*/
update adm_menu
   set name      = '系统配置',
       remark    = '领域 / 应用 / 分组等配置入口',
       update_ms = (extract(epoch from now()) * 1000)::int8
 where id = 8;

insert into adm_menu (id, app_id, tree_code, code, name, path, component, link_type,
                      icon, keep_alive, visible, remark, enabled,
                      creater_id, create_ms, updater_id, update_ms)
values
  /* 组织体系 */
  (1001, 1, '005',    'org-system',   '组织体系', '/org-system', null,          1,
   'building-2', false, true, '组织 / 组织类型管理', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1002, 1, '005001', 'orgs',         '组织管理', '/orgs',       'orgs',        1,
   'network', false, true, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1003, 1, '005002', 'org-types',    '组织类型', '/org-types',  'org-types',   1,
   'hierarchy', false, true, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  /* 人员体系 */
  (1004, 1, '006',    'person-system',     '人员体系',     '/person-system', null,              1,
   'user-cog', false, true, '人员 / 人员编码类型管理', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1005, 1, '006001', 'persons',           '人员管理',     '/persons',      'persons',         1,
   'profile', false, true, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1006, 1, '006002', 'person-code-types', '人员编码类型', '/person-code-types', 'person-code-types', 1,
   'id-card', false, true, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  /* 审计日志补操作日志 */
  (1007, 1, '004002', 'op-logs', '操作日志', '/op-logs', 'op-logs', 1,
   'scroll-text', false, true, null, true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict do nothing;

/* 所有已注册菜单节点 id 集合（1..14 + 1001..1007），用来做授权 */

/*--------------------------------------------------------------*/
/* 5. 用户：super / admin / owl；admin 改密码为 daydayup         */
/*--------------------------------------------------------------*/
/* admin (id=1) 改密码为 daydayup；系统管理员 */
update adm_user
   set name               = 'admin',
       nick_name          = '系统管理员',
       login_pswd         = '4ace8321fab77cc7cacde28038667a4c9febed801071a5d9eb7403e6b7353668',
       login_pswd_salt    = '000000',
       login_pswd_default = true,
       audit_pswd         = '',
       audit_pswd_salt    = '',
       pay_pswd           = '',
       pay_pswd_salt      = '',
       enabled            = true,
       update_ms          = (extract(epoch from now()) * 1000)::int8
 where id = 1;

insert into adm_user (id, person_id, name, nick_name, mobile_verified, email_verified, real_name_verified,
                      login_pswd, login_pswd_salt, login_pswd_default,
                      audit_pswd, audit_pswd_salt, pay_pswd, pay_pswd_salt,
                      expire_ms, status, fail_count, lock_until_ms, last_login_ms, remark, enabled,
                      creater_id, create_ms, updater_id, update_ms)
values
  /* super 平台管理员 tiger */
  (2, null, 'super', '平台管理员', false, false, false,
   '6b5919023798e5f135441266b5556b2fb5d6c2941c92a03e1474956594e8a22b', '000000', false,
   '', '', '', '',
   null, 1, 0, null, null, '内置平台管理员，拥有全部权限', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),

  /* owl 审计员 9527 */
  (3, null, 'owl', '审计员', false, false, false,
   '5696dd96cd3cf7b7fbf13e0b83b521cb5947d1792724c3ad470de4b6ff4192ee', '000000', false,
   '', '', '', '',
   null, 1, 0, null, null, '内置审计员，只看登录 / 操作日志', true,
   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict do nothing;

/* realm 成员绑定：三用户都是 realm=adm 成员 */
insert into adm_realm_user (id, realm_id, user_id, creater_id, create_ms, updater_id, update_ms)
values
  (1001, 1, 1, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1002, 1, 2, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (1003, 1, 3, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict do nothing;

/*--------------------------------------------------------------*/
/* 6. 角色 ↔ 用户 绑定                                          */
/*--------------------------------------------------------------*/
delete from adm_role_user where user_id in (1, 2, 3);

insert into adm_role_user (id, user_id, role_id, creater_id, create_ms, updater_id, update_ms)
values
  (1,    2, 1, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),  /* super → 平台管理员 */
  (2,    1, 2, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),  /* admin → 系统管理员  */
  (3,    3, 4, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)   /* owl   → 审计员      */
on conflict do nothing;

/*--------------------------------------------------------------*/
/* 7. 角色可见范围：三张表各自独立，均为「配了才限制」的白名单   */
/*    组织管理员绑定 realm=adm；应用只放行管理后台 app=1         */
/*    平台/系统管理员不配置任何行 ⇒ 三个维度全量可见             */
/*--------------------------------------------------------------*/
insert into adm_role_realm_scope (id, role_id, realm_id, creater_id, create_ms, updater_id, update_ms)
values (1, 3, 1, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict do nothing;

insert into adm_role_app_scope (id, role_id, app_id, creater_id, create_ms, updater_id, update_ms)
values (1, 3, 1, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8)
on conflict do nothing;

/* adm_role_org_scope 暂无种子：adm_org 初始化为空，不伪造组织 ID */

/*--------------------------------------------------------------*/
/* 8. 角色 ↔ 菜单 / 权限 授权；平台管理员保留全量，其它重新算   */
/*--------------------------------------------------------------*/

/* 先清所有旧授权，再重插；幂等：on conflict do nothing 兜底。*/
delete from adm_role_menu;
delete from adm_role_perm;

/* 全量菜单 id 集合：1..14 + 1001..1007 */
/* 全量权限 id 集合：1..33 + 1001..1020 */

/* 平台管理员（role=1）→ 全部菜单 + 全部权限 */
insert into adm_role_menu (id, menu_id, role_id, creater_id, create_ms, updater_id, update_ms)
select 90000 + gs, gs, 1, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8
from generate_series(1, 14) gs
union all
select 91000 + gs - 1000, gs, 1, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8
from generate_series(1001, 1007) gs;

insert into adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms)
select 90000 + gs, 1, gs, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8
from generate_series(1, 33) gs
union all
select 91000 + gs - 1000, 1, gs, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8
from generate_series(1001, 1020) gs;

/* 系统管理员（role=2）：
 *   菜单 → 工作台 / 用户 / 角色 / 角色分组 / 权限分组 / 领域 / 应用 / 登录日志
 *          （不含菜单管理、权限管理、组织体系、人员体系、操作日志 — 客户管理员易误操作）
 *   权限 → 用户CRUD / 角色CRUD / 角色分组CRUD / 权限分组CRUD / 领域CRUD / 应用CRUD / 登录日志查询
 */
insert into adm_role_menu (id, menu_id, role_id, creater_id, create_ms, updater_id, update_ms)
values
  (2001, 2,  2, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2002, 4,  2, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2003, 5,  2, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2004, 9,  2, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2005, 10, 2, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2006, 11, 2, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2007, 12, 2, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2008, 14, 2, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8);

insert into adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms)
values
  /* 用户 CRUD */
  (2001, 2, 1, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2002, 2, 2, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2003, 2, 3, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2004, 2, 4, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  /* 角色 CRUD（不含角色 / 权限菜单管理 — 客户不该改底层） */
  (2005, 2, 5, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2006, 2, 6, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2007, 2, 7, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2008, 2, 8, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  /* 角色分组 CRUD */
  (2009,  2, 17, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2010,  2, 18, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2011,  2, 19, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2012,  2, 20, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  /* 权限分组 CRUD */
  (2013,  2, 21, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2014,  2, 22, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2015,  2, 23, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2016,  2, 24, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  /* 领域 CRUD */
  (2017,  2, 25, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2018,  2, 26, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2019,  2, 27, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2020,  2, 28, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  /* 应用 CRUD */
  (2021,  2, 29, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2022,  2, 30, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2023,  2, 31, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (2024,  2, 32, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  /* 登录日志查询 */
  (2025,  2, 33, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8);

/* 组织管理员（role=3）：
 *   菜单 → 用户 / 组织管理 / 人员管理 / 登录日志
 *   权限 → 用户 CRUD / 组织 CRUD / 组织类型 CRUD / 人员 CRUD / 组织成员 / 登录日志
 *   （CRUD 的可见范围由 adm_role_realm_scope / adm_role_org_scope / adm_role_app_scope 强制过滤）
 */
insert into adm_role_menu (id, menu_id, role_id, creater_id, create_ms, updater_id, update_ms)
values
  (3001, 4,    3, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (3002, 1002, 3, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (3003, 1005, 3, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (3004, 14,   3, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8);

insert into adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms)
values
  /* 用户 CRUD */
  (3001, 3, 1, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (3002, 3, 2, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (3003, 3, 3, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (3004, 3, 4, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  /* 组织 CRUD */
  (3005, 3, 1001, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (3006, 3, 1002, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (3007, 3, 1003, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (3008, 3, 1004, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  /* 组织类型（只读） */
  (3009, 3, 1005, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  /* 人员 CRUD */
  (3010, 3, 1009, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (3011, 3, 1010, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (3012, 3, 1011, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (3013, 3, 1012, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  /* 人员编码类型（只读） */
  (3014, 3, 1013, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  /* 组织成员绑定 / 解绑 */
  (3015, 3, 1018, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (3016, 3, 1019, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (3017, 3, 1020, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  /* 登录日志查询 */
  (3018, 3, 33, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8);

/* 审计员（role=4）：只看日志 */
insert into adm_role_menu (id, menu_id, role_id, creater_id, create_ms, updater_id, update_ms)
values
  (4001, 14,   4, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),
  (4002, 1007, 4, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8);

insert into adm_role_perm (id, role_id, perm_id, creater_id, create_ms, updater_id, update_ms)
values
  (4001, 4, 33,   0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8),  /* GET:/adm/login-log */
  (4002, 4, 1017, 0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8); /* GET:/adm/op-log */

commit;
