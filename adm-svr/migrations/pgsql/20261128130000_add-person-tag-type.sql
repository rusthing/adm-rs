-- 人员标签类型字典：人员标签（adm_person.tags）的分类口径
-- 标签本身仍按名称自由写入（不建外键）；本表只维护类型清单，供页面统一维护

create table adm_person_tag_type (
   id                   INT8                 not null,
   code                 VARCHAR(50)          not null,
   name                 VARCHAR(50)          not null,
   sort_order           INT4                 not null,
   remark               VARCHAR(50)          null,
   enabled              BOOL                 not null default true,
   creater_id           INT8                 not null,
   create_ms            INT8                 not null,
   updater_id           INT8                 not null,
   update_ms            INT8                 not null,
   constraint PK_ADM_PERSON_TAG_TYPE primary key (id),
   constraint AK_CODE_ADM_PERSON_TAG_TYPE unique (code),
   constraint AK_NAME_ADM_PERSON_TAG_TYPE unique (name)
);

comment on table adm_person_tag_type is
'人员标签类型
人员标签（adm_person.tags）的分类字典：技能、岗位、安全等标签类型；
标签本身仍按名称自由写入（不建外键），字典只用于统一口径与页面维护';

comment on column adm_person_tag_type.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_person_tag_type.code is
'编码
标签类型编码，全局唯一（AK）
@len 1..=50
@check is_code';

comment on column adm_person_tag_type.name is
'名称
标签类型名称，全局唯一（AK）
@len 1..=50';

comment on column adm_person_tag_type.sort_order is
'排序值
越小越靠前
@range 0..=9999';

comment on column adm_person_tag_type.remark is
'备注
@len 0..=50';

comment on column adm_person_tag_type.enabled is
'是否启用
false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用';

comment on column adm_person_tag_type.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_person_tag_type.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_person_tag_type.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_person_tag_type.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

create unique index adm_person_tag_type_PK on adm_person_tag_type (
id
);
