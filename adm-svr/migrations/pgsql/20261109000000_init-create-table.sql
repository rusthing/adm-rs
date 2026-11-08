-- adm 数据库迁移基线：init-create-table（最终态建表）
--
-- 清库后按 000000 → 000001 → 000002 顺序执行一次建成。
-- 表、列、主键、唯一键、外键、检查约束与注释；普通索引在 init-index.sql。
-- 与线上库 pg_dump -s 归一化后逐行一致。

CREATE TABLE public.adm_app (
    id bigint NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(50) NOT NULL,
    sort_order integer NOT NULL,
    remark character varying(50),
    enabled boolean DEFAULT true NOT NULL,
    creater_id bigint NOT NULL,
    create_ms bigint NOT NULL,
    updater_id bigint NOT NULL,
    update_ms bigint NOT NULL
);

COMMENT ON TABLE public.adm_app IS '应用
菜单树的归属单位，全局配置：后台、前台、移动端各一棵菜单树，与领域无关';

COMMENT ON COLUMN public.adm_app.id IS '主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

COMMENT ON COLUMN public.adm_app.code IS '应用编码
全局唯一（AK），前端用它区分路由与请求来源
@len 1..=50
@check is_code';

COMMENT ON COLUMN public.adm_app.name IS '名称
全局唯一（AK）
@len 1..=50';

COMMENT ON COLUMN public.adm_app.sort_order IS '排序值
全局排序，越小越靠前
@range 0..=9999';

COMMENT ON COLUMN public.adm_app.remark IS '备注
@len 0..=50';

COMMENT ON COLUMN public.adm_app.enabled IS '是否启用
false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用';

COMMENT ON COLUMN public.adm_app.creater_id IS '创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_app.create_ms IS '创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

COMMENT ON COLUMN public.adm_app.updater_id IS '最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_app.update_ms IS '最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

CREATE TABLE public.adm_dashboard (
    id bigint NOT NULL,
    role_id bigint,
    name character varying(64) NOT NULL,
    remark character varying(255),
    enabled boolean DEFAULT true NOT NULL,
    creater_id bigint DEFAULT 0 NOT NULL,
    create_ms bigint DEFAULT 0 NOT NULL,
    updater_id bigint DEFAULT 0 NOT NULL,
    update_ms bigint DEFAULT 0 NOT NULL
);

CREATE TABLE public.adm_dashboard_widget (
    id bigint NOT NULL,
    dashboard_id bigint NOT NULL,
    widget_type character varying(32) NOT NULL,
    title character varying(64) NOT NULL,
    service character varying(32) NOT NULL,
    endpoint character varying(64) NOT NULL,
    params text,
    perm_urn character varying(128),
    scope_aware boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    creater_id bigint DEFAULT 0 NOT NULL,
    create_ms bigint DEFAULT 0 NOT NULL,
    updater_id bigint DEFAULT 0 NOT NULL,
    update_ms bigint DEFAULT 0 NOT NULL
);

CREATE TABLE public.adm_lock_log (
    id bigint NOT NULL,
    user_id bigint,
    lock_ms bigint NOT NULL,
    lock_reason character varying(100) NOT NULL,
    unlock_ms bigint,
    unlock_reason character varying(100),
    creater_id bigint NOT NULL,
    create_ms bigint NOT NULL,
    updater_id bigint NOT NULL,
    update_ms bigint NOT NULL
);

COMMENT ON TABLE public.adm_lock_log IS '锁定日志
账户锁定与解锁的流水：锁定写一行，解锁时回填 unlock_ms / unlock_reason，同一行贯穿一次锁定周期';

COMMENT ON COLUMN public.adm_lock_log.id IS '主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

COMMENT ON COLUMN public.adm_lock_log.user_id IS '用户 ID
关联 user；为空表示账号已被删除，但锁定流水仍需保留';

COMMENT ON COLUMN public.adm_lock_log.lock_ms IS '锁定时间戳
@unit ms';

COMMENT ON COLUMN public.adm_lock_log.lock_reason IS '锁定原因
如「连续登录失败 5 次」「管理员手动锁定」
@len 1..=100';

COMMENT ON COLUMN public.adm_lock_log.unlock_ms IS '解锁时间戳
为空表示仍在锁定中（这是「锁定中」的唯一判据）
@unit ms';

COMMENT ON COLUMN public.adm_lock_log.unlock_reason IS '解锁原因
为空表示尚未解锁，与 unlock_ms 同时为空才是一条有效的「锁定中」记录
@len 1..=100';

COMMENT ON COLUMN public.adm_lock_log.creater_id IS '创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_lock_log.create_ms IS '创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

COMMENT ON COLUMN public.adm_lock_log.updater_id IS '最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_lock_log.update_ms IS '最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

CREATE TABLE public.adm_login_log (
    id bigint NOT NULL,
    user_id bigint,
    login_ms bigint NOT NULL,
    logout_ms bigint,
    login_ip character varying(45) NOT NULL,
    creater_id bigint NOT NULL,
    create_ms bigint NOT NULL,
    updater_id bigint NOT NULL,
    update_ms bigint NOT NULL
);

COMMENT ON TABLE public.adm_login_log IS '登录日志
每次登录尝试一行（含失败），用于安全审计与异常登录排查';

COMMENT ON COLUMN public.adm_login_log.id IS '主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

COMMENT ON COLUMN public.adm_login_log.user_id IS '用户 ID
关联 user；为空表示登录名不存在（失败的尝试也要留痕）';

COMMENT ON COLUMN public.adm_login_log.login_ms IS '登录时间戳
@unit ms';

COMMENT ON COLUMN public.adm_login_log.logout_ms IS '登出时间戳
为空表示未登出（会话超时或仍在线）
@unit ms';

COMMENT ON COLUMN public.adm_login_log.login_ip IS '登录 IP
IPv4 与 IPv6 都存，45 是 IPv6 带内嵌 IPv4 时的最长文本长度（如 ::ffff:192.168.1.10）
@len 1..=45
@check is_ip';

COMMENT ON COLUMN public.adm_login_log.creater_id IS '创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_login_log.create_ms IS '创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

COMMENT ON COLUMN public.adm_login_log.updater_id IS '最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_login_log.update_ms IS '最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

CREATE TABLE public.adm_menu (
    id bigint NOT NULL,
    app_id bigint NOT NULL,
    tree_code character varying(30) NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(50) NOT NULL,
    path character varying(100) NOT NULL,
    component character varying(200),
    link_type smallint DEFAULT 1 NOT NULL,
    icon character varying(50),
    keep_alive boolean DEFAULT false NOT NULL,
    visible boolean DEFAULT true NOT NULL,
    remark character varying(50),
    enabled boolean DEFAULT true NOT NULL,
    creater_id bigint NOT NULL,
    create_ms bigint NOT NULL,
    updater_id bigint NOT NULL,
    update_ms bigint NOT NULL
);

COMMENT ON TABLE public.adm_menu IS '菜单
前端动态路由的数据源：一棵树 + 组件路径 + 权限点
目录与菜单的区别由 component 是否为空推导，不用单独的类型列';

COMMENT ON COLUMN public.adm_menu.id IS '主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

COMMENT ON COLUMN public.adm_menu.app_id IS '所属应用 ID
关联 app；菜单树按应用隔离，tree_code 只在本应用内唯一';

COMMENT ON COLUMN public.adm_menu.tree_code IS '树编码
路径枚举存树：字典序即树的前序，子节点紧跟在父节点之后，排序直接用 ORDER BY tree_code，不需要额外排序列
每层固定 3 位数字（不足左补 0），不加分隔符：001 → 001002 → 001002003
总长 = 层数 × 3（必须是 3 的倍数）；列宽 30 即最多 10 层，每层最多 999 个兄弟
中间插入按 010、020、030 递增留空位；调整顺序 = 改编码，会级联该节点整棵子树
@len 3..=30
@check is_tree_code';

COMMENT ON COLUMN public.adm_menu.code IS '编码
同一应用内唯一（AK）；前端用作路由 name（编程式跳转、keep-alive 的 include 键）
不能用 tree_code 代替：菜单一移动编码就变，书签与 router.push({name}) 会断
@len 1..=50
@check is_code';

COMMENT ON COLUMN public.adm_menu.name IS '名称
同一应用内唯一（AK），展示用
@len 1..=50';

COMMENT ON COLUMN public.adm_menu.path IS '路径
内链存路由路径（以 / 开头）；外链与 iframe 存完整 URL
目录节点同样存自己的路由前缀，用于拼子节点路径
@len 1..=100';

COMMENT ON COLUMN public.adm_menu.component IS '组件路径
内链菜单的前端组件相对路径；为空表示目录节点（不产出组件路由，只用于分组）
@len 0..=200';

COMMENT ON COLUMN public.adm_menu.link_type IS '链接类型
1-内链（默认，path 存路由路径，component 存组件路径）
2-外链（path 存完整 URL，component 为空）
3-内嵌 iframe（path 存完整 URL，component 为空）
@range 1..=3
link_type 为 2/3 时 path 存完整 URL，此时对 path 校验
@check is_url_http';

COMMENT ON COLUMN public.adm_menu.icon IS '图标
前端图标名（如 SettingOutlined），目录与菜单使用
@len 0..=50';

COMMENT ON COLUMN public.adm_menu.keep_alive IS '是否缓存
前端页面是否 keep-alive，列表页一般 true，详情/编辑页 false';

COMMENT ON COLUMN public.adm_menu.visible IS '是否显示
false 时不在导航中渲染，但路由仍然可访问（详情页、编辑页等隐藏页）
与 enabled 的区别：enabled=false 是整节点（含子节点）下架';

COMMENT ON COLUMN public.adm_menu.remark IS '备注
@len 0..=50';

COMMENT ON COLUMN public.adm_menu.enabled IS '是否启用
false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用';

COMMENT ON COLUMN public.adm_menu.creater_id IS '创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_menu.create_ms IS '创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

COMMENT ON COLUMN public.adm_menu.updater_id IS '最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_menu.update_ms IS '最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

CREATE TABLE public.adm_menu_perm (
    id bigint NOT NULL,
    menu_id bigint NOT NULL,
    perm_id bigint NOT NULL,
    creater_id bigint NOT NULL,
    create_ms bigint NOT NULL,
    updater_id bigint NOT NULL,
    update_ms bigint NOT NULL
);

COMMENT ON TABLE public.adm_menu_perm IS '菜单权限
菜单与权限点的多对多关联，前端据此计算每个页面上的按钮权限（meta.perms）';

COMMENT ON COLUMN public.adm_menu_perm.id IS '主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

COMMENT ON COLUMN public.adm_menu_perm.menu_id IS '菜单 ID
关联 menu；(menu_id, perm_id) 唯一（AK）';

COMMENT ON COLUMN public.adm_menu_perm.perm_id IS '权限 ID
关联 perm；(menu_id, perm_id) 唯一（AK）';

COMMENT ON COLUMN public.adm_menu_perm.creater_id IS '创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_menu_perm.create_ms IS '创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

COMMENT ON COLUMN public.adm_menu_perm.updater_id IS '最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_menu_perm.update_ms IS '最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

CREATE TABLE public.adm_op_log (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    op_type_code character varying(50) NOT NULL,
    op_title character varying(50) NOT NULL,
    op_urn character varying(100) NOT NULL,
    remark character varying(50),
    creater_id bigint NOT NULL,
    create_ms bigint NOT NULL,
    updater_id bigint NOT NULL,
    update_ms bigint NOT NULL
);

COMMENT ON TABLE public.adm_op_log IS '操作日志
记录谁在什么时候对哪个接口做了什么；只增不改，用户删除受限以保证可追溯';

COMMENT ON COLUMN public.adm_op_log.id IS '主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

COMMENT ON COLUMN public.adm_op_log.user_id IS '操作用户 ID
关联 user；日志表要求可追溯，所以用户删除受限（restrict）';

COMMENT ON COLUMN public.adm_op_log.op_type_code IS '操作类型编码
关联 op_type.code（存编码不是 ID）
@len 1..=50
@check is_code';

COMMENT ON COLUMN public.adm_op_log.op_title IS '操作标题
列表展示用，如「新增用户」「导出报表」
@len 1..=50';

COMMENT ON COLUMN public.adm_op_log.op_urn IS '操作 URN
被调用接口的 URN，格式同 perm.urn（METHOD:路径），如 GET:/api/v1/users
与 perm.urn 同宽 100：两者是同一套标识，长度不一致会在审计里出现被截断的地址
@len 1..=100';

COMMENT ON COLUMN public.adm_op_log.remark IS '备注
@len 0..=50';

COMMENT ON COLUMN public.adm_op_log.creater_id IS '创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_op_log.create_ms IS '创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

COMMENT ON COLUMN public.adm_op_log.updater_id IS '最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_op_log.update_ms IS '最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

CREATE TABLE public.adm_op_type (
    id bigint NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(50) NOT NULL,
    sort_order integer NOT NULL,
    remark character varying(50),
    creater_id bigint NOT NULL,
    create_ms bigint NOT NULL,
    updater_id bigint NOT NULL,
    update_ms bigint NOT NULL
);

COMMENT ON TABLE public.adm_op_type IS '操作类型
初始有查看(Read)、 添加(Create)、修改(Update)、删除(Delete)、登录(Login)、登出(Logout)、导入(Import)、导出(Export)
、上传(Upload)、下载(Download)、审核(Audit)、授权(Assign)、打印(Print)这些类型';

COMMENT ON COLUMN public.adm_op_type.id IS '主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

COMMENT ON COLUMN public.adm_op_type.code IS '编码
业务编号，允许字母、数字与 _ . -（如 SYS_ADMIN、GROUP_HQ）
@len 1..=50
@check is_code';

COMMENT ON COLUMN public.adm_op_type.name IS '名称
全局唯一（AK）
@len 1..=50';

COMMENT ON COLUMN public.adm_op_type.sort_order IS '排序值
越小越靠前
@range 0..=9999';

COMMENT ON COLUMN public.adm_op_type.remark IS '备注
@len 0..=50';

COMMENT ON COLUMN public.adm_op_type.creater_id IS '创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_op_type.create_ms IS '创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

COMMENT ON COLUMN public.adm_op_type.updater_id IS '最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_op_type.update_ms IS '最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

CREATE TABLE public.adm_option (
    id bigint NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(50) NOT NULL,
    value text NOT NULL,
    remark character varying(50),
    creater_id bigint NOT NULL,
    create_ms bigint NOT NULL,
    updater_id bigint NOT NULL,
    update_ms bigint NOT NULL
);

COMMENT ON TABLE public.adm_option IS '选项（字典）
一组选项用同一个 code 归集（如 user_status），每个可选值一行';

COMMENT ON COLUMN public.adm_option.id IS '主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

COMMENT ON COLUMN public.adm_option.code IS '编码
一组选项共用一个 code（如 user_status），全局唯一（AK）
@len 1..=50
@check is_code';

COMMENT ON COLUMN public.adm_option.name IS '名称
展示文案
@len 1..=50';

COMMENT ON COLUMN public.adm_option.value IS '选项值
业务侧落库与判断时使用的值（字符串形式，如 "1"、"true"）；含义由所属 code 的约定决定';

COMMENT ON COLUMN public.adm_option.remark IS '备注
@len 0..=50';

COMMENT ON COLUMN public.adm_option.creater_id IS '创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_option.create_ms IS '创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

COMMENT ON COLUMN public.adm_option.updater_id IS '最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_option.update_ms IS '最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

CREATE TABLE public.adm_org (
    id bigint NOT NULL,
    code character varying(50),
    tree_code character varying(30) NOT NULL,
    name character varying(50) NOT NULL,
    full_name character varying(200),
    org_type_id bigint,
    remark character varying(50),
    enabled boolean DEFAULT true NOT NULL,
    creater_id bigint NOT NULL,
    create_ms bigint NOT NULL,
    updater_id bigint NOT NULL,
    update_ms bigint NOT NULL
);

COMMENT ON TABLE public.adm_org IS '组织
树形结构由 tree_code 表达；与领域、用户都是多对多（realm_org / org_user），组织本身不自带领域列';

COMMENT ON COLUMN public.adm_org.id IS '主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

COMMENT ON COLUMN public.adm_org.code IS '组织编码
全局唯一（AK），业务上用于对接外部系统
@len 1..=50
@check is_code';

COMMENT ON COLUMN public.adm_org.tree_code IS '树编码
路径枚举存树：字典序即树的前序，子节点紧跟在父节点之后，排序直接用 ORDER BY tree_code，不需要额外排序列
每层固定 3 位数字（不足左补 0），不加分隔符：001 → 001002 → 001002003
总长 = 层数 × 3（必须是 3 的倍数）；列宽 30 即最多 10 层，每层最多 999 个兄弟
中间插入按 010、020、030 递增留空位；调整顺序 = 改编码，会级联该节点整棵子树
@len 3..=30
@check is_tree_code';

COMMENT ON COLUMN public.adm_org.name IS '名称
同一父节点下的兄弟名称不做唯一约束（同名部门很常见），只靠 tree_code 区分
@len 1..=50';

COMMENT ON COLUMN public.adm_org.full_name IS '全名
从根到当前节点的名称拼接，层间用 "." 分隔（如 集团.分厂.车间）
全局唯一（AK）；由 tree_code 维护时同步生成，只用于展示与模糊搜索
@len 0..=200';

COMMENT ON COLUMN public.adm_org.org_type_id IS '组织类型 ID
关联 org_type；为空表示未分类';

COMMENT ON COLUMN public.adm_org.remark IS '备注
@len 0..=50';

COMMENT ON COLUMN public.adm_org.enabled IS '是否启用
false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用';

COMMENT ON COLUMN public.adm_org.creater_id IS '创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_org.create_ms IS '创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

COMMENT ON COLUMN public.adm_org.updater_id IS '最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_org.update_ms IS '最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

CREATE TABLE public.adm_org_type (
    id bigint NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(50) NOT NULL,
    sort_order integer NOT NULL,
    remark character varying(50),
    enabled boolean DEFAULT true NOT NULL,
    creater_id bigint NOT NULL,
    create_ms bigint NOT NULL,
    updater_id bigint NOT NULL,
    update_ms bigint NOT NULL
);

COMMENT ON TABLE public.adm_org_type IS '组织类型
有GROUP(集团)、UNIT(政府单位)、CORP(公司)、MILITARY(军)、DEPT(部门)、BRANCH_FACTORY(分厂)、DIRECTLY_BRIGADE(直属旅)、BRIGADE(旅)、TEAM(小组)、CLASSES(班级)等';

COMMENT ON COLUMN public.adm_org_type.id IS '主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

COMMENT ON COLUMN public.adm_org_type.code IS '编码
业务编号，允许字母、数字与 _ . -（如 SYS_ADMIN、GROUP_HQ）
@len 1..=50
@check is_code';

COMMENT ON COLUMN public.adm_org_type.name IS '名称
全局唯一（AK）
@len 1..=50';

COMMENT ON COLUMN public.adm_org_type.sort_order IS '排序值
越小越靠前
@range 0..=9999';

COMMENT ON COLUMN public.adm_org_type.remark IS '备注
@len 0..=50';

COMMENT ON COLUMN public.adm_org_type.enabled IS '是否启用
false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用';

COMMENT ON COLUMN public.adm_org_type.creater_id IS '创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_org_type.create_ms IS '创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

COMMENT ON COLUMN public.adm_org_type.updater_id IS '最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_org_type.update_ms IS '最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

CREATE TABLE public.adm_org_user (
    id bigint NOT NULL,
    org_id bigint NOT NULL,
    user_id bigint NOT NULL,
    creater_id bigint NOT NULL,
    create_ms bigint NOT NULL,
    updater_id bigint NOT NULL,
    update_ms bigint NOT NULL
);

COMMENT ON TABLE public.adm_org_user IS '组织用户
组织与用户的多对多关系，一个人在多个组织任职时有多行';

COMMENT ON COLUMN public.adm_org_user.id IS '主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

COMMENT ON COLUMN public.adm_org_user.org_id IS '组织 ID
关联 org；(org_id, user_id) 唯一（AK）';

COMMENT ON COLUMN public.adm_org_user.user_id IS '用户 ID
关联 user；(org_id, user_id) 唯一（AK）';

COMMENT ON COLUMN public.adm_org_user.creater_id IS '创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_org_user.create_ms IS '创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

COMMENT ON COLUMN public.adm_org_user.updater_id IS '最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_org_user.update_ms IS '最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

CREATE TABLE public.adm_perm (
    id bigint NOT NULL,
    group_id bigint NOT NULL,
    op_type_code character varying(50) NOT NULL,
    name character varying(50) NOT NULL,
    urn character varying(100) NOT NULL,
    sort_order integer NOT NULL,
    remark character varying(50),
    enabled boolean DEFAULT true NOT NULL,
    creater_id bigint NOT NULL,
    create_ms bigint NOT NULL,
    updater_id bigint NOT NULL,
    update_ms bigint NOT NULL,
    CONSTRAINT ck_adm_perm_op_type CHECK (((op_type_code)::text = ANY ((ARRAY['query'::character varying, 'add'::character varying, 'modify'::character varying, 'del'::character varying, 'reorder'::character varying, 'sync'::character varying, 'reset_password'::character varying])::text[])))
);

COMMENT ON TABLE public.adm_perm IS '权限
最小授权单元，用 URN 表达「HTTP 方法 + 资源路径」；与角色的关联见 role_perm，与菜单的关联见 menu_perm';

COMMENT ON COLUMN public.adm_perm.id IS '主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

COMMENT ON COLUMN public.adm_perm.group_id IS '权限分组 ID
关联 perm_group；(group_id, name) 唯一，不同分组可以重名';

COMMENT ON COLUMN public.adm_perm.op_type_code IS '操作类型编码
关联 op_type.code（存编码不是 ID）；为空表示该权限与操作类型无关（如整页访问）
@len 1..=50
@check is_code';

COMMENT ON COLUMN public.adm_perm.name IS '名称
同一分组内唯一（AK）
@len 1..=50';

COMMENT ON COLUMN public.adm_perm.urn IS 'URN
格式 METHOD:路径，如 GET:/api/v1/users；全局唯一（AK）
鉴权时按前缀匹配，写错一个字符就是永不命中，创建后不要改
@len 1..=100';

COMMENT ON COLUMN public.adm_perm.sort_order IS '排序值
同一分组内排序，越小越靠前
@range 0..=9999';

COMMENT ON COLUMN public.adm_perm.remark IS '备注
@len 0..=50';

COMMENT ON COLUMN public.adm_perm.enabled IS '是否启用
false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用';

COMMENT ON COLUMN public.adm_perm.creater_id IS '创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_perm.create_ms IS '创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

COMMENT ON COLUMN public.adm_perm.updater_id IS '最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_perm.update_ms IS '最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

CREATE TABLE public.adm_perm_group (
    id bigint NOT NULL,
    tree_code character varying(30) NOT NULL,
    name character varying(50) NOT NULL,
    remark character varying(50),
    enabled boolean DEFAULT true NOT NULL,
    creater_id bigint NOT NULL,
    create_ms bigint NOT NULL,
    updater_id bigint NOT NULL,
    update_ms bigint NOT NULL
);

COMMENT ON TABLE public.adm_perm_group IS '权限分组
全局两级结构（分组 → 权限），树形由 tree_code 表达，tree_code 全局唯一';

COMMENT ON COLUMN public.adm_perm_group.id IS '主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

COMMENT ON COLUMN public.adm_perm_group.tree_code IS '树编码
路径枚举存树：字典序即树的前序，子节点紧跟在父节点之后，排序直接用 ORDER BY tree_code，不需要额外排序列
每层固定 3 位数字（不足左补 0），不加分隔符：001 → 001002 → 001002003
总长 = 层数 × 3（必须是 3 的倍数）；列宽 30 即最多 10 层，每层最多 999 个兄弟
中间插入按 010、020、030 递增留空位；调整顺序 = 改编码，会级联该节点整棵子树
@len 3..=30
@check is_tree_code';

COMMENT ON COLUMN public.adm_perm_group.name IS '名称
同一父节点下的兄弟名称不做唯一约束，靠 tree_code 区分
@len 1..=50';

COMMENT ON COLUMN public.adm_perm_group.remark IS '备注
@len 0..=50';

COMMENT ON COLUMN public.adm_perm_group.enabled IS '是否启用
false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用';

COMMENT ON COLUMN public.adm_perm_group.creater_id IS '创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_perm_group.create_ms IS '创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

COMMENT ON COLUMN public.adm_perm_group.updater_id IS '最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_perm_group.update_ms IS '最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

CREATE TABLE public.adm_person (
    id bigint NOT NULL,
    code_type_id bigint,
    code character varying(50),
    name character varying(200) NOT NULL,
    name_pinyin_abbr character varying(200),
    name_pinyin_full character varying(200),
    mobile character varying(50),
    email character varying(50),
    id_card character varying(20),
    remark character varying(50),
    enabled boolean DEFAULT true NOT NULL,
    creater_id bigint NOT NULL,
    create_ms bigint NOT NULL,
    updater_id bigint NOT NULL,
    update_ms bigint NOT NULL
);

COMMENT ON TABLE public.adm_person IS '人员（自然人）
回答「这个人是谁」：真实姓名、拼音、身份证、联系方式，是身份主数据
不记实名核验状态：核验位在 user.real_name_verified 上，一个自然人多个账号时各自独立
一个自然人可以有零个或多个账号，账号侧通过 user.person_id 回指';

COMMENT ON COLUMN public.adm_person.id IS '主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

COMMENT ON COLUMN public.adm_person.code_type_id IS '人员编码类型 ID
关联 person_code_type；为空表示该人员没有工号/学号';

COMMENT ON COLUMN public.adm_person.code IS '编码
工号、学号等业务编号，含义由 code_type_id 决定
(code_type_id, code) 唯一（AK）
@len 1..=50
@check is_code';

COMMENT ON COLUMN public.adm_person.name IS '姓名
人员的真实姓名；长度 200 是为了容纳少数民族长姓名（多个间隔号拼接）
@len 1..=200';

COMMENT ON COLUMN public.adm_person.name_pinyin_abbr IS '姓名拼音首字母
大写、无分隔（张三 → ZS），用于快速检索
@len 0..=200';

COMMENT ON COLUMN public.adm_person.name_pinyin_full IS '姓名拼音全拼
小写、音节间无分隔（张三 → zhangsan），用于快速检索
@len 0..=200';

COMMENT ON COLUMN public.adm_person.mobile IS '手机号（档案联系方式）
人员档案上的号码，可与账号登录手机号不同；不做唯一约束
@check is_mobile_cn';

COMMENT ON COLUMN public.adm_person.email IS '邮箱（档案联系方式）
全局唯一（AK）：一个邮箱只对应一个人员档案
@len 0..=50
@check is_email';

COMMENT ON COLUMN public.adm_person.id_card IS '身份证号
全局唯一（AK）：同一自然人只应有一条有效档案
18 位，末位可为 X
@len 18..=18
@check is_id_card_cn';

COMMENT ON COLUMN public.adm_person.remark IS '备注
@len 0..=50';

COMMENT ON COLUMN public.adm_person.enabled IS '是否启用
false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用';

COMMENT ON COLUMN public.adm_person.creater_id IS '创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_person.create_ms IS '创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

COMMENT ON COLUMN public.adm_person.updater_id IS '最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_person.update_ms IS '最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

CREATE TABLE public.adm_person_code_type (
    id bigint NOT NULL,
    name character varying(50) NOT NULL,
    sort_order integer NOT NULL,
    remark character varying(50),
    enabled boolean DEFAULT true NOT NULL,
    creater_id bigint NOT NULL,
    create_ms bigint NOT NULL,
    updater_id bigint NOT NULL,
    update_ms bigint NOT NULL
);

COMMENT ON TABLE public.adm_person_code_type IS '人员编码类型
有工号、学号等';

COMMENT ON COLUMN public.adm_person_code_type.id IS '主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

COMMENT ON COLUMN public.adm_person_code_type.name IS '名称
全局唯一（AK），如「工号」「学号」
@len 1..=50';

COMMENT ON COLUMN public.adm_person_code_type.sort_order IS '排序值
越小越靠前
@range 0..=9999';

COMMENT ON COLUMN public.adm_person_code_type.remark IS '备注
@len 0..=50';

COMMENT ON COLUMN public.adm_person_code_type.enabled IS '是否启用
false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用';

COMMENT ON COLUMN public.adm_person_code_type.creater_id IS '创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_person_code_type.create_ms IS '创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

COMMENT ON COLUMN public.adm_person_code_type.updater_id IS '最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_person_code_type.update_ms IS '最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

CREATE TABLE public.adm_realm (
    id bigint NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(50) NOT NULL,
    sort_order integer NOT NULL,
    remark character varying(50),
    enabled boolean DEFAULT true NOT NULL,
    creater_id bigint NOT NULL,
    create_ms bigint NOT NULL,
    updater_id bigint NOT NULL,
    update_ms bigint NOT NULL
);

COMMENT ON TABLE public.adm_realm IS '领域
用户与组织的数据域划分单位：只用于界定用户/组织归属与角色的数据可见范围，与应用、菜单、角色、权限等全局配置无关
一个组织/用户可以归属多个领域，关联见 realm_org / realm_user；角色的可见范围见 adm_role_realm_scope / adm_role_org_scope / adm_role_app_scope';

COMMENT ON COLUMN public.adm_realm.id IS '主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

COMMENT ON COLUMN public.adm_realm.code IS '编码
全局唯一（AK），创建后不改：数据域与迁移脚本都按它定位领域
@len 1..=50
@check is_code';

COMMENT ON COLUMN public.adm_realm.name IS '名称
全局唯一（AK），展示用
@len 1..=50';

COMMENT ON COLUMN public.adm_realm.sort_order IS '排序值
越小越靠前，列表按 (sort_order, id) 升序
@range 0..=9999';

COMMENT ON COLUMN public.adm_realm.remark IS '备注
@len 0..=50';

COMMENT ON COLUMN public.adm_realm.enabled IS '是否启用
false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用';

COMMENT ON COLUMN public.adm_realm.creater_id IS '创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_realm.create_ms IS '创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

COMMENT ON COLUMN public.adm_realm.updater_id IS '最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_realm.update_ms IS '最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

CREATE TABLE public.adm_realm_org (
    id bigint NOT NULL,
    realm_id bigint NOT NULL,
    org_id bigint NOT NULL,
    creater_id bigint NOT NULL,
    create_ms bigint NOT NULL,
    updater_id bigint NOT NULL,
    update_ms bigint NOT NULL
);

COMMENT ON TABLE public.adm_realm_org IS '领域组织
领域与组织的多对多归属，一个组织可服务于多个领域';

COMMENT ON COLUMN public.adm_realm_org.id IS '主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

COMMENT ON COLUMN public.adm_realm_org.realm_id IS '领域 ID
关联 realm；(realm_id, org_id) 唯一（AK）';

COMMENT ON COLUMN public.adm_realm_org.org_id IS '组织 ID
关联 org；(realm_id, org_id) 唯一（AK）';

COMMENT ON COLUMN public.adm_realm_org.creater_id IS '创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_realm_org.create_ms IS '创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

COMMENT ON COLUMN public.adm_realm_org.updater_id IS '最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_realm_org.update_ms IS '最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

CREATE TABLE public.adm_realm_user (
    id bigint NOT NULL,
    realm_id bigint NOT NULL,
    user_id bigint NOT NULL,
    creater_id bigint NOT NULL,
    create_ms bigint NOT NULL,
    updater_id bigint NOT NULL,
    update_ms bigint NOT NULL
);

COMMENT ON TABLE public.adm_realm_user IS '领域用户
领域与用户的多对多归属，决定该账号能进入哪些领域';

COMMENT ON COLUMN public.adm_realm_user.id IS '主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

COMMENT ON COLUMN public.adm_realm_user.realm_id IS '领域 ID
关联 realm；(realm_id, user_id) 唯一（AK）';

COMMENT ON COLUMN public.adm_realm_user.user_id IS '用户 ID
关联 user；(realm_id, user_id) 唯一（AK）';

COMMENT ON COLUMN public.adm_realm_user.creater_id IS '创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_realm_user.create_ms IS '创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

COMMENT ON COLUMN public.adm_realm_user.updater_id IS '最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_realm_user.update_ms IS '最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

CREATE TABLE public.adm_role (
    id bigint NOT NULL,
    group_id bigint NOT NULL,
    name character varying(50) NOT NULL,
    sort_order integer NOT NULL,
    remark character varying(50),
    enabled boolean DEFAULT true NOT NULL,
    creater_id bigint NOT NULL,
    create_ms bigint NOT NULL,
    updater_id bigint NOT NULL,
    update_ms bigint NOT NULL
);

COMMENT ON TABLE public.adm_role IS '角色
权限的集合，按分组管理；角色与用户的关联见 role_user，与权限的关联见 role_perm';

COMMENT ON COLUMN public.adm_role.id IS '主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

COMMENT ON COLUMN public.adm_role.group_id IS '角色分组 ID
关联 role_group；(group_id, name) 唯一，不同分组可以重名';

COMMENT ON COLUMN public.adm_role.name IS '名称
同一分组内唯一（AK）
@len 1..=50';

COMMENT ON COLUMN public.adm_role.sort_order IS '排序值
同一分组内排序，越小越靠前
@range 0..=9999';

COMMENT ON COLUMN public.adm_role.remark IS '备注
@len 0..=50';

COMMENT ON COLUMN public.adm_role.enabled IS '是否启用
false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用';

COMMENT ON COLUMN public.adm_role.creater_id IS '创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_role.create_ms IS '创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

COMMENT ON COLUMN public.adm_role.updater_id IS '最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_role.update_ms IS '最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

CREATE TABLE public.adm_role_app_scope (
    id bigint NOT NULL,
    role_id bigint NOT NULL,
    app_id bigint NOT NULL,
    creater_id bigint DEFAULT 0 NOT NULL,
    create_ms bigint DEFAULT 0 NOT NULL,
    updater_id bigint DEFAULT 0 NOT NULL,
    update_ms bigint DEFAULT 0 NOT NULL
);

CREATE TABLE public.adm_role_group (
    id bigint NOT NULL,
    tree_code character varying(30) NOT NULL,
    name character varying(50) NOT NULL,
    remark character varying(50),
    enabled boolean DEFAULT true NOT NULL,
    creater_id bigint NOT NULL,
    create_ms bigint NOT NULL,
    updater_id bigint NOT NULL,
    update_ms bigint NOT NULL
);

COMMENT ON TABLE public.adm_role_group IS '角色分组
全局两级结构（分组 → 角色），树形由 tree_code 表达，tree_code 全局唯一';

COMMENT ON COLUMN public.adm_role_group.id IS '主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

COMMENT ON COLUMN public.adm_role_group.tree_code IS '树编码
路径枚举存树：字典序即树的前序，子节点紧跟在父节点之后，排序直接用 ORDER BY tree_code，不需要额外排序列
每层固定 3 位数字（不足左补 0），不加分隔符：001 → 001002 → 001002003
总长 = 层数 × 3（必须是 3 的倍数）；列宽 30 即最多 10 层，每层最多 999 个兄弟
中间插入按 010、020、030 递增留空位；调整顺序 = 改编码，会级联该节点整棵子树
@len 3..=30
@check is_tree_code';

COMMENT ON COLUMN public.adm_role_group.name IS '名称
同一父节点下的兄弟名称不做唯一约束，靠 tree_code 区分
@len 1..=50';

COMMENT ON COLUMN public.adm_role_group.remark IS '备注
@len 0..=50';

COMMENT ON COLUMN public.adm_role_group.enabled IS '是否启用
false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用';

COMMENT ON COLUMN public.adm_role_group.creater_id IS '创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_role_group.create_ms IS '创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

COMMENT ON COLUMN public.adm_role_group.updater_id IS '最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_role_group.update_ms IS '最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

CREATE TABLE public.adm_role_menu (
    id bigint NOT NULL,
    menu_id bigint NOT NULL,
    role_id bigint NOT NULL,
    creater_id bigint NOT NULL,
    create_ms bigint NOT NULL,
    updater_id bigint NOT NULL,
    update_ms bigint NOT NULL
);

COMMENT ON TABLE public.adm_role_menu IS '角色菜单
角色与菜单的多对多关联，决定该角色登录后能看到哪些菜单';

COMMENT ON COLUMN public.adm_role_menu.id IS '主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

COMMENT ON COLUMN public.adm_role_menu.menu_id IS '菜单 ID
关联 menu；(menu_id, role_id) 唯一（AK）';

COMMENT ON COLUMN public.adm_role_menu.role_id IS '角色 ID
关联 role；(menu_id, role_id) 唯一（AK）';

COMMENT ON COLUMN public.adm_role_menu.creater_id IS '创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_role_menu.create_ms IS '创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

COMMENT ON COLUMN public.adm_role_menu.updater_id IS '最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_role_menu.update_ms IS '最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

CREATE TABLE public.adm_role_org_scope (
    id bigint NOT NULL,
    role_id bigint NOT NULL,
    org_id bigint NOT NULL,
    creater_id bigint DEFAULT 0 NOT NULL,
    create_ms bigint DEFAULT 0 NOT NULL,
    updater_id bigint DEFAULT 0 NOT NULL,
    update_ms bigint DEFAULT 0 NOT NULL
);

CREATE TABLE public.adm_role_perm (
    id bigint NOT NULL,
    role_id bigint NOT NULL,
    perm_id bigint NOT NULL,
    creater_id bigint NOT NULL,
    create_ms bigint NOT NULL,
    updater_id bigint NOT NULL,
    update_ms bigint NOT NULL
);

COMMENT ON TABLE public.adm_role_perm IS '角色权限
角色与权限的多对多授权关系，鉴权时按 user → role_user → role_perm → perm.urn 展开';

COMMENT ON COLUMN public.adm_role_perm.id IS '主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

COMMENT ON COLUMN public.adm_role_perm.role_id IS '角色 ID
关联 role；(role_id, perm_id) 唯一（AK）';

COMMENT ON COLUMN public.adm_role_perm.perm_id IS '权限 ID
关联 perm；(role_id, perm_id) 唯一（AK）';

COMMENT ON COLUMN public.adm_role_perm.creater_id IS '创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_role_perm.create_ms IS '创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

COMMENT ON COLUMN public.adm_role_perm.updater_id IS '最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_role_perm.update_ms IS '最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

CREATE TABLE public.adm_role_realm_scope (
    id bigint NOT NULL,
    role_id bigint NOT NULL,
    realm_id bigint NOT NULL,
    creater_id bigint DEFAULT 0 NOT NULL,
    create_ms bigint DEFAULT 0 NOT NULL,
    updater_id bigint DEFAULT 0 NOT NULL,
    update_ms bigint DEFAULT 0 NOT NULL
);

CREATE TABLE public.adm_role_user (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    role_id bigint NOT NULL,
    creater_id bigint NOT NULL,
    create_ms bigint NOT NULL,
    updater_id bigint NOT NULL,
    update_ms bigint NOT NULL
);

COMMENT ON TABLE public.adm_role_user IS '角色用户
角色与用户的多对多授权关系';

COMMENT ON COLUMN public.adm_role_user.id IS '主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

COMMENT ON COLUMN public.adm_role_user.user_id IS '用户 ID
关联 user；(user_id, role_id) 唯一（AK）';

COMMENT ON COLUMN public.adm_role_user.role_id IS '角色 ID
关联 role；(user_id, role_id) 唯一（AK）';

COMMENT ON COLUMN public.adm_role_user.creater_id IS '创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_role_user.create_ms IS '创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

COMMENT ON COLUMN public.adm_role_user.updater_id IS '最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_role_user.update_ms IS '最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

CREATE TABLE public.adm_user (
    id bigint NOT NULL,
    person_id bigint,
    name character varying(50) NOT NULL,
    nick_name character varying(50),
    mobile character varying(20),
    mobile_verified boolean DEFAULT false NOT NULL,
    email character varying(50),
    email_verified boolean DEFAULT false NOT NULL,
    id_card character varying(20),
    real_name character varying(200),
    real_name_verified boolean DEFAULT false NOT NULL,
    login_pswd character varying(64) NOT NULL,
    login_pswd_salt character(6) NOT NULL,
    login_pswd_default boolean DEFAULT false NOT NULL,
    audit_pswd character varying(64) NOT NULL,
    audit_pswd_salt character(6) NOT NULL,
    pay_pswd character varying(64) NOT NULL,
    pay_pswd_salt character(6) NOT NULL,
    expire_ms bigint,
    status smallint DEFAULT 1 NOT NULL,
    fail_count smallint DEFAULT 0 NOT NULL,
    lock_until_ms bigint,
    last_login_ms bigint,
    remark character varying(50),
    enabled boolean DEFAULT true NOT NULL,
    creater_id bigint NOT NULL,
    create_ms bigint NOT NULL,
    updater_id bigint NOT NULL,
    update_ms bigint NOT NULL,
    CONSTRAINT ck_adm_user_real_name_paired CHECK (((real_name IS NULL) = (id_card IS NULL)))
);

COMMENT ON TABLE public.adm_user IS '用户（账号）
回答「哪个标识能登进哪个账号」：登录名、登录用手机/邮箱、实名信息（姓名 + 身份证）、三套密码、状态
实名信息与核验位放在本表：登录时的实名校验以账号为单位，person 只存人员档案、不记核验状态';

COMMENT ON COLUMN public.adm_user.id IS '主键
代理键，由框架生成（雪花 ID），业务层不需要关心取值';

COMMENT ON COLUMN public.adm_user.person_id IS '人员 ID
关联 person，一个自然人可挂多个账号
为空表示纯账号（外部认证、系统账号、机器人），不关联人员档案';

COMMENT ON COLUMN public.adm_user.name IS '登录名
登录时输入的唯一标识，全局唯一（AK）；手机号另有唯一约束（见 mobile），邮箱没有
4~32 位，字母开头，只含字母、数字、下划线
@len 4..=32
@check is_account_name';

COMMENT ON COLUMN public.adm_user.nick_name IS '昵称
展示用，允许重复，不做唯一约束
@len 0..=50';

COMMENT ON COLUMN public.adm_user.mobile IS '手机号（登录用）
全局唯一（AK）：一个手机号只能定位一个账号
与 person.mobile 的语义不同，后者是人员档案上的联系方式
入库前请去掉 +86 与分隔符
@len 11..=11
@check is_mobile_cn';

COMMENT ON COLUMN public.adm_user.mobile_verified IS '手机号是否已验证
true 表示该手机号通过短信验证码校验；注册后未验证也能登录，但改密/支付等敏感操作要求已验
未验证记 false，不用 NULL：三态的「不知道是否验证过」没有业务含义';

COMMENT ON COLUMN public.adm_user.email IS '邮箱（登录用）
全局唯一（AK）：一个邮箱只能定位到一个账号，可用于邮箱登录与找回密码
与 person.email 的语义不同，后者是人员档案上的联系方式，两者各自唯一、互不覆盖
@len 0..=50
@check is_email';

COMMENT ON COLUMN public.adm_user.email_verified IS '邮箱是否已验证
true 表示该邮箱通过验证链接校验，可用于找回密码与接收通知
未验证记 false，不用 NULL：三态没有业务含义';

COMMENT ON COLUMN public.adm_user.id_card IS '身份证号（登录实名用）
可空：手机号注册的账号可以先不填；一经填写就全局唯一（AK），一个身份证只能绑一个账号
空值不参与唯一去重（PostgreSQL 的 AK 不约束 NULL），所以「未实名的账号」不会互相冲突
人员档案上的同一份数据见 person.id_card，由实名核验流程保证一致
18 位，末位可为 X
@len 18..=18
@check is_id_card_cn';

COMMENT ON COLUMN public.adm_user.real_name IS '真实姓名（登录实名用）
可空：与 id_card 配对，未实名的账号两列都为空；填了一列就必须填另一列
与 person.name 是同一份事实的两处记录，实名核验流程在一个事务里同时写两处，不要只写一边
长度 200 与 person.name 对齐，容纳少数民族长姓名；不挂 is_chinese_name：外籍与少数民族姓名允许非汉字
@len 1..=200';

COMMENT ON COLUMN public.adm_user.real_name_verified IS '是否已验证实名
true 表示姓名（real_name）与身份证号（id_card）这一组已通过实名核验
核验对象是两列的组合，单独一列没有意义：real_name / id_card 未填时本列只能为 false
登录时若要求「实名后才能操作」，判这一列';

COMMENT ON COLUMN public.adm_user.login_pswd IS '登录密码
(小写(SM3(小写(SM3(密码明文))+小写(密码组合码))))
固定 64 位小写十六进制（SM3 输出 32 字节）
注意：
1. 计算方法中的密码在前端传过来时推荐先进行 sm3 序列化，以避免在密码传递过程中使用明码被截获
2. 密码组合码在生成密码时随机生成并保存下来，和密码组合起来使用，增加破解的难度
@len 64..=64';

COMMENT ON COLUMN public.adm_user.login_pswd_salt IS '登录密码组合码
与密码组合加密用，详见登录密码备注
6 位随机串
@len 6..=6';

COMMENT ON COLUMN public.adm_user.login_pswd_default IS '登录密码是否默认密码
true 表示仍是初始密码，前端应强制修改后才能继续操作';

COMMENT ON COLUMN public.adm_user.audit_pswd IS '审核密码
(小写(SM3(小写(SM3(密码明文))+小写(密码组合码))))
固定 64 位小写十六进制（SM3 输出 32 字节）
@len 64..=64';

COMMENT ON COLUMN public.adm_user.audit_pswd_salt IS '审核密码组合码
与密码组合加密用，详见审核密码备注
6 位随机串
@len 6..=6';

COMMENT ON COLUMN public.adm_user.pay_pswd IS '支付密码
(小写(SM3(小写(SM3(密码明文))+小写(密码组合码))))
固定 64 位小写十六进制（SM3 输出 32 字节）
@len 64..=64';

COMMENT ON COLUMN public.adm_user.pay_pswd_salt IS '支付密码组合码
与密码组合加密用，详见支付密码备注
6 位随机串
@len 6..=6';

COMMENT ON COLUMN public.adm_user.expire_ms IS '过期时间戳
账户到期时间；定时任务扫描到已过期时把 enabled 置 false
与 status 的区别：status 是人工停用与锁定判定，expire_ms 是到期自动停用
@unit ms';

COMMENT ON COLUMN public.adm_user.status IS '状态
1-正常
2-已停用
3-已锁定
与 enabled 的关系：enabled=false 时账号整体不可登录，status 用于展示与锁定判定
@range 1..=3';

COMMENT ON COLUMN public.adm_user.fail_count IS '登录失败次数
登录成功后清零；达到阈值时把 status 置 3 并写入 lock_until_ms
@range 0..=100';

COMMENT ON COLUMN public.adm_user.lock_until_ms IS '锁定到期时间戳
为空或已过期表示未锁定；解锁时置空并把 status 恢复为 1
@unit ms';

COMMENT ON COLUMN public.adm_user.last_login_ms IS '最近登录时间戳
只记录成功登录，失败尝试见 login_log
@unit ms';

COMMENT ON COLUMN public.adm_user.remark IS '备注
@len 0..=50';

COMMENT ON COLUMN public.adm_user.enabled IS '是否启用
false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用';

COMMENT ON COLUMN public.adm_user.creater_id IS '创建人 ID
由框架在 insert 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_user.create_ms IS '创建时间戳
由框架在 insert 时写入服务端时间，不接受调用方传入
@unit ms';

COMMENT ON COLUMN public.adm_user.updater_id IS '最后修改人 ID
由框架在 update 时写入当前操作者；无登录态的系统任务写 0';

COMMENT ON COLUMN public.adm_user.update_ms IS '最后修改时间戳
由框架在 update 时写入服务端时间；间隔/窗口类判断以此为准，不用事件时间
@unit ms';

CREATE TABLE public.adm_widget_endpoint (
    id bigint NOT NULL,
    service character varying(32) NOT NULL,
    endpoint character varying(64) NOT NULL,
    name character varying(64) NOT NULL,
    method character varying(8) DEFAULT 'POST'::character varying NOT NULL,
    params_hint character varying(255),
    enabled boolean DEFAULT true NOT NULL,
    note character varying(255),
    sort_order integer DEFAULT 0 NOT NULL,
    creater_id bigint DEFAULT 0 NOT NULL,
    create_ms bigint DEFAULT 0 NOT NULL,
    updater_id bigint DEFAULT 0 NOT NULL,
    update_ms bigint DEFAULT 0 NOT NULL
);

CREATE TABLE public.adm_widget_type (
    id bigint NOT NULL,
    code character varying(32) NOT NULL,
    name character varying(64) NOT NULL,
    default_service character varying(32) NOT NULL,
    default_endpoint character varying(64) NOT NULL,
    description character varying(255),
    default_params text,
    default_perm_urn character varying(128),
    default_scope_aware boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    creater_id bigint DEFAULT 0 NOT NULL,
    create_ms bigint DEFAULT 0 NOT NULL,
    updater_id bigint DEFAULT 0 NOT NULL,
    update_ms bigint DEFAULT 0 NOT NULL
);

ALTER TABLE ONLY public.adm_dashboard
    ADD CONSTRAINT adm_dashboard_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.adm_dashboard_widget
    ADD CONSTRAINT adm_dashboard_widget_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.adm_role_app_scope
    ADD CONSTRAINT adm_role_app_scope_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.adm_role_org_scope
    ADD CONSTRAINT adm_role_org_scope_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.adm_role_realm_scope
    ADD CONSTRAINT adm_role_realm_scope_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.adm_widget_type
    ADD CONSTRAINT adm_widget_type_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.adm_menu
    ADD CONSTRAINT ak_app_id_and_code_adm_menu UNIQUE (app_id, code);

ALTER TABLE ONLY public.adm_menu
    ADD CONSTRAINT ak_app_id_and_name_adm_menu UNIQUE (app_id, name);

ALTER TABLE ONLY public.adm_menu
    ADD CONSTRAINT ak_app_id_and_tree_code_adm_menu UNIQUE (app_id, tree_code);

ALTER TABLE ONLY public.adm_app
    ADD CONSTRAINT ak_code_adm_app UNIQUE (code);

ALTER TABLE ONLY public.adm_op_type
    ADD CONSTRAINT ak_code_adm_op_type UNIQUE (code);

ALTER TABLE ONLY public.adm_option
    ADD CONSTRAINT ak_code_adm_option UNIQUE (code);

ALTER TABLE ONLY public.adm_org
    ADD CONSTRAINT ak_code_adm_org UNIQUE (code);

ALTER TABLE ONLY public.adm_org_type
    ADD CONSTRAINT ak_code_adm_org_type UNIQUE (code);

ALTER TABLE ONLY public.adm_realm
    ADD CONSTRAINT ak_code_adm_realm UNIQUE (code);

ALTER TABLE ONLY public.adm_person
    ADD CONSTRAINT ak_code_type_id_and_code_adm_person UNIQUE (code_type_id, code);

ALTER TABLE ONLY public.adm_person
    ADD CONSTRAINT ak_email_adm_person UNIQUE (email);

ALTER TABLE ONLY public.adm_user
    ADD CONSTRAINT ak_email_adm_user UNIQUE (email);

ALTER TABLE ONLY public.adm_org
    ADD CONSTRAINT ak_full_name_adm_org UNIQUE (full_name);

ALTER TABLE ONLY public.adm_perm
    ADD CONSTRAINT ak_group_id_and_name_adm_perm UNIQUE (group_id, name);

ALTER TABLE ONLY public.adm_role
    ADD CONSTRAINT ak_group_id_and_name_adm_role UNIQUE (group_id, name);

ALTER TABLE ONLY public.adm_person
    ADD CONSTRAINT ak_id_card_adm_person UNIQUE (id_card);

ALTER TABLE ONLY public.adm_user
    ADD CONSTRAINT ak_id_card_adm_user UNIQUE (id_card);

ALTER TABLE ONLY public.adm_menu_perm
    ADD CONSTRAINT ak_menu_id_and_perm_id_adm_menu_perm UNIQUE (menu_id, perm_id);

ALTER TABLE ONLY public.adm_role_menu
    ADD CONSTRAINT ak_menu_id_and_role_id_adm_role_menu UNIQUE (menu_id, role_id);

ALTER TABLE ONLY public.adm_user
    ADD CONSTRAINT ak_mobile_adm_user UNIQUE (mobile);

ALTER TABLE ONLY public.adm_app
    ADD CONSTRAINT ak_name_adm_app UNIQUE (name);

ALTER TABLE ONLY public.adm_op_type
    ADD CONSTRAINT ak_name_adm_op_type UNIQUE (name);

ALTER TABLE ONLY public.adm_org_type
    ADD CONSTRAINT ak_name_adm_org_type UNIQUE (name);

ALTER TABLE ONLY public.adm_person_code_type
    ADD CONSTRAINT ak_name_adm_person_code_type UNIQUE (name);

ALTER TABLE ONLY public.adm_realm
    ADD CONSTRAINT ak_name_adm_realm UNIQUE (name);

ALTER TABLE ONLY public.adm_user
    ADD CONSTRAINT ak_name_adm_user UNIQUE (name);

ALTER TABLE ONLY public.adm_org_user
    ADD CONSTRAINT ak_org_id_and_user_id_adm_org_user UNIQUE (org_id, user_id);

ALTER TABLE ONLY public.adm_realm_org
    ADD CONSTRAINT ak_realm_id_and_org_id_adm_realm_org UNIQUE (realm_id, org_id);

ALTER TABLE ONLY public.adm_realm_user
    ADD CONSTRAINT ak_realm_id_and_user_id_adm_realm_user UNIQUE (realm_id, user_id);

ALTER TABLE ONLY public.adm_role_perm
    ADD CONSTRAINT ak_role_id_and_perm_id_adm_role_perm UNIQUE (role_id, perm_id);

ALTER TABLE ONLY public.adm_org
    ADD CONSTRAINT ak_tree_code_adm_org UNIQUE (tree_code);

ALTER TABLE ONLY public.adm_perm_group
    ADD CONSTRAINT ak_tree_code_adm_perm_group UNIQUE (tree_code);

ALTER TABLE ONLY public.adm_role_group
    ADD CONSTRAINT ak_tree_code_adm_role_group UNIQUE (tree_code);

ALTER TABLE ONLY public.adm_perm
    ADD CONSTRAINT ak_urn_adm_perm UNIQUE (urn);

ALTER TABLE ONLY public.adm_role_user
    ADD CONSTRAINT ak_user_id_and_role_id_adm_role_user UNIQUE (user_id, role_id);

ALTER TABLE ONLY public.adm_app
    ADD CONSTRAINT pk_adm_app PRIMARY KEY (id);

ALTER TABLE ONLY public.adm_lock_log
    ADD CONSTRAINT pk_adm_lock_log PRIMARY KEY (id);

ALTER TABLE ONLY public.adm_login_log
    ADD CONSTRAINT pk_adm_login_log PRIMARY KEY (id);

ALTER TABLE ONLY public.adm_menu
    ADD CONSTRAINT pk_adm_menu PRIMARY KEY (id);

ALTER TABLE ONLY public.adm_menu_perm
    ADD CONSTRAINT pk_adm_menu_perm PRIMARY KEY (id);

ALTER TABLE ONLY public.adm_op_log
    ADD CONSTRAINT pk_adm_op_log PRIMARY KEY (id);

ALTER TABLE ONLY public.adm_op_type
    ADD CONSTRAINT pk_adm_op_type PRIMARY KEY (id);

ALTER TABLE ONLY public.adm_option
    ADD CONSTRAINT pk_adm_option PRIMARY KEY (id);

ALTER TABLE ONLY public.adm_org
    ADD CONSTRAINT pk_adm_org PRIMARY KEY (id);

ALTER TABLE ONLY public.adm_org_type
    ADD CONSTRAINT pk_adm_org_type PRIMARY KEY (id);

ALTER TABLE ONLY public.adm_org_user
    ADD CONSTRAINT pk_adm_org_user PRIMARY KEY (id);

ALTER TABLE ONLY public.adm_perm
    ADD CONSTRAINT pk_adm_perm PRIMARY KEY (id);

ALTER TABLE ONLY public.adm_perm_group
    ADD CONSTRAINT pk_adm_perm_group PRIMARY KEY (id);

ALTER TABLE ONLY public.adm_person
    ADD CONSTRAINT pk_adm_person PRIMARY KEY (id);

ALTER TABLE ONLY public.adm_person_code_type
    ADD CONSTRAINT pk_adm_person_code_type PRIMARY KEY (id);

ALTER TABLE ONLY public.adm_realm
    ADD CONSTRAINT pk_adm_realm PRIMARY KEY (id);

ALTER TABLE ONLY public.adm_realm_org
    ADD CONSTRAINT pk_adm_realm_org PRIMARY KEY (id);

ALTER TABLE ONLY public.adm_realm_user
    ADD CONSTRAINT pk_adm_realm_user PRIMARY KEY (id);

ALTER TABLE ONLY public.adm_role
    ADD CONSTRAINT pk_adm_role PRIMARY KEY (id);

ALTER TABLE ONLY public.adm_role_group
    ADD CONSTRAINT pk_adm_role_group PRIMARY KEY (id);

ALTER TABLE ONLY public.adm_role_menu
    ADD CONSTRAINT pk_adm_role_menu PRIMARY KEY (id);

ALTER TABLE ONLY public.adm_role_perm
    ADD CONSTRAINT pk_adm_role_perm PRIMARY KEY (id);

ALTER TABLE ONLY public.adm_role_user
    ADD CONSTRAINT pk_adm_role_user PRIMARY KEY (id);

ALTER TABLE ONLY public.adm_user
    ADD CONSTRAINT pk_adm_user PRIMARY KEY (id);

ALTER TABLE ONLY public.adm_widget_endpoint
    ADD CONSTRAINT pk_adm_widget_endpoint PRIMARY KEY (id);

CREATE UNIQUE INDEX adm_app_pk ON public.adm_app USING btree (id);

CREATE UNIQUE INDEX adm_lock_log_pk ON public.adm_lock_log USING btree (id);

CREATE UNIQUE INDEX adm_login_log_pk ON public.adm_login_log USING btree (id);

CREATE UNIQUE INDEX adm_menu_perm_pk ON public.adm_menu_perm USING btree (id);

CREATE UNIQUE INDEX adm_menu_pk ON public.adm_menu USING btree (id);

CREATE UNIQUE INDEX adm_op_log_pk ON public.adm_op_log USING btree (id);

CREATE UNIQUE INDEX adm_op_type_pk ON public.adm_op_type USING btree (id);

CREATE UNIQUE INDEX adm_option_pk ON public.adm_option USING btree (id);

CREATE UNIQUE INDEX adm_org_pk ON public.adm_org USING btree (id);

CREATE UNIQUE INDEX adm_org_type_pk ON public.adm_org_type USING btree (id);

CREATE UNIQUE INDEX adm_org_user_pk ON public.adm_org_user USING btree (id);

CREATE UNIQUE INDEX adm_perm_group_pk ON public.adm_perm_group USING btree (id);

CREATE UNIQUE INDEX adm_perm_pk ON public.adm_perm USING btree (id);

CREATE UNIQUE INDEX adm_person_code_type_pk ON public.adm_person_code_type USING btree (id);

CREATE UNIQUE INDEX adm_person_pk ON public.adm_person USING btree (id);

CREATE UNIQUE INDEX adm_realm_org_pk ON public.adm_realm_org USING btree (id);

CREATE UNIQUE INDEX adm_realm_pk ON public.adm_realm USING btree (id);

CREATE UNIQUE INDEX adm_realm_user_pk ON public.adm_realm_user USING btree (id);

CREATE UNIQUE INDEX adm_role_group_pk ON public.adm_role_group USING btree (id);

CREATE UNIQUE INDEX adm_role_menu_pk ON public.adm_role_menu USING btree (id);

CREATE UNIQUE INDEX adm_role_perm_pk ON public.adm_role_perm USING btree (id);

CREATE UNIQUE INDEX adm_role_pk ON public.adm_role USING btree (id);

CREATE UNIQUE INDEX adm_role_user_pk ON public.adm_role_user USING btree (id);

CREATE UNIQUE INDEX adm_user_pk ON public.adm_user USING btree (id);

CREATE UNIQUE INDEX ak_code_adm_widget_type ON public.adm_widget_type USING btree (code);

CREATE UNIQUE INDEX ak_global_adm_dashboard ON public.adm_dashboard USING btree (((role_id IS NULL))) WHERE (role_id IS NULL);

CREATE UNIQUE INDEX ak_role_id_adm_dashboard ON public.adm_dashboard USING btree (role_id) WHERE (role_id IS NOT NULL);

CREATE UNIQUE INDEX ak_role_id_and_app_id_adm_role_app_scope ON public.adm_role_app_scope USING btree (role_id, app_id);

CREATE UNIQUE INDEX ak_role_id_and_org_id_adm_role_org_scope ON public.adm_role_org_scope USING btree (role_id, org_id);

CREATE UNIQUE INDEX ak_role_id_and_realm_id_adm_role_realm_scope ON public.adm_role_realm_scope USING btree (role_id, realm_id);

CREATE UNIQUE INDEX ak_service_and_endpoint_adm_widget_endpoint ON public.adm_widget_endpoint USING btree (service, endpoint);

ALTER TABLE ONLY public.adm_dashboard
    ADD CONSTRAINT adm_dashboard_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.adm_role(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.adm_dashboard_widget
    ADD CONSTRAINT adm_dashboard_widget_dashboard_id_fkey FOREIGN KEY (dashboard_id) REFERENCES public.adm_dashboard(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.adm_dashboard_widget
    ADD CONSTRAINT adm_dashboard_widget_widget_type_adm_widget_type FOREIGN KEY (widget_type) REFERENCES public.adm_widget_type(code) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.adm_lock_log
    ADD CONSTRAINT adm_lock_log_user_id_adm_user FOREIGN KEY (user_id) REFERENCES public.adm_user(id) ON UPDATE RESTRICT ON DELETE CASCADE;

ALTER TABLE ONLY public.adm_login_log
    ADD CONSTRAINT adm_login_log_user_id_adm_user FOREIGN KEY (user_id) REFERENCES public.adm_user(id) ON UPDATE RESTRICT ON DELETE CASCADE;

ALTER TABLE ONLY public.adm_menu
    ADD CONSTRAINT adm_menu_app_id_adm_app FOREIGN KEY (app_id) REFERENCES public.adm_app(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE ONLY public.adm_menu_perm
    ADD CONSTRAINT adm_menu_perm_menu_id_adm_menu FOREIGN KEY (menu_id) REFERENCES public.adm_menu(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE ONLY public.adm_menu_perm
    ADD CONSTRAINT adm_menu_perm_perm_id_adm_perm FOREIGN KEY (perm_id) REFERENCES public.adm_perm(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE ONLY public.adm_op_log
    ADD CONSTRAINT adm_op_log_op_type_code_adm_op_type FOREIGN KEY (op_type_code) REFERENCES public.adm_op_type(code) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE ONLY public.adm_op_log
    ADD CONSTRAINT adm_op_log_user_id_adm_user FOREIGN KEY (user_id) REFERENCES public.adm_user(id) ON UPDATE RESTRICT ON DELETE CASCADE;

ALTER TABLE ONLY public.adm_org
    ADD CONSTRAINT adm_org_org_type_id_adm_org_type FOREIGN KEY (org_type_id) REFERENCES public.adm_org_type(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE ONLY public.adm_org_user
    ADD CONSTRAINT adm_org_user_org_id_adm_org FOREIGN KEY (org_id) REFERENCES public.adm_org(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE ONLY public.adm_org_user
    ADD CONSTRAINT adm_org_user_user_id_adm_user FOREIGN KEY (user_id) REFERENCES public.adm_user(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE ONLY public.adm_perm
    ADD CONSTRAINT adm_perm_group_id_adm_perm_group FOREIGN KEY (group_id) REFERENCES public.adm_perm_group(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE ONLY public.adm_perm
    ADD CONSTRAINT adm_perm_op_type_code_adm_op_type FOREIGN KEY (op_type_code) REFERENCES public.adm_op_type(code) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE ONLY public.adm_person
    ADD CONSTRAINT adm_person_code_type_id_adm_person_code_type FOREIGN KEY (code_type_id) REFERENCES public.adm_person_code_type(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE ONLY public.adm_realm_org
    ADD CONSTRAINT adm_realm_org_org_id_adm_org FOREIGN KEY (org_id) REFERENCES public.adm_org(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE ONLY public.adm_realm_org
    ADD CONSTRAINT adm_realm_org_realm_id_adm_realm FOREIGN KEY (realm_id) REFERENCES public.adm_realm(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE ONLY public.adm_realm_user
    ADD CONSTRAINT adm_realm_user_realm_id_adm_realm FOREIGN KEY (realm_id) REFERENCES public.adm_realm(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE ONLY public.adm_realm_user
    ADD CONSTRAINT adm_realm_user_user_id_adm_user FOREIGN KEY (user_id) REFERENCES public.adm_user(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE ONLY public.adm_role_app_scope
    ADD CONSTRAINT adm_role_app_scope_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.adm_app(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.adm_role_app_scope
    ADD CONSTRAINT adm_role_app_scope_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.adm_role(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.adm_role
    ADD CONSTRAINT adm_role_group_id_adm_role_group FOREIGN KEY (group_id) REFERENCES public.adm_role_group(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE ONLY public.adm_role_menu
    ADD CONSTRAINT adm_role_menu_menu_id_adm_menu FOREIGN KEY (menu_id) REFERENCES public.adm_menu(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE ONLY public.adm_role_menu
    ADD CONSTRAINT adm_role_menu_role_id_adm_role FOREIGN KEY (role_id) REFERENCES public.adm_role(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE ONLY public.adm_role_org_scope
    ADD CONSTRAINT adm_role_org_scope_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.adm_org(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.adm_role_org_scope
    ADD CONSTRAINT adm_role_org_scope_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.adm_role(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.adm_role_perm
    ADD CONSTRAINT adm_role_perm_perm_id_adm_perm FOREIGN KEY (perm_id) REFERENCES public.adm_perm(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE ONLY public.adm_role_perm
    ADD CONSTRAINT adm_role_perm_role_id_adm_role FOREIGN KEY (role_id) REFERENCES public.adm_role(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE ONLY public.adm_role_realm_scope
    ADD CONSTRAINT adm_role_realm_scope_realm_id_fkey FOREIGN KEY (realm_id) REFERENCES public.adm_realm(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.adm_role_realm_scope
    ADD CONSTRAINT adm_role_realm_scope_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.adm_role(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.adm_role_user
    ADD CONSTRAINT adm_role_user_role_id_adm_role FOREIGN KEY (role_id) REFERENCES public.adm_role(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE ONLY public.adm_role_user
    ADD CONSTRAINT adm_role_user_user_id_adm_user FOREIGN KEY (user_id) REFERENCES public.adm_user(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE ONLY public.adm_user
    ADD CONSTRAINT adm_user_person_id_adm_person FOREIGN KEY (person_id) REFERENCES public.adm_person(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
