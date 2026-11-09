/*==============================================================*/
/* DBMS name:      PostgreSQL 9.x                               */
/* Created on:     2026/11/9 18:19:30                           */
/*==============================================================*/


/*==============================================================*/
/* Table: adm_app                                               */
/*==============================================================*/
create table adm_app (
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
   constraint PK_ADM_APP primary key (id),
   constraint AK_CODE_ADM_APP unique (code),
   constraint AK_NAME_ADM_APP unique (name)
);

comment on table adm_app is
'应用
菜单树的归属单位，全局配置：后台、前台、移动端各一棵菜单树，与领域无关';

comment on column adm_app.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_app.code is
'应用编码
全局唯一（AK），前端用它区分路由与请求来源
@len 1..=50
@check is_code';

comment on column adm_app.name is
'名称
全局唯一（AK）
@len 1..=50';

comment on column adm_app.sort_order is
'排序值
全局排序，越小越靠前
@range 0..=9999';

comment on column adm_app.remark is
'备注
@len 0..=50';

comment on column adm_app.enabled is
'是否启用
false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用';

comment on column adm_app.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_app.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_app.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_app.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

/*==============================================================*/
/* Index: adm_app_PK                                            */
/*==============================================================*/
create unique index adm_app_PK on adm_app (
id
);

/*==============================================================*/
/* Table: adm_dashboard                                         */
/*==============================================================*/
create table adm_dashboard (
   id                   INT8                 not null,
   role_id              INT8                 null,
   name                 VARCHAR(64)          not null,
   remark               VARCHAR(255)         null,
   enabled              BOOL                 not null default true,
   creater_id           INT8                 not null,
   create_ms            INT8                 not null,
   updater_id           INT8                 not null,
   update_ms            INT8                 not null,
   constraint PK_ADM_DASHBOARD primary key (id)
);

comment on table adm_dashboard is
'仪表盘
角色专属或全局的数据看板：role_id 为空 = 全局仪表盘（最多一个），role_id 非空 = 该角色专属仪表盘（每个角色最多一个）';

comment on column adm_dashboard.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_dashboard.role_id is
'角色 ID
关联 role；为空表示全局仪表盘
@unique 全局最多一个（role_id IS NULL）且每个角色最多一个（role_id IS NOT NULL）';

comment on column adm_dashboard.name is
'名称
展示用
@len 1..=64';

comment on column adm_dashboard.remark is
'备注
@len 0..=255';

comment on column adm_dashboard.enabled is
'是否启用
false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用';

comment on column adm_dashboard.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_dashboard.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_dashboard.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_dashboard.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

/*==============================================================*/
/* Index: adm_dashboard_PK                                      */
/*==============================================================*/
create unique index adm_dashboard_PK on adm_dashboard (
id
);

/*==============================================================*/
/* Index: dashboard_role_FK                                     */
/*==============================================================*/
create  index dashboard_role_FK on adm_dashboard (
role_id
);

/*==============================================================*/
/* Table: adm_dashboard_widget                                  */
/*==============================================================*/
create table adm_dashboard_widget (
   id                   INT8                 not null,
   dashboard_id         INT8                 not null,
   widget_type          VARCHAR(32)          not null,
   title                VARCHAR(64)          not null,
   service              VARCHAR(32)          not null,
   endpoint             VARCHAR(64)          not null,
   params               TEXT                 null,
   perm_urn             VARCHAR(128)         null,
   scope_aware          BOOL                 not null,
   sort_order           INT4                 not null,
   enabled              BOOL                 not null default true,
   creater_id           INT8                 not null,
   create_ms            INT8                 not null,
   updater_id           INT8                 not null,
   update_ms            INT8                 not null,
   constraint PK_ADM_DASHBOARD_WIDGET primary key (id, widget_type)
);

comment on table adm_dashboard_widget is
'仪表盘小组件
仪表盘内嵌的数据卡片/图表，关联 widget_type 决定组件类型与默认配置';

comment on column adm_dashboard_widget.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_dashboard_widget.dashboard_id is
'仪表盘ID';

comment on column adm_dashboard_widget.widget_type is
'组件类型编码
关联 widget_type.code，决定组件渲染方式与默认配置
@len 1..=32
@check is_code';

comment on column adm_dashboard_widget.title is
'标题
组件展示标题
@len 1..=64';

comment on column adm_dashboard_widget.service is
'服务名
后端微服务名称，用于路由请求
@len 1..=32';

comment on column adm_dashboard_widget.endpoint is
'端点路径
后端接口路径
@len 1..=64';

comment on column adm_dashboard_widget.params is
'请求参数
JSON 格式的额外请求参数';

comment on column adm_dashboard_widget.perm_urn is
'权限 URN
组件所需的权限标识
@len 0..=128';

comment on column adm_dashboard_widget.scope_aware is
'是否感知数据范围
true 时组件数据按当前用户的数据范围过滤';

comment on column adm_dashboard_widget.sort_order is
'排序值
同一仪表盘内排序，越小越靠前
@range 0..=9999';

comment on column adm_dashboard_widget.enabled is
'是否启用
false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用';

comment on column adm_dashboard_widget.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_dashboard_widget.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_dashboard_widget.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_dashboard_widget.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

/*==============================================================*/
/* Index: adm_dashboard_widget_PK                               */
/*==============================================================*/
create unique index adm_dashboard_widget_PK on adm_dashboard_widget (
id,
widget_type
);

/*==============================================================*/
/* Index: Relationship_34_FK                                    */
/*==============================================================*/
create  index Relationship_34_FK on adm_dashboard_widget (
dashboard_id
);

/*==============================================================*/
/* Index: Relationship_35_FK                                    */
/*==============================================================*/
create  index Relationship_35_FK on adm_dashboard_widget (
widget_type
);

/*==============================================================*/
/* Table: adm_lock_log                                          */
/*==============================================================*/
create table adm_lock_log (
   id                   INT8                 not null,
   user_id              INT8                 null,
   lock_ms              INT8                 not null,
   lock_reason          VARCHAR(100)         not null,
   unlock_ms            INT8                 null,
   unlock_reason        VARCHAR(100)         null,
   creater_id           INT8                 not null,
   create_ms            INT8                 not null,
   updater_id           INT8                 not null,
   update_ms            INT8                 not null,
   constraint PK_ADM_LOCK_LOG primary key (id)
);

comment on table adm_lock_log is
'锁定日志
账户锁定与解锁的流水：锁定写一行，解锁时回填 unlock_ms / unlock_reason，同一行贯穿一次锁定周期';

comment on column adm_lock_log.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_lock_log.user_id is
'用户 ID
关联 user；为空表示账号已被删除，但锁定流水仍需保留';

comment on column adm_lock_log.lock_ms is
'锁定时间戳
@unit ms';

comment on column adm_lock_log.lock_reason is
'锁定原因
如「连续登录失败 5 次」「管理员手动锁定」
@len 1..=100';

comment on column adm_lock_log.unlock_ms is
'解锁时间戳
为空表示仍在锁定中（这是「锁定中」的唯一判据）
@unit ms';

comment on column adm_lock_log.unlock_reason is
'解锁原因
为空表示尚未解锁，与 unlock_ms 同时为空才是一条有效的「锁定中」记录
@len 1..=100';

comment on column adm_lock_log.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_lock_log.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_lock_log.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_lock_log.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

/*==============================================================*/
/* Index: adm_lock_log_PK                                       */
/*==============================================================*/
create unique index adm_lock_log_PK on adm_lock_log (
id
);

/*==============================================================*/
/* Index: Relationship_30_FK                                    */
/*==============================================================*/
create  index Relationship_30_FK on adm_lock_log (
user_id
);

/*==============================================================*/
/* Table: adm_login_log                                         */
/*==============================================================*/
create table adm_login_log (
   id                   INT8                 not null,
   user_id              INT8                 null,
   login_ms             INT8                 not null,
   logout_ms            INT8                 null,
   login_ip             VARCHAR(45)          not null,
   creater_id           INT8                 not null,
   create_ms            INT8                 not null,
   updater_id           INT8                 not null,
   update_ms            INT8                 not null,
   constraint PK_ADM_LOGIN_LOG primary key (id)
);

comment on table adm_login_log is
'登录日志
每次登录尝试一行（含失败），用于安全审计与异常登录排查';

comment on column adm_login_log.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_login_log.user_id is
'用户 ID
关联 user；为空表示登录名不存在（失败的尝试也要留痕）';

comment on column adm_login_log.login_ms is
'登录时间戳
@unit ms';

comment on column adm_login_log.logout_ms is
'登出时间戳
为空表示未登出（会话超时或仍在线）
@unit ms';

comment on column adm_login_log.login_ip is
'登录 IP
IPv4 与 IPv6 都存，45 是 IPv6 带内嵌 IPv4 时的最长文本长度（如 ::ffff:192.168.1.10）
@len 1..=45
@check is_ip';

comment on column adm_login_log.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_login_log.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_login_log.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_login_log.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

/*==============================================================*/
/* Index: adm_login_log_PK                                      */
/*==============================================================*/
create unique index adm_login_log_PK on adm_login_log (
id
);

/*==============================================================*/
/* Index: Relationship_29_FK                                    */
/*==============================================================*/
create  index Relationship_29_FK on adm_login_log (
user_id
);

/*==============================================================*/
/* Table: adm_menu                                              */
/*==============================================================*/
create table adm_menu (
   id                   INT8                 not null,
   app_id               INT8                 not null,
   tree_code            VARCHAR(30)          not null,
   code                 VARCHAR(50)          not null,
   name                 VARCHAR(50)          not null,
   path                 VARCHAR(100)         not null,
   component            VARCHAR(200)         null,
   link_type            INT2                 not null default 1,
   icon                 VARCHAR(50)          null,
   keep_alive           BOOL                 not null default false,
   visible              BOOL                 not null default true,
   remark               VARCHAR(50)          null,
   enabled              BOOL                 not null default true,
   creater_id           INT8                 not null,
   create_ms            INT8                 not null,
   updater_id           INT8                 not null,
   update_ms            INT8                 not null,
   constraint PK_ADM_MENU primary key (id),
   constraint AK_APP_ID_AND_TREE_CODE_ADM_MENU unique (app_id, tree_code),
   constraint AK_APP_ID_AND_NAME_ADM_MENU unique (app_id, name),
   constraint AK_APP_ID_AND_CODE_ADM_MENU unique (app_id, code)
);

comment on table adm_menu is
'菜单
前端动态路由的数据源：一棵树 + 组件路径 + 权限点
目录与菜单的区别由 component 是否为空推导，不用单独的类型列';

comment on column adm_menu.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_menu.app_id is
'所属应用 ID
关联 app；菜单树按应用隔离，tree_code 只在本应用内唯一';

comment on column adm_menu.tree_code is
'树编码
路径枚举存树：字典序即树的前序，子节点紧跟在父节点之后，排序直接用 ORDER BY tree_code，不需要额外排序列
每层固定 3 位数字（不足左补 0），不加分隔符：001 → 001002 → 001002003
总长 = 层数 × 3（必须是 3 的倍数）；列宽 30 即最多 10 层，每层最多 999 个兄弟
中间插入按 010、020、030 递增留空位；调整顺序 = 改编码，会级联该节点整棵子树
@len 3..=30
@check is_tree_code';

comment on column adm_menu.code is
'编码
同一应用内唯一（AK）；前端用作路由 name（编程式跳转、keep-alive 的 include 键）
不能用 tree_code 代替：菜单一移动编码就变，书签与 router.push({name}) 会断
@len 1..=50
@check is_code';

comment on column adm_menu.name is
'名称
同一应用内唯一（AK），展示用
@len 1..=50';

comment on column adm_menu.path is
'路径
内链存路由路径（以 / 开头）；外链与 iframe 存完整 URL
目录节点同样存自己的路由前缀，用于拼子节点路径
@len 1..=100';

comment on column adm_menu.component is
'组件路径
内链菜单的前端组件相对路径；为空表示目录节点（不产出组件路由，只用于分组）
@len 0..=200';

comment on column adm_menu.link_type is
'链接类型
1-内链（默认，path 存路由路径，component 存组件路径）
2-外链（path 存完整 URL，component 为空）
3-内嵌 iframe（path 存完整 URL，component 为空）
@range 1..=3
link_type 为 2/3 时 path 存完整 URL，此时对 path 校验
@check is_url_http';

comment on column adm_menu.icon is
'图标
前端图标名（如 SettingOutlined），目录与菜单使用
@len 0..=50';

comment on column adm_menu.keep_alive is
'是否缓存
前端页面是否 keep-alive，列表页一般 true，详情/编辑页 false';

comment on column adm_menu.visible is
'是否显示
false 时不在导航中渲染，但路由仍然可访问（详情页、编辑页等隐藏页）
与 enabled 的区别：enabled=false 是整节点（含子节点）下架';

comment on column adm_menu.remark is
'备注
@len 0..=50';

comment on column adm_menu.enabled is
'是否启用
false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用';

comment on column adm_menu.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_menu.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_menu.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_menu.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

/*==============================================================*/
/* Index: adm_menu_PK                                           */
/*==============================================================*/
create unique index adm_menu_PK on adm_menu (
id
);

/*==============================================================*/
/* Index: Relationship_23_FK                                    */
/*==============================================================*/
create  index Relationship_23_FK on adm_menu (
app_id
);

/*==============================================================*/
/* Table: adm_menu_perm                                         */
/*==============================================================*/
create table adm_menu_perm (
   id                   INT8                 not null,
   menu_id              INT8                 not null,
   perm_id              INT8                 not null,
   creater_id           INT8                 not null,
   create_ms            INT8                 not null,
   updater_id           INT8                 not null,
   update_ms            INT8                 not null,
   constraint PK_ADM_MENU_PERM primary key (id),
   constraint AK_MENU_ID_AND_PERM_ID_ADM_MENU_PERM unique (menu_id, perm_id)
);

comment on table adm_menu_perm is
'菜单权限
菜单与权限点的多对多关联，前端据此计算每个页面上的按钮权限（meta.perms）';

comment on column adm_menu_perm.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_menu_perm.menu_id is
'菜单 ID
关联 menu；(menu_id, perm_id) 唯一（AK）';

comment on column adm_menu_perm.perm_id is
'权限 ID
关联 perm；(menu_id, perm_id) 唯一（AK）';

comment on column adm_menu_perm.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_menu_perm.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_menu_perm.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_menu_perm.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

/*==============================================================*/
/* Index: adm_menu_perm_PK                                      */
/*==============================================================*/
create unique index adm_menu_perm_PK on adm_menu_perm (
id
);

/*==============================================================*/
/* Index: Relationship_24_FK                                    */
/*==============================================================*/
create  index Relationship_24_FK on adm_menu_perm (
menu_id
);

/*==============================================================*/
/* Index: Relationship_25_FK                                    */
/*==============================================================*/
create  index Relationship_25_FK on adm_menu_perm (
perm_id
);

/*==============================================================*/
/* Table: adm_op_log                                            */
/*==============================================================*/
create table adm_op_log (
   id                   INT8                 not null,
   user_id              INT8                 not null,
   op_type_code         VARCHAR(50)          not null,
   op_title             VARCHAR(50)          not null,
   op_urn               VARCHAR(100)         not null,
   remark               VARCHAR(50)          null,
   creater_id           INT8                 not null,
   create_ms            INT8                 not null,
   updater_id           INT8                 not null,
   update_ms            INT8                 not null,
   constraint PK_ADM_OP_LOG primary key (id)
);

comment on table adm_op_log is
'操作日志
记录谁在什么时候对哪个接口做了什么；只增不改，用户删除受限以保证可追溯';

comment on column adm_op_log.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_op_log.user_id is
'操作用户 ID
关联 user；日志表要求可追溯，所以用户删除受限（restrict）';

comment on column adm_op_log.op_type_code is
'操作类型编码
关联 op_type.code（存编码不是 ID）
@len 1..=50
@check is_code';

comment on column adm_op_log.op_title is
'操作标题
列表展示用，如「新增用户」「导出报表」
@len 1..=50';

comment on column adm_op_log.op_urn is
'操作 URN
被调用接口的 URN，格式同 perm.urn（METHOD:路径），如 GET:/api/v1/users
与 perm.urn 同宽 100：两者是同一套标识，长度不一致会在审计里出现被截断的地址
@len 1..=100';

comment on column adm_op_log.remark is
'备注
@len 0..=50';

comment on column adm_op_log.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_op_log.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_op_log.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_op_log.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

/*==============================================================*/
/* Index: adm_op_log_PK                                         */
/*==============================================================*/
create unique index adm_op_log_PK on adm_op_log (
id
);

/*==============================================================*/
/* Index: Relationship_28_FK                                    */
/*==============================================================*/
create  index Relationship_28_FK on adm_op_log (
user_id
);

/*==============================================================*/
/* Index: Relationship_31_FK                                    */
/*==============================================================*/
create  index Relationship_31_FK on adm_op_log (
op_type_code
);

/*==============================================================*/
/* Table: adm_op_type                                           */
/*==============================================================*/
create table adm_op_type (
   id                   INT8                 not null,
   code                 VARCHAR(50)          not null,
   name                 VARCHAR(50)          not null,
   sort_order           INT4                 not null,
   remark               VARCHAR(50)          null,
   creater_id           INT8                 not null,
   create_ms            INT8                 not null,
   updater_id           INT8                 not null,
   update_ms            INT8                 not null,
   constraint PK_ADM_OP_TYPE primary key (id),
   constraint AK_CODE_ADM_OP_TYPE unique (code),
   constraint AK_NAME_ADM_OP_TYPE unique (name)
);

comment on table adm_op_type is
'操作类型
初始有查看(Read)、 添加(Create)、修改(Update)、删除(Delete)、登录(Login)、登出(Logout)、导入(Import)、导出(Export)
、上传(Upload)、下载(Download)、审核(Audit)、授权(Assign)、打印(Print)这些类型';

comment on column adm_op_type.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_op_type.code is
'编码
业务编号，允许字母、数字与 _ . -（如 SYS_ADMIN、GROUP_HQ）
@len 1..=50
@check is_code';

comment on column adm_op_type.name is
'名称
全局唯一（AK）
@len 1..=50';

comment on column adm_op_type.sort_order is
'排序值
越小越靠前
@range 0..=9999';

comment on column adm_op_type.remark is
'备注
@len 0..=50';

comment on column adm_op_type.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_op_type.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_op_type.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_op_type.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

/*==============================================================*/
/* Index: adm_op_type_PK                                        */
/*==============================================================*/
create unique index adm_op_type_PK on adm_op_type (
id
);

/*==============================================================*/
/* Table: adm_option                                            */
/*==============================================================*/
create table adm_option (
   id                   INT8                 not null,
   code                 VARCHAR(50)          not null,
   name                 VARCHAR(50)          not null,
   value                TEXT                 not null,
   remark               VARCHAR(50)          null,
   creater_id           INT8                 not null,
   create_ms            INT8                 not null,
   updater_id           INT8                 not null,
   update_ms            INT8                 not null,
   constraint PK_ADM_OPTION primary key (id),
   constraint AK_CODE_ADM_OPTION unique (code)
);

comment on table adm_option is
'选项（字典）
一组选项用同一个 code 归集（如 user_status），每个可选值一行';

comment on column adm_option.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_option.code is
'编码
一组选项共用一个 code（如 user_status），全局唯一（AK）
@len 1..=50
@check is_code';

comment on column adm_option.name is
'名称
展示文案
@len 1..=50';

comment on column adm_option.value is
'选项值
业务侧落库与判断时使用的值（字符串形式，如 "1"、"true"）；含义由所属 code 的约定决定';

comment on column adm_option.remark is
'备注
@len 0..=50';

comment on column adm_option.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_option.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_option.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_option.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

/*==============================================================*/
/* Index: adm_option_PK                                         */
/*==============================================================*/
create unique index adm_option_PK on adm_option (
id
);

/*==============================================================*/
/* Table: adm_org                                               */
/*==============================================================*/
create table adm_org (
   id                   INT8                 not null,
   code                 VARCHAR(50)          null,
   tree_code            VARCHAR(30)          not null,
   name                 VARCHAR(50)          not null,
   full_name            VARCHAR(200)         null,
   org_type_id          INT8                 null,
   remark               VARCHAR(50)          null,
   enabled              BOOL                 not null default true,
   creater_id           INT8                 not null,
   create_ms            INT8                 not null,
   updater_id           INT8                 not null,
   update_ms            INT8                 not null,
   constraint PK_ADM_ORG primary key (id),
   constraint AK_CODE_ADM_ORG unique (code),
   constraint AK_FULL_NAME_ADM_ORG unique (full_name),
   constraint AK_TREE_CODE_ADM_ORG unique (tree_code)
);

comment on table adm_org is
'组织
树形结构由 tree_code 表达；与领域、用户都是多对多（realm_org / org_user），组织本身不自带领域列';

comment on column adm_org.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_org.code is
'组织编码
全局唯一（AK），业务上用于对接外部系统
@len 1..=50
@check is_code';

comment on column adm_org.tree_code is
'树编码
路径枚举存树：字典序即树的前序，子节点紧跟在父节点之后，排序直接用 ORDER BY tree_code，不需要额外排序列
每层固定 3 位数字（不足左补 0），不加分隔符：001 → 001002 → 001002003
总长 = 层数 × 3（必须是 3 的倍数）；列宽 30 即最多 10 层，每层最多 999 个兄弟
中间插入按 010、020、030 递增留空位；调整顺序 = 改编码，会级联该节点整棵子树
@len 3..=30
@check is_tree_code';

comment on column adm_org.name is
'名称
同一父节点下的兄弟名称不做唯一约束（同名部门很常见），只靠 tree_code 区分
@len 1..=50';

comment on column adm_org.full_name is
'全名
从根到当前节点的名称拼接，层间用 "." 分隔（如 集团.分厂.车间）
全局唯一（AK）；由 tree_code 维护时同步生成，只用于展示与模糊搜索
@len 0..=200';

comment on column adm_org.org_type_id is
'组织类型 ID
关联 org_type；为空表示未分类';

comment on column adm_org.remark is
'备注
@len 0..=50';

comment on column adm_org.enabled is
'是否启用
false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用';

comment on column adm_org.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_org.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_org.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_org.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

/*==============================================================*/
/* Index: adm_org_PK                                            */
/*==============================================================*/
create unique index adm_org_PK on adm_org (
id
);

/*==============================================================*/
/* Index: Relationship_1_FK                                     */
/*==============================================================*/
create  index Relationship_1_FK on adm_org (
org_type_id
);

/*==============================================================*/
/* Table: adm_org_type                                          */
/*==============================================================*/
create table adm_org_type (
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
   constraint PK_ADM_ORG_TYPE primary key (id),
   constraint AK_CODE_ADM_ORG_TYPE unique (code),
   constraint AK_NAME_ADM_ORG_TYPE unique (name)
);

comment on table adm_org_type is
'组织类型
有GROUP(集团)、UNIT(政府单位)、CORP(公司)、MILITARY(军)、DEPT(部门)、BRANCH_FACTORY(分厂)、DIRECTLY_BRIGADE(直属旅)、BRIGADE(旅)、TEAM(小组)、CLASSES(班级)等';

comment on column adm_org_type.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_org_type.code is
'编码
业务编号，允许字母、数字与 _ . -（如 SYS_ADMIN、GROUP_HQ）
@len 1..=50
@check is_code';

comment on column adm_org_type.name is
'名称
全局唯一（AK）
@len 1..=50';

comment on column adm_org_type.sort_order is
'排序值
越小越靠前
@range 0..=9999';

comment on column adm_org_type.remark is
'备注
@len 0..=50';

comment on column adm_org_type.enabled is
'是否启用
false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用';

comment on column adm_org_type.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_org_type.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_org_type.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_org_type.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

/*==============================================================*/
/* Index: adm_org_type_PK                                       */
/*==============================================================*/
create unique index adm_org_type_PK on adm_org_type (
id
);

/*==============================================================*/
/* Table: adm_org_user                                          */
/*==============================================================*/
create table adm_org_user (
   id                   INT8                 not null,
   org_id               INT8                 not null,
   user_id              INT8                 not null,
   creater_id           INT8                 not null,
   create_ms            INT8                 not null,
   updater_id           INT8                 not null,
   update_ms            INT8                 not null,
   constraint PK_ADM_ORG_USER primary key (id),
   constraint AK_ORG_ID_AND_USER_ID_ADM_ORG_USER unique (org_id, user_id)
);

comment on table adm_org_user is
'组织用户
组织与用户的多对多关系，一个人在多个组织任职时有多行';

comment on column adm_org_user.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_org_user.org_id is
'组织 ID
关联 org；(org_id, user_id) 唯一（AK）';

comment on column adm_org_user.user_id is
'用户 ID
关联 user；(org_id, user_id) 唯一（AK）';

comment on column adm_org_user.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_org_user.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_org_user.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_org_user.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

/*==============================================================*/
/* Index: adm_org_user_PK                                       */
/*==============================================================*/
create unique index adm_org_user_PK on adm_org_user (
id
);

/*==============================================================*/
/* Index: Relationship_10_FK                                    */
/*==============================================================*/
create  index Relationship_10_FK on adm_org_user (
org_id
);

/*==============================================================*/
/* Index: Relationship_11_FK                                    */
/*==============================================================*/
create  index Relationship_11_FK on adm_org_user (
user_id
);

/*==============================================================*/
/* Table: adm_perm                                              */
/*==============================================================*/
create table adm_perm (
   id                   INT8                 not null,
   group_id             INT8                 not null,
   op_type_code         VARCHAR(50)          not null,
   name                 VARCHAR(50)          not null,
   urn                  VARCHAR(100)         not null,
   sort_order           INT4                 not null,
   remark               VARCHAR(50)          null,
   enabled              BOOL                 not null default true,
   creater_id           INT8                 not null,
   create_ms            INT8                 not null,
   updater_id           INT8                 not null,
   update_ms            INT8                 not null,
   constraint PK_ADM_PERM primary key (id),
   constraint AK_GROUP_ID_AND_NAME_ADM_PERM unique (group_id, name),
   constraint AK_URN_ADM_PERM unique (urn)
);

comment on table adm_perm is
'权限
最小授权单元，用 URN 表达「HTTP 方法 + 资源路径」；与角色的关联见 role_perm，与菜单的关联见 menu_perm';

comment on column adm_perm.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_perm.group_id is
'权限分组 ID
关联 perm_group；(group_id, name) 唯一，不同分组可以重名';

comment on column adm_perm.op_type_code is
'操作类型编码
必填；关联 op_type.code（存编码不是 ID），一个权限点必须能对应一种操作类型，
不允许为空，取值受 op_type 字典限制
@len 1..=50
@check is_code';

comment on column adm_perm.name is
'名称
同一分组内唯一（AK）
@len 1..=50';

comment on column adm_perm.urn is
'URN
格式 METHOD:路径，如 GET:/api/v1/users；全局唯一（AK）
鉴权时按前缀匹配，写错一个字符就是永不命中，创建后不要改
@len 1..=100';

comment on column adm_perm.sort_order is
'排序值
同一分组内排序，越小越靠前
@range 0..=9999';

comment on column adm_perm.remark is
'备注
@len 0..=50';

comment on column adm_perm.enabled is
'是否启用
false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用';

comment on column adm_perm.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_perm.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_perm.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_perm.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

/*==============================================================*/
/* Index: adm_perm_PK                                           */
/*==============================================================*/
create unique index adm_perm_PK on adm_perm (
id
);

/*==============================================================*/
/* Index: Relationship_18_FK                                    */
/*==============================================================*/
create  index Relationship_18_FK on adm_perm (
group_id
);

/*==============================================================*/
/* Index: Relationship_32_FK                                    */
/*==============================================================*/
create  index Relationship_32_FK on adm_perm (
op_type_code
);

/*==============================================================*/
/* Table: adm_perm_group                                        */
/*==============================================================*/
create table adm_perm_group (
   id                   INT8                 not null,
   tree_code            VARCHAR(30)          not null,
   name                 VARCHAR(50)          not null,
   remark               VARCHAR(50)          null,
   enabled              BOOL                 not null default true,
   creater_id           INT8                 not null,
   create_ms            INT8                 not null,
   updater_id           INT8                 not null,
   update_ms            INT8                 not null,
   constraint PK_ADM_PERM_GROUP primary key (id),
   constraint AK_TREE_CODE_ADM_PERM_GROUP unique (tree_code)
);

comment on table adm_perm_group is
'权限分组
全局两级结构（分组 → 权限），树形由 tree_code 表达，tree_code 全局唯一';

comment on column adm_perm_group.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_perm_group.tree_code is
'树编码
路径枚举存树：字典序即树的前序，子节点紧跟在父节点之后，排序直接用 ORDER BY tree_code，不需要额外排序列
每层固定 3 位数字（不足左补 0），不加分隔符：001 → 001002 → 001002003
总长 = 层数 × 3（必须是 3 的倍数）；列宽 30 即最多 10 层，每层最多 999 个兄弟
中间插入按 010、020、030 递增留空位；调整顺序 = 改编码，会级联该节点整棵子树
@len 3..=30
@check is_tree_code';

comment on column adm_perm_group.name is
'名称
同一父节点下的兄弟名称不做唯一约束，靠 tree_code 区分
@len 1..=50';

comment on column adm_perm_group.remark is
'备注
@len 0..=50';

comment on column adm_perm_group.enabled is
'是否启用
false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用';

comment on column adm_perm_group.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_perm_group.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_perm_group.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_perm_group.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

/*==============================================================*/
/* Index: adm_perm_group_PK                                     */
/*==============================================================*/
create unique index adm_perm_group_PK on adm_perm_group (
id
);

/*==============================================================*/
/* Table: adm_person                                            */
/*==============================================================*/
create table adm_person (
   id                   INT8                 not null,
   code_type_id         INT8                 null,
   code                 VARCHAR(50)          null,
   name                 VARCHAR(200)         not null,
   name_pinyin_abbr     VARCHAR(200)         null,
   name_pinyin_full     VARCHAR(200)         null,
   mobile               VARCHAR(50)          null,
   email                VARCHAR(50)          null,
   id_card              VARCHAR(20)          null,
   remark               VARCHAR(50)          null,
   enabled              BOOL                 not null default true,
   creater_id           INT8                 not null,
   create_ms            INT8                 not null,
   updater_id           INT8                 not null,
   update_ms            INT8                 not null,
   constraint PK_ADM_PERSON primary key (id),
   constraint AK_CODE_TYPE_ID_AND_CODE_ADM_PERSON unique (code_type_id, code),
   constraint AK_EMAIL_ADM_PERSON unique (email),
   constraint AK_ID_CARD_ADM_PERSON unique (id_card)
);

comment on table adm_person is
'人员（自然人）
回答「这个人是谁」：真实姓名、拼音、身份证、联系方式，是身份主数据
不记实名核验状态：核验位在 user.real_name_verified 上，一个自然人多个账号时各自独立
一个自然人可以有零个或多个账号，账号侧通过 user.person_id 回指';

comment on column adm_person.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_person.code_type_id is
'人员编码类型 ID
关联 person_code_type；为空表示该人员没有工号/学号';

comment on column adm_person.code is
'编码
工号、学号等业务编号，含义由 code_type_id 决定
(code_type_id, code) 唯一（AK）
@len 1..=50
@check is_code';

comment on column adm_person.name is
'姓名
人员的真实姓名；长度 200 是为了容纳少数民族长姓名（多个间隔号拼接）
@len 1..=200';

comment on column adm_person.name_pinyin_abbr is
'姓名拼音首字母
大写、无分隔（张三 → ZS），用于快速检索
@len 0..=200';

comment on column adm_person.name_pinyin_full is
'姓名拼音全拼
小写、音节间无分隔（张三 → zhangsan），用于快速检索
@len 0..=200';

comment on column adm_person.mobile is
'手机号（档案联系方式）
人员档案上的号码，可与账号登录手机号不同；不做唯一约束
@check is_mobile_cn';

comment on column adm_person.email is
'邮箱（档案联系方式）
全局唯一（AK）：一个邮箱只对应一个人员档案
@len 0..=50
@check is_email';

comment on column adm_person.id_card is
'身份证号
全局唯一（AK）：同一自然人只应有一条有效档案
18 位，末位可为 X
@len 18..=18
@check is_id_card_cn';

comment on column adm_person.remark is
'备注
@len 0..=50';

comment on column adm_person.enabled is
'是否启用
false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用';

comment on column adm_person.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_person.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_person.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_person.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

/*==============================================================*/
/* Index: adm_person_PK                                         */
/*==============================================================*/
create unique index adm_person_PK on adm_person (
id
);

/*==============================================================*/
/* Index: Relationship_12_FK                                    */
/*==============================================================*/
create  index Relationship_12_FK on adm_person (
code_type_id
);

/*==============================================================*/
/* Table: adm_person_code_type                                  */
/*==============================================================*/
create table adm_person_code_type (
   id                   INT8                 not null,
   name                 VARCHAR(50)          not null,
   sort_order           INT4                 not null,
   remark               VARCHAR(50)          null,
   enabled              BOOL                 not null default true,
   creater_id           INT8                 not null,
   create_ms            INT8                 not null,
   updater_id           INT8                 not null,
   update_ms            INT8                 not null,
   constraint PK_ADM_PERSON_CODE_TYPE primary key (id),
   constraint AK_NAME_ADM_PERSON_CODE_TYPE unique (name)
);

comment on table adm_person_code_type is
'人员编码类型
有工号、学号等';

comment on column adm_person_code_type.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_person_code_type.name is
'名称
全局唯一（AK），如「工号」「学号」
@len 1..=50';

comment on column adm_person_code_type.sort_order is
'排序值
越小越靠前
@range 0..=9999';

comment on column adm_person_code_type.remark is
'备注
@len 0..=50';

comment on column adm_person_code_type.enabled is
'是否启用
false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用';

comment on column adm_person_code_type.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_person_code_type.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_person_code_type.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_person_code_type.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

/*==============================================================*/
/* Index: adm_person_code_type_PK                               */
/*==============================================================*/
create unique index adm_person_code_type_PK on adm_person_code_type (
id
);

/*==============================================================*/
/* Table: adm_realm                                             */
/*==============================================================*/
create table adm_realm (
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
   constraint PK_ADM_REALM primary key (id),
   constraint AK_CODE_ADM_REALM unique (code),
   constraint AK_NAME_ADM_REALM unique (name)
);

comment on table adm_realm is
'领域
用户与组织的数据域划分单位：只用于界定用户/组织归属与角色的数据可见范围，与应用、菜单、角色、权限等全局配置无关
一个组织/用户可以归属多个领域，关联见 realm_org / realm_user；角色的可见范围见 adm_role_realm_scope / adm_role_org_scope / adm_role_app_scope';

comment on column adm_realm.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_realm.code is
'编码
全局唯一（AK），创建后不改：数据域与迁移脚本都按它定位领域
@len 1..=50
@check is_code';

comment on column adm_realm.name is
'名称
全局唯一（AK），展示用
@len 1..=50';

comment on column adm_realm.sort_order is
'排序值
越小越靠前，列表按 (sort_order, id) 升序
@range 0..=9999';

comment on column adm_realm.remark is
'备注
@len 0..=50';

comment on column adm_realm.enabled is
'是否启用
false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用';

comment on column adm_realm.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_realm.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_realm.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_realm.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

/*==============================================================*/
/* Index: adm_realm_PK                                          */
/*==============================================================*/
create unique index adm_realm_PK on adm_realm (
id
);

/*==============================================================*/
/* Table: adm_realm_org                                         */
/*==============================================================*/
create table adm_realm_org (
   id                   INT8                 not null,
   realm_id             INT8                 not null,
   org_id               INT8                 not null,
   creater_id           INT8                 not null,
   create_ms            INT8                 not null,
   updater_id           INT8                 not null,
   update_ms            INT8                 not null,
   constraint PK_ADM_REALM_ORG primary key (id),
   constraint AK_REALM_ID_AND_ORG_ID_ADM_REALM_ORG unique (realm_id, org_id)
);

comment on table adm_realm_org is
'领域组织
领域与组织的多对多归属，一个组织可服务于多个领域';

comment on column adm_realm_org.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_realm_org.realm_id is
'领域 ID
关联 realm；(realm_id, org_id) 唯一（AK）';

comment on column adm_realm_org.org_id is
'组织 ID
关联 org；(realm_id, org_id) 唯一（AK）';

comment on column adm_realm_org.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_realm_org.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_realm_org.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_realm_org.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

/*==============================================================*/
/* Index: adm_realm_org_PK                                      */
/*==============================================================*/
create unique index adm_realm_org_PK on adm_realm_org (
id
);

/*==============================================================*/
/* Index: Relationship_3_FK                                     */
/*==============================================================*/
create  index Relationship_3_FK on adm_realm_org (
realm_id
);

/*==============================================================*/
/* Index: Relationship_4_FK                                     */
/*==============================================================*/
create  index Relationship_4_FK on adm_realm_org (
org_id
);

/*==============================================================*/
/* Table: adm_realm_user                                        */
/*==============================================================*/
create table adm_realm_user (
   id                   INT8                 not null,
   realm_id             INT8                 not null,
   user_id              INT8                 not null,
   creater_id           INT8                 not null,
   create_ms            INT8                 not null,
   updater_id           INT8                 not null,
   update_ms            INT8                 not null,
   constraint PK_ADM_REALM_USER primary key (id),
   constraint AK_REALM_ID_AND_USER_ID_ADM_REALM_USER unique (realm_id, user_id)
);

comment on table adm_realm_user is
'领域用户
领域与用户的多对多归属，决定该账号能进入哪些领域';

comment on column adm_realm_user.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_realm_user.realm_id is
'领域 ID
关联 realm；(realm_id, user_id) 唯一（AK）';

comment on column adm_realm_user.user_id is
'用户 ID
关联 user；(realm_id, user_id) 唯一（AK）';

comment on column adm_realm_user.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_realm_user.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_realm_user.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_realm_user.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

/*==============================================================*/
/* Index: adm_realm_user_PK                                     */
/*==============================================================*/
create unique index adm_realm_user_PK on adm_realm_user (
id
);

/*==============================================================*/
/* Index: Relationship_8_FK                                     */
/*==============================================================*/
create  index Relationship_8_FK on adm_realm_user (
realm_id
);

/*==============================================================*/
/* Index: Relationship_9_FK                                     */
/*==============================================================*/
create  index Relationship_9_FK on adm_realm_user (
user_id
);

/*==============================================================*/
/* Table: adm_role                                              */
/*==============================================================*/
create table adm_role (
   id                   INT8                 not null,
   group_id             INT8                 not null,
   name                 VARCHAR(50)          not null,
   sort_order           INT4                 not null,
   remark               VARCHAR(50)          null,
   enabled              BOOL                 not null default true,
   creater_id           INT8                 not null,
   create_ms            INT8                 not null,
   updater_id           INT8                 not null,
   update_ms            INT8                 not null,
   constraint PK_ADM_ROLE primary key (id),
   constraint AK_GROUP_ID_AND_NAME_ADM_ROLE unique (group_id, name)
);

comment on table adm_role is
'角色
权限的集合，按分组管理；角色与用户的关联见 role_user，与权限的关联见 role_perm';

comment on column adm_role.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_role.group_id is
'角色分组 ID
关联 role_group；(group_id, name) 唯一，不同分组可以重名';

comment on column adm_role.name is
'名称
同一分组内唯一（AK）
@len 1..=50';

comment on column adm_role.sort_order is
'排序值
同一分组内排序，越小越靠前
@range 0..=9999';

comment on column adm_role.remark is
'备注
@len 0..=50';

comment on column adm_role.enabled is
'是否启用
false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用';

comment on column adm_role.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_role.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_role.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_role.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

/*==============================================================*/
/* Index: adm_role_PK                                           */
/*==============================================================*/
create unique index adm_role_PK on adm_role (
id
);

/*==============================================================*/
/* Index: Relationship_14_FK                                    */
/*==============================================================*/
create  index Relationship_14_FK on adm_role (
group_id
);

/*==============================================================*/
/* Table: adm_role_app_scope                                    */
/*==============================================================*/
create table adm_role_app_scope (
   id                   INT8                 not null,
   role_id              INT8                 not null,
   app_id               INT8                 not null,
   creater_id           INT8                 not null,
   create_ms            INT8                 not null,
   updater_id           INT8                 not null,
   update_ms            INT8                 not null,
   constraint PK_ADM_ROLE_APP_SCOPE primary key (id),
   constraint AK_ROLE_ID_AND_APP_ID_ADM_ROLE_APP_SCOPE unique (role_id, app_id)
);

comment on table adm_role_app_scope is
'角色应用可见范围
角色可见范围白名单：该角色可以看哪些应用。只管可见范围，不管功能权限；功能权限由 role_menu / role_perm 决定。
角色没有对应行 = 该维度全量可见（配了才限制）；多角色取并集';

comment on column adm_role_app_scope.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_role_app_scope.role_id is
'角色 ID
关联 role；(app_id, role_id) 唯一（AK）';

comment on column adm_role_app_scope.app_id is
'应用 ID
关联 app；(app_id, role_id) 唯一（AK）';

comment on column adm_role_app_scope.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_role_app_scope.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_role_app_scope.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_role_app_scope.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

/*==============================================================*/
/* Index: adm_role_app_scope_PK                                 */
/*==============================================================*/
create unique index adm_role_app_scope_PK on adm_role_app_scope (
id
);

/*==============================================================*/
/* Index: role_app_scope_role_FK                                */
/*==============================================================*/
create  index role_app_scope_role_FK on adm_role_app_scope (
role_id
);

/*==============================================================*/
/* Index: role_app_scope_app_FK                                 */
/*==============================================================*/
create  index role_app_scope_app_FK on adm_role_app_scope (
app_id
);

/*==============================================================*/
/* Table: adm_role_group                                        */
/*==============================================================*/
create table adm_role_group (
   id                   INT8                 not null,
   tree_code            VARCHAR(30)          not null,
   name                 VARCHAR(50)          not null,
   remark               VARCHAR(50)          null,
   enabled              BOOL                 not null default true,
   creater_id           INT8                 not null,
   create_ms            INT8                 not null,
   updater_id           INT8                 not null,
   update_ms            INT8                 not null,
   constraint PK_ADM_ROLE_GROUP primary key (id),
   constraint AK_TREE_CODE_ADM_ROLE_GROUP unique (tree_code)
);

comment on table adm_role_group is
'角色分组
全局两级结构（分组 → 角色），树形由 tree_code 表达，tree_code 全局唯一';

comment on column adm_role_group.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_role_group.tree_code is
'树编码
路径枚举存树：字典序即树的前序，子节点紧跟在父节点之后，排序直接用 ORDER BY tree_code，不需要额外排序列
每层固定 3 位数字（不足左补 0），不加分隔符：001 → 001002 → 001002003
总长 = 层数 × 3（必须是 3 的倍数）；列宽 30 即最多 10 层，每层最多 999 个兄弟
中间插入按 010、020、030 递增留空位；调整顺序 = 改编码，会级联该节点整棵子树
@len 3..=30
@check is_tree_code';

comment on column adm_role_group.name is
'名称
同一父节点下的兄弟名称不做唯一约束，靠 tree_code 区分
@len 1..=50';

comment on column adm_role_group.remark is
'备注
@len 0..=50';

comment on column adm_role_group.enabled is
'是否启用
false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用';

comment on column adm_role_group.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_role_group.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_role_group.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_role_group.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

/*==============================================================*/
/* Index: adm_role_group_PK                                     */
/*==============================================================*/
create unique index adm_role_group_PK on adm_role_group (
id
);

/*==============================================================*/
/* Table: adm_role_menu                                         */
/*==============================================================*/
create table adm_role_menu (
   id                   INT8                 not null,
   menu_id              INT8                 not null,
   role_id              INT8                 not null,
   creater_id           INT8                 not null,
   create_ms            INT8                 not null,
   updater_id           INT8                 not null,
   update_ms            INT8                 not null,
   constraint PK_ADM_ROLE_MENU primary key (id),
   constraint AK_MENU_ID_AND_ROLE_ID_ADM_ROLE_MENU unique (menu_id, role_id)
);

comment on table adm_role_menu is
'角色菜单
角色与菜单的多对多关联，决定该角色登录后能看到哪些菜单';

comment on column adm_role_menu.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_role_menu.menu_id is
'菜单 ID
关联 menu；(menu_id, role_id) 唯一（AK）';

comment on column adm_role_menu.role_id is
'角色 ID
关联 role；(menu_id, role_id) 唯一（AK）';

comment on column adm_role_menu.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_role_menu.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_role_menu.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_role_menu.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

/*==============================================================*/
/* Index: adm_role_menu_PK                                      */
/*==============================================================*/
create unique index adm_role_menu_PK on adm_role_menu (
id
);

/*==============================================================*/
/* Index: Relationship_26_FK                                    */
/*==============================================================*/
create  index Relationship_26_FK on adm_role_menu (
menu_id
);

/*==============================================================*/
/* Index: Relationship_27_FK                                    */
/*==============================================================*/
create  index Relationship_27_FK on adm_role_menu (
role_id
);

/*==============================================================*/
/* Table: adm_role_org_scope                                    */
/*==============================================================*/
create table adm_role_org_scope (
   id                   INT8                 not null,
   role_id              INT8                 not null,
   org_id               INT8                 not null,
   creater_id           INT8                 not null,
   create_ms            INT8                 not null,
   updater_id           INT8                 not null,
   update_ms            INT8                 not null,
   constraint PK_ADM_ROLE_ORG_SCOPE primary key (id),
   constraint AK_ROLE_ID_AND_ORG_ID_ADM_ROLE_ORG_SCOPE unique (role_id, org_id)
);

comment on table adm_role_org_scope is
'角色组织可见范围
角色可见范围白名单：该角色可以看哪些组织。只管可见范围，不管功能权限；功能权限由 role_menu / role_perm 决定。
角色没有对应行 = 该维度全量可见（配了才限制）；多角色取并集';

comment on column adm_role_org_scope.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_role_org_scope.role_id is
'角色 ID
关联 role；(org_id, role_id) 唯一（AK）';

comment on column adm_role_org_scope.org_id is
'组织 ID
关联 org；(org_id, role_id) 唯一（AK）';

comment on column adm_role_org_scope.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_role_org_scope.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_role_org_scope.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_role_org_scope.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

/*==============================================================*/
/* Index: adm_role_org_scope_PK                                 */
/*==============================================================*/
create unique index adm_role_org_scope_PK on adm_role_org_scope (
id
);

/*==============================================================*/
/* Index: role_org_scope_role_FK                                */
/*==============================================================*/
create  index role_org_scope_role_FK on adm_role_org_scope (
role_id
);

/*==============================================================*/
/* Index: role_org_scope_org_FK                                 */
/*==============================================================*/
create  index role_org_scope_org_FK on adm_role_org_scope (
org_id
);

/*==============================================================*/
/* Table: adm_role_perm                                         */
/*==============================================================*/
create table adm_role_perm (
   id                   INT8                 not null,
   role_id              INT8                 not null,
   perm_id              INT8                 not null,
   creater_id           INT8                 not null,
   create_ms            INT8                 not null,
   updater_id           INT8                 not null,
   update_ms            INT8                 not null,
   constraint PK_ADM_ROLE_PERM primary key (id),
   constraint AK_ROLE_ID_AND_PERM_ID_ADM_ROLE_PERM unique (role_id, perm_id)
);

comment on table adm_role_perm is
'角色权限
角色与权限的多对多授权关系，鉴权时按 user → role_user → role_perm → perm.urn 展开';

comment on column adm_role_perm.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_role_perm.role_id is
'角色 ID
关联 role；(role_id, perm_id) 唯一（AK）';

comment on column adm_role_perm.perm_id is
'权限 ID
关联 perm；(role_id, perm_id) 唯一（AK）';

comment on column adm_role_perm.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_role_perm.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_role_perm.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_role_perm.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

/*==============================================================*/
/* Index: adm_role_perm_PK                                      */
/*==============================================================*/
create unique index adm_role_perm_PK on adm_role_perm (
id
);

/*==============================================================*/
/* Index: Relationship_20_FK                                    */
/*==============================================================*/
create  index Relationship_20_FK on adm_role_perm (
role_id
);

/*==============================================================*/
/* Index: Relationship_21_FK                                    */
/*==============================================================*/
create  index Relationship_21_FK on adm_role_perm (
perm_id
);

/*==============================================================*/
/* Table: adm_role_realm_scope                                  */
/*==============================================================*/
create table adm_role_realm_scope (
   id                   INT8                 not null,
   role_id              INT8                 not null,
   realm_id             INT8                 not null,
   creater_id           INT8                 not null,
   create_ms            INT8                 not null,
   updater_id           INT8                 not null,
   update_ms            INT8                 not null,
   constraint PK_ADM_ROLE_REALM_SCOPE primary key (id),
   constraint AK_ROLE_ID_AND_REALM_ID_ADM_ROLE_REALM_SCOPE unique (role_id, realm_id)
);

comment on table adm_role_realm_scope is
'角色领域可见范围
角色可见范围白名单：该角色可以看哪些领域。只管可见范围，不管功能权限；功能权限由 role_menu / role_perm 决定。
角色没有对应行 = 该维度全量可见（配了才限制）；多角色取并集';

comment on column adm_role_realm_scope.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_role_realm_scope.role_id is
'角色 ID
关联 role；(realm_id, role_id) 唯一（AK）';

comment on column adm_role_realm_scope.realm_id is
'领域 ID
关联 realm；(realm_id, role_id) 唯一（AK）';

comment on column adm_role_realm_scope.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_role_realm_scope.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_role_realm_scope.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_role_realm_scope.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

/*==============================================================*/
/* Index: adm_role_realm_scope_PK                               */
/*==============================================================*/
create unique index adm_role_realm_scope_PK on adm_role_realm_scope (
id
);

/*==============================================================*/
/* Index: role_realm_scope_role_FK                              */
/*==============================================================*/
create  index role_realm_scope_role_FK on adm_role_realm_scope (
role_id
);

/*==============================================================*/
/* Index: role_realm_scope_realm_FK                             */
/*==============================================================*/
create  index role_realm_scope_realm_FK on adm_role_realm_scope (
realm_id
);

/*==============================================================*/
/* Table: adm_role_user                                         */
/*==============================================================*/
create table adm_role_user (
   id                   INT8                 not null,
   user_id              INT8                 not null,
   role_id              INT8                 not null,
   creater_id           INT8                 not null,
   create_ms            INT8                 not null,
   updater_id           INT8                 not null,
   update_ms            INT8                 not null,
   constraint PK_ADM_ROLE_USER primary key (id),
   constraint AK_USER_ID_AND_ROLE_ID_ADM_ROLE_USER unique (user_id, role_id)
);

comment on table adm_role_user is
'角色用户
角色与用户的多对多授权关系';

comment on column adm_role_user.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_role_user.user_id is
'用户 ID
关联 user；(user_id, role_id) 唯一（AK）';

comment on column adm_role_user.role_id is
'角色 ID
关联 role；(user_id, role_id) 唯一（AK）';

comment on column adm_role_user.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_role_user.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_role_user.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_role_user.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

/*==============================================================*/
/* Index: adm_role_user_PK                                      */
/*==============================================================*/
create unique index adm_role_user_PK on adm_role_user (
id
);

/*==============================================================*/
/* Index: Relationship_16_FK                                    */
/*==============================================================*/
create  index Relationship_16_FK on adm_role_user (
user_id
);

/*==============================================================*/
/* Index: Relationship_17_FK                                    */
/*==============================================================*/
create  index Relationship_17_FK on adm_role_user (
role_id
);

/*==============================================================*/
/* Table: adm_user                                              */
/*==============================================================*/
create table adm_user (
   id                   INT8                 not null,
   person_id            INT8                 null,
   name                 VARCHAR(50)          not null,
   nick_name            VARCHAR(50)          null,
   mobile               VARCHAR(20)          null,
   mobile_verified      BOOL                 not null default false,
   email                VARCHAR(50)          null,
   email_verified       BOOL                 not null default false,
   id_card              VARCHAR(20)          null,
   real_name            VARCHAR(200)         null,
   real_name_verified   BOOL                 not null default false,
   login_pswd           VARCHAR(64)          not null,
   login_pswd_salt      CHAR(6)              not null,
   login_pswd_default   BOOL                 not null default false,
   audit_pswd           VARCHAR(64)          not null,
   audit_pswd_salt      CHAR(6)              not null,
   pay_pswd             VARCHAR(64)          not null,
   pay_pswd_salt        CHAR(6)              not null,
   expire_ms            INT8                 null,
   status               INT2                 not null default 1,
   fail_count           INT2                 not null default 0,
   lock_until_ms        INT8                 null,
   last_login_ms        INT8                 null,
   remark               VARCHAR(50)          null,
   enabled              BOOL                 not null default true,
   creater_id           INT8                 not null,
   create_ms            INT8                 not null,
   updater_id           INT8                 not null,
   update_ms            INT8                 not null,
   constraint PK_ADM_USER primary key (id),
   constraint AK_NAME_ADM_USER unique (name),
   constraint AK_MOBILE_ADM_USER unique (mobile),
   constraint AK_EMAIL_ADM_USER unique (email),
   constraint AK_ID_CARD_ADM_USER unique (id_card)
);

comment on table adm_user is
'用户（账号）
回答「哪个标识能登进哪个账号」：登录名、登录用手机/邮箱、实名信息（姓名 + 身份证）、三套密码、状态
实名信息与核验位放在本表：登录时的实名校验以账号为单位，person 只存人员档案、不记核验状态';

comment on column adm_user.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_user.person_id is
'人员 ID
关联 person，一个自然人可挂多个账号
为空表示纯账号（外部认证、系统账号、机器人），不关联人员档案';

comment on column adm_user.name is
'登录名
登录时输入的唯一标识，全局唯一（AK）；手机号另有唯一约束（见 mobile），邮箱没有
4~32 位，字母开头，只含字母、数字、下划线
@len 4..=32
@check is_account_name';

comment on column adm_user.nick_name is
'昵称
展示用，允许重复，不做唯一约束
@len 0..=50';

comment on column adm_user.mobile is
'手机号（登录用）
全局唯一（AK）：一个手机号只能定位一个账号
与 person.mobile 的语义不同，后者是人员档案上的联系方式
入库前请去掉 +86 与分隔符
@len 11..=11
@check is_mobile_cn';

comment on column adm_user.mobile_verified is
'手机号是否已验证
true 表示该手机号通过短信验证码校验；注册后未验证也能登录，但改密/支付等敏感操作要求已验
未验证记 false，不用 NULL：三态的「不知道是否验证过」没有业务含义';

comment on column adm_user.email is
'邮箱（登录用）
全局唯一（AK）：一个邮箱只能定位到一个账号，可用于邮箱登录与找回密码
与 person.email 的语义不同，后者是人员档案上的联系方式，两者各自唯一、互不覆盖
@len 0..=50
@check is_email';

comment on column adm_user.email_verified is
'邮箱是否已验证
true 表示该邮箱通过验证链接校验，可用于找回密码与接收通知
未验证记 false，不用 NULL：三态没有业务含义';

comment on column adm_user.id_card is
'身份证号（登录实名用）
可空：手机号注册的账号可以先不填；一经填写就全局唯一（AK），一个身份证只能绑一个账号
空值不参与唯一去重（PostgreSQL 的 AK 不约束 NULL），所以「未实名的账号」不会互相冲突
人员档案上的同一份数据见 person.id_card，由实名核验流程保证一致
18 位，末位可为 X
@len 18..=18
@check is_id_card_cn';

comment on column adm_user.real_name is
'真实姓名（登录实名用）
可空：与 id_card 配对，未实名的账号两列都为空；填了一列就必须填另一列
与 person.name 是同一份事实的两处记录，实名核验流程在一个事务里同时写两处，不要只写一边
长度 200 与 person.name 对齐，容纳少数民族长姓名；不挂 is_chinese_name：外籍与少数民族姓名允许非汉字
@len 1..=200';

comment on column adm_user.real_name_verified is
'是否已验证实名
true 表示姓名（real_name）与身份证号（id_card）这一组已通过实名核验
核验对象是两列的组合，单独一列没有意义：real_name / id_card 未填时本列只能为 false
登录时若要求「实名后才能操作」，判这一列';

comment on column adm_user.login_pswd is
'登录密码
(小写(SM3(小写(SM3(密码明文))+小写(密码组合码))))
固定 64 位小写十六进制（SM3 输出 32 字节）
注意：
1. 计算方法中的密码在前端传过来时推荐先进行 sm3 序列化，以避免在密码传递过程中使用明码被截获
2. 密码组合码在生成密码时随机生成并保存下来，和密码组合起来使用，增加破解的难度
@len 64..=64
@secret';

comment on column adm_user.login_pswd_salt is
'登录密码组合码
与密码组合加密用，详见登录密码备注
6 位随机串
@len 6..=6
@secret';

comment on column adm_user.login_pswd_default is
'登录密码是否默认密码
true 表示仍是初始密码，前端应强制修改后才能继续操作';

comment on column adm_user.audit_pswd is
'审核密码
(小写(SM3(小写(SM3(密码明文))+小写(密码组合码))))
固定 64 位小写十六进制（SM3 输出 32 字节）
@len 64..=64
@secret';

comment on column adm_user.audit_pswd_salt is
'审核密码组合码
与密码组合加密用，详见审核密码备注
6 位随机串
@len 6..=6
@secret';

comment on column adm_user.pay_pswd is
'支付密码
(小写(SM3(小写(SM3(密码明文))+小写(密码组合码))))
固定 64 位小写十六进制（SM3 输出 32 字节）
@len 64..=64
@secret';

comment on column adm_user.pay_pswd_salt is
'支付密码组合码
与密码组合加密用，详见支付密码备注
6 位随机串
@len 6..=6
@secret';

comment on column adm_user.expire_ms is
'过期时间戳
账户到期时间；定时任务扫描到已过期时把 enabled 置 false
与 status 的区别：status 是人工停用与锁定判定，expire_ms 是到期自动停用
@unit ms';

comment on column adm_user.status is
'状态
1-正常
2-已停用
3-已锁定
与 enabled 的关系：enabled=false 时账号整体不可登录，status 用于展示与锁定判定
@range 1..=3';

comment on column adm_user.fail_count is
'登录失败次数
登录成功后清零；达到阈值时把 status 置 3 并写入 lock_until_ms
@range 0..=100';

comment on column adm_user.lock_until_ms is
'锁定到期时间戳
为空或已过期表示未锁定；解锁时置空并把 status 恢复为 1
@unit ms';

comment on column adm_user.last_login_ms is
'最近登录时间戳
只记录成功登录，失败尝试见 login_log
@unit ms';

comment on column adm_user.remark is
'备注
@len 0..=50';

comment on column adm_user.enabled is
'是否启用
false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用';

comment on column adm_user.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_user.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_user.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_user.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

/*==============================================================*/
/* Index: adm_user_PK                                           */
/*==============================================================*/
create unique index adm_user_PK on adm_user (
id
);

/*==============================================================*/
/* Index: Relationship_13_FK                                    */
/*==============================================================*/
create  index Relationship_13_FK on adm_user (
person_id
);

/*==============================================================*/
/* Table: adm_widget_endpoint                                   */
/*==============================================================*/
create table adm_widget_endpoint (
   id                   INT8                 not null,
   service              VARCHAR(32)          not null,
   endpoint             VARCHAR(64)          not null,
   name                 VARCHAR(64)          not null,
   method               VARCHAR(8)           not null,
   params_hint          VARCHAR(255)         null,
   enabled              BOOL                 not null default true,
   note                 VARCHAR(255)         null,
   sort_order           INT4                 not null,
   creater_id           INT8                 not null,
   create_ms            INT8                 not null,
   updater_id           INT8                 not null,
   update_ms            INT8                 not null,
   constraint PK_ADM_WIDGET_ENDPOINT primary key (id),
   constraint AK_SERVICE_AND_ENDPOINT_ADM_WIDGET_ENDPOINT unique (service, endpoint)
);

comment on table adm_widget_endpoint is
'组件端点
仪表盘组件可调用的后端接口注册表，每个 (service, endpoint) 唯一';

comment on column adm_widget_endpoint.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_widget_endpoint.service is
'服务名
后端微服务名称；(service, endpoint) 唯一（AK）
@len 1..=32';

comment on column adm_widget_endpoint.endpoint is
'端点路径
后端接口路径；(service, endpoint) 唯一（AK）
@len 1..=64';

comment on column adm_widget_endpoint.name is
'名称
端点展示名称
@len 1..=64';

comment on column adm_widget_endpoint.method is
'HTTP 方法
GET、POST、PUT、DELETE 等
@len 1..=8';

comment on column adm_widget_endpoint.params_hint is
'参数提示
JSON 格式的参数示例或说明
@len 0..=255';

comment on column adm_widget_endpoint.enabled is
'是否启用
false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用';

comment on column adm_widget_endpoint.note is
'备注说明
@len 0..=255';

comment on column adm_widget_endpoint.sort_order is
'排序值
越小越靠前
@range 0..=9999';

comment on column adm_widget_endpoint.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_widget_endpoint.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_widget_endpoint.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_widget_endpoint.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

/*==============================================================*/
/* Index: adm_widget_endpoint_PK                                */
/*==============================================================*/
create unique index adm_widget_endpoint_PK on adm_widget_endpoint (
id
);

/*==============================================================*/
/* Table: adm_widget_type                                       */
/*==============================================================*/
create table adm_widget_type (
   id                   INT8                 not null,
   code                 VARCHAR(32)          not null,
   name                 VARCHAR(64)          not null,
   default_service      VARCHAR(32)          not null,
   default_endpoint     VARCHAR(64)          not null,
   description          VARCHAR(255)         null,
   default_params       TEXT                 null,
   default_perm_urn     VARCHAR(128)         null,
   default_scope_aware  BOOL                 not null,
   sort_order           INT4                 not null,
   enabled              BOOL                 not null default true,
   creater_id           INT8                 not null,
   create_ms            INT8                 not null,
   updater_id           INT8                 not null,
   update_ms            INT8                 not null,
   constraint PK_ADM_WIDGET_TYPE primary key (id),
   constraint AK_CODE_ADM_WIDGET_TYPE unique (code)
);

comment on table adm_widget_type is
'组件类型
仪表盘组件类型字典，定义各类组件的默认配置（服务、端点、参数等）';

comment on column adm_widget_type.id is
'主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

comment on column adm_widget_type.code is
'编码
全局唯一（AK），组件类型的标识
@len 1..=32
@check is_code';

comment on column adm_widget_type.name is
'名称
组件类型展示名称
@len 1..=64';

comment on column adm_widget_type.default_service is
'默认服务名
该类型组件默认调用的后端服务
@len 1..=32';

comment on column adm_widget_type.default_endpoint is
'默认端点路径
该类型组件默认调用的接口路径
@len 1..=64';

comment on column adm_widget_type.description is
'描述
组件类型的详细说明
@len 0..=255';

comment on column adm_widget_type.default_params is
'默认参数
JSON 格式的默认请求参数';

comment on column adm_widget_type.default_perm_urn is
'默认权限 URN
该类型组件默认的权限标识
@len 0..=128';

comment on column adm_widget_type.default_scope_aware is
'默认是否感知数据范围
创建组件实例时的默认值';

comment on column adm_widget_type.sort_order is
'排序值
越小越靠前
@range 0..=9999';

comment on column adm_widget_type.enabled is
'是否启用
false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用';

comment on column adm_widget_type.creater_id is
'创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_widget_type.create_ms is
'创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

comment on column adm_widget_type.updater_id is
'最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

comment on column adm_widget_type.update_ms is
'最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

/*==============================================================*/
/* Index: adm_widget_type_PK                                    */
/*==============================================================*/
create unique index adm_widget_type_PK on adm_widget_type (
id
);

alter table adm_dashboard
   add constraint fk_role_id__from__adm_role foreign key (role_id)
      references adm_role (id)
      on delete restrict on update restrict;

alter table adm_dashboard_widget
   add constraint fk_dashboard_id__from__adm_dashboard foreign key (dashboard_id)
      references adm_dashboard (id)
      on delete restrict on update restrict;

alter table adm_dashboard_widget
   add constraint fk_widget_type__from__adm_widget_type foreign key (widget_type)
      references adm_widget_type (code)
      on delete restrict on update restrict;

alter table adm_lock_log
   add constraint fk_user_id__from__adm_user foreign key (user_id)
      references adm_user (id)
      on delete restrict on update restrict;

alter table adm_login_log
   add constraint fk_user_id__from__adm_user foreign key (user_id)
      references adm_user (id)
      on delete restrict on update restrict;

alter table adm_menu
   add constraint fk_app_id__from__adm_app foreign key (app_id)
      references adm_app (id)
      on delete restrict on update restrict;

alter table adm_menu_perm
   add constraint fk_menu_id__from__adm_menu foreign key (menu_id)
      references adm_menu (id)
      on delete restrict on update restrict;

alter table adm_menu_perm
   add constraint fk_perm_id__from__adm_perm foreign key (perm_id)
      references adm_perm (id)
      on delete restrict on update restrict;

alter table adm_op_log
   add constraint fk_user_id__from__adm_user foreign key (user_id)
      references adm_user (id)
      on delete restrict on update restrict;

alter table adm_op_log
   add constraint fk_op_type_code__from__adm_op_type foreign key (op_type_code)
      references adm_op_type (code)
      on delete restrict on update restrict;

alter table adm_org
   add constraint fk_org_type_id__from__adm_org_type foreign key (org_type_id)
      references adm_org_type (id)
      on delete restrict on update restrict;

alter table adm_org_user
   add constraint fk_org_id__from__adm_org foreign key (org_id)
      references adm_org (id)
      on delete restrict on update restrict;

alter table adm_org_user
   add constraint fk_user_id__from__adm_user foreign key (user_id)
      references adm_user (id)
      on delete restrict on update restrict;

alter table adm_perm
   add constraint fk_group_id__from__adm_perm_group foreign key (group_id)
      references adm_perm_group (id)
      on delete restrict on update restrict;

alter table adm_perm
   add constraint fk_op_type_code__from__adm_op_type foreign key (op_type_code)
      references adm_op_type (code)
      on delete restrict on update restrict;

alter table adm_person
   add constraint fk_code_type_id__from__adm_person_code_type foreign key (code_type_id)
      references adm_person_code_type (id)
      on delete restrict on update restrict;

alter table adm_realm_org
   add constraint fk_realm_id__from__adm_realm foreign key (realm_id)
      references adm_realm (id)
      on delete restrict on update restrict;

alter table adm_realm_org
   add constraint fk_org_id__from__adm_org foreign key (org_id)
      references adm_org (id)
      on delete restrict on update restrict;

alter table adm_realm_user
   add constraint fk_realm_id__from__adm_realm foreign key (realm_id)
      references adm_realm (id)
      on delete restrict on update restrict;

alter table adm_realm_user
   add constraint fk_user_id__from__adm_user foreign key (user_id)
      references adm_user (id)
      on delete restrict on update restrict;

alter table adm_role
   add constraint fk_group_id__from__adm_role_group foreign key (group_id)
      references adm_role_group (id)
      on delete restrict on update restrict;

alter table adm_role_app_scope
   add constraint fk_app_id__from__adm_app foreign key (app_id)
      references adm_app (id)
      on delete restrict on update restrict;

alter table adm_role_app_scope
   add constraint fk_role_id__from__adm_role foreign key (role_id)
      references adm_role (id)
      on delete restrict on update restrict;

alter table adm_role_menu
   add constraint fk_menu_id__from__adm_menu foreign key (menu_id)
      references adm_menu (id)
      on delete restrict on update restrict;

alter table adm_role_menu
   add constraint fk_role_id__from__adm_role foreign key (role_id)
      references adm_role (id)
      on delete restrict on update restrict;

alter table adm_role_org_scope
   add constraint fk_org_id__from__adm_org foreign key (org_id)
      references adm_org (id)
      on delete restrict on update restrict;

alter table adm_role_org_scope
   add constraint fk_role_id__from__adm_role foreign key (role_id)
      references adm_role (id)
      on delete restrict on update restrict;

alter table adm_role_perm
   add constraint fk_role_id__from__adm_role foreign key (role_id)
      references adm_role (id)
      on delete restrict on update restrict;

alter table adm_role_perm
   add constraint fk_perm_id__from__adm_perm foreign key (perm_id)
      references adm_perm (id)
      on delete restrict on update restrict;

alter table adm_role_realm_scope
   add constraint fk_realm_id__from__adm_realm foreign key (realm_id)
      references adm_realm (id)
      on delete restrict on update restrict;

alter table adm_role_realm_scope
   add constraint fk_role_id__from__adm_role foreign key (role_id)
      references adm_role (id)
      on delete restrict on update restrict;

alter table adm_role_user
   add constraint fk_user_id__from__adm_user foreign key (user_id)
      references adm_user (id)
      on delete restrict on update restrict;

alter table adm_role_user
   add constraint fk_role_id__from__adm_role foreign key (role_id)
      references adm_role (id)
      on delete restrict on update restrict;

alter table adm_user
   add constraint fk_person_id__from__adm_person foreign key (person_id)
      references adm_person (id)
      on delete restrict on update restrict;

