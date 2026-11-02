/*==============================================================*/
/* 初始化数据                                                     */
/*                                                              */
/* 种子 ID 用 1、2、3 这类小整数，方便人工对照；运行期新增的记录由  */
/* idworker 生成雪花 ID，不会撞车。                                */
/*                                                              */
/* 内置管理员的默认口令是 admin123，摘要见 adm_user 那一段。        */
/* 上线前务必改掉，或删掉这条种子改用接口创建。                     */
/*==============================================================*/


/*==============================================================*/
/* 操作类型                                                       */
/*                                                              */
/* op_log.op_type_code / perm.op_type_code 都外键指向本表的 code，  */
/* 没有这几行，写操作日志会直接撞外键。                             */
/*==============================================================*/
insert into adm_op_type (id, code, name, sort_order, remark,
                         creater_id, create_ms, updater_id, update_ms)
values (1, 'login', '登录', 10, null,
        0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8);

insert into adm_op_type (id, code, name, sort_order, remark,
                         creater_id, create_ms, updater_id, update_ms)
values (2, 'login_fail', '登录失败', 11, null,
        0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8);

insert into adm_op_type (id, code, name, sort_order, remark,
                         creater_id, create_ms, updater_id, update_ms)
values (3, 'logout', '登出', 12, null,
        0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8);

insert into adm_op_type (id, code, name, sort_order, remark,
                         creater_id, create_ms, updater_id, update_ms)
values (4, 'add', '新增', 20, null,
        0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8);

insert into adm_op_type (id, code, name, sort_order, remark,
                         creater_id, create_ms, updater_id, update_ms)
values (5, 'modify', '修改', 21, null,
        0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8);

insert into adm_op_type (id, code, name, sort_order, remark,
                         creater_id, create_ms, updater_id, update_ms)
values (6, 'del', '删除', 22, null,
        0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8);

insert into adm_op_type (id, code, name, sort_order, remark,
                         creater_id, create_ms, updater_id, update_ms)
values (7, 'query', '查询', 30, null,
        0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8);

insert into adm_op_type (id, code, name, sort_order, remark,
                         creater_id, create_ms, updater_id, update_ms)
values (8, 'export', '导出', 31, null,
        0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8);

insert into adm_op_type (id, code, name, sort_order, remark,
                         creater_id, create_ms, updater_id, update_ms)
values (9, 'audit', '审核', 40, null,
        0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8);


/*==============================================================*/
/* 选项：登录策略                                                  */
/*                                                              */
/* 值与 adm_option_cache_utils 里的默认值一致，写出来是为了让「配了  */
/* 多少」一眼可见；表里没有对应行时代码走同名默认值，不会锁死登录。   */
/*==============================================================*/
insert into adm_option (id, code, name, value, remark,
                        creater_id, create_ms, updater_id, update_ms)
values (1, 'login_fail_limit', '登录失败锁定阈值', '5', '连续失败达到该次数后锁定账号',
        0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8);

insert into adm_option (id, code, name, value, remark,
                        creater_id, create_ms, updater_id, update_ms)
values (2, 'login_lock_ms', '登录锁定时长(毫秒)', '3600000', '锁定期内即使口令正确也拒绝登录',
        0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8);


/*==============================================================*/
/* 内置管理员                                                     */
/*                                                              */
/* 默认口令 admin123：                                            */
/*   一次摘要 SM3('admin123') = 667c756cf9334e328a56e44e906245c8  */
/*                              e214c655a160f18fdb84d79c209c49cf */
/*   组合码 seedpw，落库值 = SM3(一次摘要 + 组合码)                 */
/*                        = fab638e92f952240613f8f556901761ac635  */
/*                          1859e13b2869f0e17672aa78709a          */
/* 三套口令种子值相同，只是为了填满非空列；首次使用应各自改掉。       */
/*==============================================================*/
insert into adm_user (id, person_id, name, nick_name, mobile, mobile_verified,
                      email, email_verified, id_card, real_name, real_name_verified,
                      login_pswd, login_pswd_salt, login_pswd_default,
                      audit_pswd, audit_pswd_salt, pay_pswd, pay_pswd_salt,
                      expire_ms, status, fail_count, lock_until_ms, last_login_ms,
                      remark, enabled, creater_id, create_ms, updater_id, update_ms)
values (1, null, 'admin', '超级管理员', null, false,
        null, false, null, null, false,
        'fab638e92f952240613f8f556901761ac6351859e13b2869f0e17672aa78709a', 'seedpw', true,
        'fab638e92f952240613f8f556901761ac6351859e13b2869f0e17672aa78709a', 'seedpw',
        'fab638e92f952240613f8f556901761ac6351859e13b2869f0e17672aa78709a', 'seedpw',
        null, 1, 0, null, null,
        '内置管理员，默认口令 admin123', true,
        0, (extract(epoch from now()) * 1000)::int8, 0, (extract(epoch from now()) * 1000)::int8);
