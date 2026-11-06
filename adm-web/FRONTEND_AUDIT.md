# adm-web 前端体检与整改

范围：`/Users/zbz/workspace/rusthing/adm-rs/adm-web`。**未修改任何 Rust 代码或后端接口契约。**

- 第一轮已提交：`e984468 fix(adm-web): 前端体检整改，修正权限边界、路由菜单与列表交互`。
- 第二轮已提交并推送：`8c188f3 fix(adm-web): 第二轮前端体检整改，收敛会话、弹窗、侧栏与配置页交互`。本轮把第一轮因「改动繁琐 / 超出范围」留在「可接受 / 未做」里、但其实合理的问题继续做完，并顺带修掉通读中新发现的缺陷。
- 第三轮：按应用 / 分组管理树形数据、树形页面行内添加子级、侧栏空目录剪枝。**改动已落地并验证通过，尚未提交。**

## 1. 第一轮已修（简述）

- `src/auth/perm.ts`：权限 URN 改路径段边界匹配，`GET:/adm/role` 不再误命中 `role-group` / `role-user` / `role-perm`。
- 切账号清 `queryClient` 缓存；dashboard / widget 查询键带 `userId`。
- `src/pages/registry.ts`：`PAGE_COMPONENTS` / `PAGE_PERMS` / `isRegisteredComponent` 成为唯一登记处；未注册组件的内链菜单不进侧栏。
- `src/App.tsx`：默认页按菜单 `treeCode` 稳定排序；`/me` 加载中 / 失败时不再误报 404。
- `CrudPage`：分页 clamp、请求竞态令牌、reorder 串行化、Enter/Esc 搜索、空态与错误文案、首列固定 / 数字右对齐 / 长文本截断。
- 各页面外键统一 `--` / `shortId`，备注/路径列 `truncate`；`DashboardConfigPage` 配置未读完禁用保存；`http.ts` 401/403 文案精确化。

## 2. 第二轮改了什么

### 2.1 会话失效与鉴权视图

- `src/lib/auth-storage.ts`：新增 `SESSION_EXPIRED_EVENT = "adm:session-expired"` 与 `notifySessionExpired()`；本地判定令牌过期时广播。
- `src/lib/http.ts`：HTTP 401 或业务码 `ADM00005` 时广播同一事件，纯 HTTP 层不依赖 React / Router。
- `src/auth/AuthContext.tsx`（重写）：
  - `/me` 改由 React Query 管理，`queryKey: ["authz", token]`；`login()` 只 `setSession(next)`，不再「login 手动拉一次 + effect 再拉一次」，消除重复请求与竞态。
  - `loadAuthz(expectedUserId)` 校验 `me.user.id === expectedUserId`，令牌与返回用户不一致时直接报错，避免把别人的菜单/权限写入本地缓存。
  - 监听会话失效事件：`clearSession / clearAuthz / queryClient.clear()`，并带 `returnUrl` 跳 `/login`。
  - 删除 `src/auth/authz.ts`：旧转发层不再需要。
- `src/main.tsx`（重写）：`AuthProvider` 必须用 `useNavigate / useLocation`，因此放到 `BrowserRouter` / `HashRouter` **内层**；`VITE_ROUTER=hash` 从「只写在注释里」变成真正生效；接入 `ConfirmProvider`。
- `src/auth/RequireAuth.tsx`：`RequirePerm` 的「回到工作台」由 `window.location.assign("/")` 改为 `<Link to="/">`，子路径部署不再跳出应用。
- `.env.example` / `src/vite-env.d.ts`：补齐 `PUBLIC_BASE`、`VITE_ROUTER`、`VITE_GATEWAY_BASE`、`VITE_SERVICE_BASES`、`VITE_OSS_TARGET` / `VITE_MSG_TARGET` / `VITE_JOBX_TARGET` 的说明与类型声明。

### 2.2 统一确认弹窗与 Overlay 基础设施

`src/components/ui/overlay.tsx`（重写）：

- 新增 `ConfirmProvider / useConfirm()`，返回 `Promise<boolean>`，全应用替换 `window.confirm`；同一时刻只允许一个确认框，新确认会先把旧的按「取消」结算，避免永久挂起的 Promise。
- body 滚动锁改**引用计数**：多个 `Modal / Drawer / Confirm` 叠加时，只在第一个打开时保存并锁定、最后一个关闭时恢复，杜绝 `overflow` 被写成 `"hidden"` 后永久锁死。
- `DialogFrame` 统一 `role="dialog"` / `aria-modal` / `aria-labelledby` / `tabIndex={-1}`，关闭后恢复 `previousFocus`；新增 `dismissable`，危险确认与有未保存内容的表单设为 `false`。
- `onCloseRef`：调用方的内联 `onClose` 不再让 effect 每次 render 重跑、把焦点从输入框抢回弹窗。
- Toast 文案补 `role="status"`。

已替换的 `window.confirm`：`CrudPage` 删除、`UsersPage` 重置口令、`DashboardConfigPage` 切换目标与删除配置。

### 2.3 CrudPage 表单能力（新增纯逻辑层）

- `src/components/crud/fields.ts`（新增）：`CrudField` 增加 `key` / 动态 `options(values, mode)` / `validate` / `resetOn` / `disabled`；导出 `fieldKey / visibleFieldsOf / defaultsOf / resolveFieldOptions / applyFieldChange / validateForm`，与渲染分离后可单测。
- `src/components/crud/CrudPage.tsx`：
  - 关键字 debounce 用 `keywordTimerRef` 管理，Enter / Esc / 清空时取消遗留 timer，避免旧 timer 覆盖即时查询结果。
  - 表单字段 id 由 `useId() + fieldKey()` 稳定生成，`Field htmlFor` 生效；错误区 `role="alert"`；表格 `aria-label`。
  - `<Select>` 保留「当前值，已不在可选列表」的 stale option，停用项或旧值不会被浏览器静默改成第一项。
  - 新建/编辑 Modal `dismissable={false}`，误点遮罩不再丢失表单。
- 页面落地：
  - `MenusPage`：父节点按当前 `appId` 动态过滤且 `resetOn: ["appId"]`；`component` 改 `PAGE_COMPONENTS` 下拉、`icon` 改 `ICON_NAMES` 白名单下拉；`linkType` 校验内链 `/` 开头、外链 / iframe 需完整 URL。
  - `RoleGroupsPage` / `PermissionGroupsPage`：父分组按当前 `realmId` 动态过滤且 `resetOn: ["realmId"]`，避免跨领域 treeCode 被服务端拒绝。（**第四轮已撤销**：分组树与领域脱钩，父分组列出全局全部节点，不再有 resetOn。）
  - `UsersPage`：登录名 / 手机号 / 邮箱 `validate`；create/edit 里重名的 `loginPswd` 用 `key` 区分；`groupName.get(...) ?? shortId(...)`。
  - `RolesPage`：授权保存成功后 `await refreshAuthz()`，当前账号自己的侧栏与页面门禁立即刷新。

### 2.4 口令、登录页与跳转安全

- `UsersPage`：删除误导性的客户端 salt `"000000"` 及 `*Salt` 空串。已核对 `adm-svr/src/svc/adm_user_svc.rs::seal_pswd_pair()` 忽略 `_salt` 并调用 `AdmPasswordUtils::gen_salt()` 随机生成，前端不该参与。
- `LoginPage`：删除页面上的 `admin / admin123` 默认凭据与接口前缀展示；`returnUrl` 收紧为拒绝 `//host`、反斜杠、控制字符与 `/login` 自跳转。
- `src/lib/utils.ts` 新增 `safeInternalPath()`；`WidgetRenderer` 新增 `SafeNavLink`，后端 widget 配置里的外链、伪协议、`#`、控制字符降级为不可点击的普通元素。
- `App.tsx`：`UnregisteredPage` 去掉 `window.location.reload()`，改 `<Link to="/">`；面向用户的文案不再暴露 `pages/registry.ts`、接口路径等开发者细节。
- `src/lib/widget-fetch.ts`：清理无用途的 `started` 变量与空 `finally`。
- `DashboardPage`：带 `permUrn` 的卡片在权限信息就绪且命中前**不再抢跑取数**（fail closed）；鉴权失败时显示「权限信息加载失败」，而不是永久 loading。

### 2.5 侧栏支持任意层级菜单

- `src/components/layout/nav.ts`（重写）：删除写死 `treeCode` 长度 3/6 的两级模型，改 `NavNode` + `buildNavTree()` 按前缀关系构造任意层级；`depth` 按**可见父链**计算（中间层隐藏时不跳级）；父节点不可见时逐级上提到最近可见祖先；新增 `flattenNav()` / `findNavTrail()`（最长路径匹配）/ `ICON_NAMES`。
- `src/components/layout/AppShell.tsx`（重写）：递归渲染、任意层级折叠、深链自动展开当前分支、多级面包屑；折叠态点击箭头展开整条侧栏；账号菜单合并「个人中心 / 修改口令」。
- **额外修掉的真实缺陷**：既是页面又是父目录的菜单节点原来只渲染成折叠按钮、页面本身点不进去；现在名称部分跳页面、右侧箭头单独负责折叠/展开。

### 2.6 首页配置页

`src/pages/DashboardConfigPage.tsx`：

- 拖拽由 HTML5 `draggable/onDragStart/onDrop` 改为 **Pointer Events**（手柄 `setPointerCapture` + `elementFromPoint` + `data-widget-key` 按 key 重排），鼠标与触屏都可用；保留上移/下移按钮。
- `useUnsavedGuard()`（`src/lib/unsaved-guard.ts` 新增）：`beforeunload` + document 捕获阶段拦截站内 `<Link>`，确认后用 `navigate` 跳转；支持 `BrowserRouter basename` 与 `HashRouter`。项目用的是非 data router，`useBlocker` 不可用，故自行覆盖这两条路径。
- 下拉只列启用项，但为 `newType` / `widgetType` / `service` / `endpoint` 补「当前值，已停用或不在目录」占位，避免 `<select value>` 找不到 option 被静默改写。
- `runPreview()` 补 `catch`，`Promise.all` 异常时不再让预览卡在 loading 占位。
- 切换目标 / 删除配置改用统一确认弹窗；取消切换时强制重渲染，把受控 Select 的 DOM 值拉回当前目标。

### 2.7 第三轮：按应用 / 分组管理树形数据

用户反馈：菜单要按应用分组（且只在 0/1 个应用时才不分组）、权限要能按分组管理、树形页面要能在节点下直接添加子级、侧栏里「没有子节点的非叶子菜单」不该显示。

#### 侧栏按应用动态分段

`src/components/layout/nav.ts`：

- 新增 `NavAppInfo` / `NavSection` / `buildNavSections(menus, apps)`：
  - 依据**当前账号可见菜单**的 distinct `appId` 判断：0 或 1 个 → 合为一段、`showHeader=false`（保持原单树形态）；2 个及以上 → 每应用一段、带应用标题。
  - 应用顺序取调用方给的 `sort_order:asc` 顺序（`apps` 数组下标当权重），未查到的应用排最后并回退为 `应用 <短 ID>`。
  - `prefixTrail()` 把应用名前置到 `trail`，多应用下面包屑与折叠态 tooltip 都带所属应用。
- 新增 `pruneNav()`：**自底向上**剪掉「既不可导航、又没有可展示后代」的目录；子目录整棵是空壳时父目录同样被回收，避免侧栏留一排点不开的标题。分段剪枝后为空则整段隐藏，不留空标题。
- `codeKey(appId, treeCode)`：`buildNavTree()` 的父关系按 `appId` 隔离，两个应用都配 `001 / 001001` 也不会串树。
- `navigableOf()` 收紧：必须有非空 `path`；内链还要求组件已登记。
- `findNavTrail()` 只匹配 `navigable` 节点。
- 新增 `sectionNodes(sections)` 展平分段供路径匹配。

`src/components/layout/AppShell.tsx`：`NavSections` 按分段渲染 `NavTree`；`AppSectionHeader` 显示应用名（折叠态只留图标）；应用列表走共享 `useAppOptions()`，接口失败仍按 `appId` 分组、标题回退短 ID，不阻断侧栏。

`src/App.tsx`：

- `menuRoutes` 改为按**应用 `sort_order`** → `treeCode` → `id` 稳定排序后按 path 去重，默认落地页与侧栏第一段顺序一致（原来按 `appId` 字典序，多应用时会「进错应用」）。
- 应用顺序还在加载时先显示加载态，不跳默认页，避免先落到字典序第一个应用再跳走。
- `UnregisteredPage` 文案用户化，不再暴露 `component` / `path` 等开发者细节。

#### 列表按分组 / 应用切换

`src/components/crud/scope.ts` + `scope-panel.tsx`（新增）：`CrudPage` 的左侧分组栏。

- `CrudScopeDef`：`title / param(snake_case 后端参数) / field(camelCase 表单字段) / options / hideWhenSingle / queryFor`。
- `scopePanelVisible()`：默认只在**两个及以上选项**时出现——即用户要求的「没有应用或只有一个应用时不分组」。
- `initialScopeValue()` 恒返回 `null`：**「只有一个应用」的含义是不分组展示，不是隐式筛选**。分组栏隐藏时用户没有任何筛选入口，一旦默认收窄到唯一分组，`appId` 为空或指向已删除分组的历史数据会凭空消失，列表还会随选项加载完成无声跳变。
- `effectiveScopeValue()`：分组栏不可见时恒为「全部」；选项被删除后回落「全部」，不让列表停在永远查不到数据的范围上。
- `scopeCreateValue()`：新建时优先当前范围、否则第一个分组；与 `initialScopeValue` 解耦。
- `treeGroupQuery()`：选中树形父分组时展开为「本组 + 全局树中所有子孙」的 `il`（is_in）条件，参数形如 `group_id-op=il` + `group_id-0..n`，与 `robotech` 的 `SearchParams::from_pairs()` 契约一致。要求 `extra % 3 === 0`，`0010` 这类脏编码不会被误判为 `001` 的子孙。（第四轮起不再按 `realmId` 排除：`treeCode` 已全局唯一。）
- `CrudPage`：`scope` 支持 `queryFor`、`scopeKey` 进 `queryKey`、切换分组时丢弃未提交排序预览、空状态识别当前分组并提供「查看全部分组」、`ScopePanel` 高亮用真实生效值 `effectiveScope`。

落地页面：`MenusPage`（按应用）、`PermissionsPage` / `RolesPage`（按分组树，含子分组）。（第四轮起 `RoleGroupsPage` / `PermissionGroupsPage` 不再有领域分组栏，`AppsPage` 也不再有领域筛选下拉。）原先这些页面的 `app_id` / `group_id` 只是普通筛选项，现在统一成左侧分组栏。

#### 树形页面行内「添加子级」

`CrudPage` 的 `rowActions` 从「只有 `reload`」扩展为 `CrudRowHelpers`：

```ts
openCreate(values?, note?)   // 预填字段并打开新建表单，note 显示在弹窗说明里
setFilter(name, value)       // 同步搜索行筛选
setScope(value | null)       // 切换左侧分组
canCreate                    // 当前账号是否可新建
```

`MenusPage` / `RoleGroupsPage` / `PermissionGroupsPage` 每行加「添加子级」：先 `setScope(父所属应用/领域)`，再 `openCreate({ appId|realmId, parentCode })`，弹窗里写明「将在「X」· 001001 下创建子节点」。（第四轮起分组页只预填 `parentCode`，不再调用 `setScope`。）

#### 授权清单按分组批量勾选

`src/components/crud/tree-utils.ts`（新增，纯逻辑）：`buildTree(items, scopeOf?)` 按 `treeCode` 前缀还原任意层级树；`scopeOf` 用来隔离作用域（目前只有菜单按 `appId`；第四轮起分组树全局唯一，无需隔离）；clone 入参，绝不往 React Query 缓存对象上挂 `children`；`depth` 按真实可见父链计算。新增 `flattenTreeIds()`。

`src/components/crud/tree.tsx`：

- `PermCheckList` / `MenuCheckList` 每组（每个应用）显示「已选/总数」与「全选本组 / 清空本组」；菜单按应用分段、段内独立建树。
- `useGroupedOptions()`：分组记录缺失时进「未分组（分组已删除）」兜底桶，绝不静默丢弃；分组顺序按 `treeCode` 排列。（第四轮：全局一棵分组树，`treeCode` 唯一，标题不再加领域前缀，排序不再按领域分段。）
- 删除从未被引用的 `useRoleTree` / `RoleTable` / `useMenuTree`。

`src/pages/UsersPage.tsx`：用户角色抽屉同样补「已选/总数 + 全选本组 / 清空本组」，分组顺序改为跟随分组树而非角色出现顺序。

#### 选项列表统一查询

`src/lib/queries.ts`（新增）：`useAppOptions / useRealmOptions / useMenuOptions / usePermOptions / useRoleOptions / useRoleGroupOptions / usePermGroupOptions`。

统一约定 `queryKey = [<crud 前缀>, "options"]`。原来同一份数据在不同调用点有 `app/options`、`app/nav-groups`、`app/check-list`、`roleGroup/tree`、`roleGroup/options`、`roleGroup/all-for-user` 等别名 key，既重复请求，又因为 `CrudPage` 只失效 `[prefix]`（分页列表）而带不走选项缓存，下拉框会长期停在旧数据上。现在前缀匹配会一并失效。`useRealmOptions` 第四轮起只服务用户/组织数据域与角色数据范围，不再被资产页面调用。

### 2.8 第四轮：应用 / 角色 / 权限与领域脱钩

> **历史口径提示**：本节写于第四轮，当时 `adm_role_scope` 原样保留、只下发不过滤。该结构已在第五轮（见 2.9）拆成三张表并启用 DAO 层强制过滤，本节里「数据范围不改结构、不改逻辑」「全局数据」等表述不再成立，保留原文仅为记录演进。

**概念定死**：领域（`adm_realm`）只是**用户 / 组织的数据域划分单位**——决定用户/组织归属（`adm_realm_org` / `adm_realm_user`）与角色的数据可见范围（`adm_role_scope`）；应用、菜单、角色、权限及其分组是**全局功能与授权资产**，与领域无关。数据范围（`adm_role_scope`）本轮不改结构、不改逻辑，原样保留。

改动从 PowerDesigner 模型起，贯穿 SQL、Rust 后端、前端：

- 删除 `adm_app` / `adm_role_group` / `adm_perm_group` 的 `realm_id` 列、外键、FK 索引、组合唯一键；分组唯一键改为 `AK_TREE_CODE_* unique (tree_code)`，`tree_code` 全局唯一。
- 后端：`mo` 删 `realm_id` 与 `BelongsTo` / `HasMany`；`dto` / `vo` 删字段；DAO 唯一键改 `("tree_code", "树编码")`；`#[sortable]` 去掉 `group` / `scope`；`SORT_APP` / `SORT_ROLE_GROUP` / `SORT_PERM_GROUP` 去掉 `.with_group("realm_id")` / `.with_scope("realm_id")`，改为全局一组 / 全局一棵树（与 `SORT_ORG` 同构）。
- 前端：`AppsPage` 删领域列 / 下拉 / 筛选 / `sortable.scope`；`RoleGroupsPage` / `PermissionGroupsPage` 删领域列 / 字段 / 左侧领域分组栏 / `sortable.scope`，父分组列出全局节点，行内「添加子级」只预填 `parentCode`；`tree.tsx` 的 `useGroupedOptions()` 不再加领域前缀与按领域排序；`scope.ts::treeGroupQuery()` 改为全局 `treeCode` 前缀判定。
- 类型：`AdmAppVo` / `AdmRoleGroupVo` / `AdmPermGroupVo` 删 `realmId`；`AdmRoleScopeVo.realmId` **保留**（数据范围）。
- 概念文案：`RealmsPage`、`adm_realm` 的 DTO / VO / DAO 注释、建表 SQL 与 PD 模型注释统一改成「用户/组织数据域划分，与全局配置无关」。
- 保留第三轮成果：按应用/分组管理树形数据、行内添加子级、侧栏空目录剪枝、选项查询统一。
- 验证：`cargo check --workspace --all-targets --offline`、`pnpm typecheck`、`pnpm test`（11 文件 / 79 用例）、`pnpm build` 全部通过；未做浏览器 E2E 与真实数据库迁移实测（初始化脚本按「不考虑旧数据」直接改，未写旧库升级迁移）。

### 2.9 第五轮：可见范围拆成三张表 + DAO 层强制过滤

**概念定死**：领域（`adm_realm`）只划分用户 / 组织的数据域；角色可见范围是**三条独立轴**，各自一张关联表，都只是「能看哪些」的白名单，不管功能权限：

| 表 | 列 | 语义 |
| --- | --- | --- |
| `adm_role_realm_scope` | `role_id, realm_id` | 角色可看哪些领域（及由领域推导出的用户/组织） |
| `adm_role_org_scope` | `role_id, org_id` | 角色可看哪些组织（含 `tree_code` 子树） |
| `adm_role_app_scope` | `role_id, app_id` | 角色可进哪些应用（菜单按 `adm_menu.app_id` 过滤） |

- 功能权限仍由 `adm_role_menu` / `adm_role_perm` 决定；应用轴与 `role → menu → app` 取交集。
- 没配某一轴 = 该维度全量可见（**配了才限制**）；多角色取并集；当前用户自己始终可见。
- 为什么拆表：旧 `adm_role_scope` 把领域 / 组织塞进一张表，逼出 nullable 外键和 `check ((realm_id is not null) <> (org_id is not null))`，应用轴更无处安放。拆开后每张表都是干净的 `(role_id, target_id)` 关联表，外键与唯一键都无歧义。

**强制过滤：机制在框架、语义在业务**

- `robotech::dao::data_scope` 新增 `DataScope` trait、`set_data_scope()`、`data_scope_condition()`、`data_scope_only()`、`has_data_scope()`。框架不绑定用户来源；**未注册策略时完全透明**，其它服务行为不变。
- `#[dao]` 宏把范围条件注入全部 `.filter(condition)` 路径，以及 `get_by_id` / `get_ex_by_id` / `update` / `delete`（执行前先确认目标在可见范围内）/ `update_if_older`——不只挡列表，也挡单条读、改、删。
- `adm-svr` 用 `tokio::task_local!` 保存请求上下文，`load_scope_ctx(user_id)` 一次请求只算一次；`require_auth` 和不挂鉴权的 dashboard / widget 路由（`scope_from_user_header`）都包 `with_scope(...)`；查库失败直接 500，不放行业务查询。
- 组织轴按 `adm_org.tree_code`（每层 3 位）前缀展开子树；空集合用 `vec![-1]` 哨兵表示「匹配不到任何行」，避免退化成全量或非法 `IN ()`。
- 统计端点 `stats_count()` 与 DAO 共用 `data_scope_condition`，避免「列表受限、KPI 泄漏」。

**同步范围**：PowerDesigner `.ldm/.ldb/.pdm/.pdb`（3 实体/表 + 6 关系 + 默认图符号）、`model/create-table-pgsql.sql` 与运行时建表迁移、`20261103113000_role_scope.sql`、RBAC/首页种子、SeaORM 实体与 `mo` 出口、`/me` 下发、首页 widget 文案、全仓旧口径文案（「本轮只下发、不强制过滤」「当前为全局数据」「数据范围标记」）一并改掉；`adm-api/src/dic/data_scope.rs` 标注为骨架期遗留字典（无字段引用），避免与框架 `DataScope` trait 混淆。

## 3. 问题清单与状态

| 问题 | 状态 | 关键位置 |
| --- | --- | --- |
| 权限前缀误判 `role` → `role-group` | 第一轮已修 + 单测 | `auth/perm.ts` |
| 切账号沿用上一位用户缓存 | 已修（第二轮加 `userId` 校验 `/me`） | `AuthContext.tsx`、`DashboardPage.tsx` |
| 未注册组件菜单进侧栏 / 深链误报 404 | 第一轮已修 | `pages/registry.ts`、`nav.ts`、`App.tsx` |
| CrudPage 竞态、分页、排序并发 | 第一轮已修 | `CrudPage.tsx` |
| 菜单父节点未按 `appId` 过滤 | **第二轮已修** | `MenusPage.tsx`、`crud/fields.ts` |
| 三层及以上菜单侧栏退化到「其他」 | **第二轮已修** | `layout/nav.ts`、`AppShell.tsx` |
| 401 只提示不清会话 / 不跳登录 | **第二轮已修** | `auth-storage.ts`、`http.ts`、`AuthContext.tsx` |
| Dashboard 配置触屏拖拽 | **第二轮已修** | `DashboardConfigPage.tsx` |
| `window.confirm` 风格不统一 | **第二轮已修** | `overlay.tsx` + 各页面 |
| 叠加弹层把页面滚动永久锁死 | **第二轮已修** | `overlay.tsx` |
| 客户端伪造口令 salt | **第二轮已修** | `UsersPage.tsx` |
| 登录页展示默认账号/口令 | **第二轮已修** | `LoginPage.tsx` |
| widget 跳转路径未做站内收敛 | **第二轮已修** | `lib/utils.ts`、`WidgetRenderer.tsx` |
| 权限未就绪就取带 URN 的卡片数据 | **第二轮已修** | `DashboardPage.tsx` |
| 配置页有未保存修改直接离开 | **第二轮已修（刷新/站内跳转）** | `lib/unsaved-guard.ts` |
| 跨领域选父分组 | **第二轮已修** | `RoleGroupsPage.tsx`、`PermissionGroupsPage.tsx` |
| 既是页面又是父目录的菜单点不进去 | **第二轮已修** | `AppShell.tsx` |
| 菜单不按应用分组、单/多应用都长一样 | **第三轮已修** | `layout/nav.ts`、`AppShell.tsx` |
| 侧栏残留「没有子节点又非叶子」的空目录 | **第三轮已修** | `layout/nav.ts`（`pruneNav`） |
| 多应用同 `treeCode` 在侧栏串成一棵树 | **第三轮已修** | `layout/nav.ts`（`codeKey`） |
| 权限/角色/菜单/分组只能在搜索行里选父级 | **第三轮已修（左侧分组栏）** | `crud/scope.ts`、`crud/scope-panel.tsx` |
| 树形页面无法在节点下直接添加子级 | **第三轮已修** | `CrudPage.tsx`、`MenusPage.tsx` 等 |
| 选中父分组后列表为空（父组本身无数据） | **第三轮已修** | `crud/scope.ts`（`treeGroupQuery`） |
| 分组栏隐藏时仍隐式筛选到唯一分组 | **第三轮已修** | `crud/scope.ts`（`initialScopeValue`） |
| 授权清单缺少按分组批量勾选 | **第三轮已修** | `crud/tree.tsx`、`UsersPage.tsx` |
| 跨领域同名分组标题无法区分 | **第三轮已修** | `crud/tree.tsx`（`useGroupedOptions`） |
| 授权树跨应用同编码串挂 | **第三轮已修** | `crud/tree-utils.ts`（`scopeOf`） |
| 选项列表重复请求且变更后不刷新 | **第三轮已修** | `lib/queries.ts` |
| 多应用时默认落地页与侧栏顺序不一致 | **第三轮已修** | `App.tsx` |
| 可见范围只下发、后端业务查询不过滤 | **第五轮已修（DAO 层强制注入）** | `robotech/src/dao/data_scope.rs`、`robotech-macros/src/dao/mod.rs`、`adm-svr/src/svc/adm_data_scope.rs` |
| 可见范围没有配置入口，只能写 SQL | **待补管理界面** | 见第 5 节 |
| 权限 URN 通配符（如 `*:/adm/**`） | **待后端确认语义** | 见第 6 节 |

## 4. 验证

第三轮验证结果：

- `pnpm typecheck`：通过（`tsc --noEmit`，`strict` + `noUnusedLocals` / `noUnusedParameters`）。
- `pnpm test`：**11 个文件 / 79 个用例全部通过**。第三轮新增 `crud/scope.test.ts`(14)、`crud/tree-utils.test.ts`(7)，`layout/nav.test.ts` 由 6 个扩到 13 个（新增 `buildNavSections` / `pruneNav` / `sectionNodes` 覆盖）；原有 51 个用例未回归。
- `pnpm build`：通过。`dist/assets/index-Cul0RQaP.js` 464.85 kB（gzip 143.14 kB）、`index-CWZvVy2o.css` 33.40 kB（gzip 7.20 kB）；`dist/` 已被 `.gitignore` 排除。

第四轮（领域脱钩）复验：`cargo check --workspace --all-targets --offline` 通过、`pnpm typecheck` 通过、`pnpm test` 11 文件 / 79 用例全通过、`pnpm build` 通过（`index-D7V3ZU9H.js` 461.62 kB / gzip 142.70 kB，`index-CWZvVy2o.css` 33.40 kB）。`scope.test.ts` / `fields.test.ts` / `tree-utils.test.ts` 的领域样例已改为全局树与 `appId` 样例。

第五轮（三表拆分 + 强制过滤）复验：`robotech-rs` 与 `adm-rs` 的 `cargo check --workspace --offline`、`adm-rs cargo check --workspace --all-targets --offline` 通过；`pnpm typecheck` / `pnpm test` / `pnpm build` 通过；PowerDesigner 四个模型文件 XML 合法、对象 Id 唯一、`Ref` 无悬空引用；两份初始化 DDL 新增块逐字一致。仍未做真实数据库迁移执行与浏览器 E2E。

第一轮另曾做过真实链路实测（`adm-svr` 9007 + Vite 5181，登录、用户搜索、首页 6 张 widget、配置页 6 条配置均正常）；**第二、三、四轮只做了静态验证**，未重启后端做浏览器实测，也未在真实数据库上跑迁移。

## 5. 已知边界 / 未做

- **可见范围暂无管理界面**：三张 `adm_role_*_scope` 表目前只能通过初始化 SQL / 直接写库配置（种子里只给组织管理员角色配了领域 + 应用各一条），后端没有对应 CRUD 接口，前端也没有配置页；`/me` 只做只读下发与首页展示。若要在管理后台配置，需要补 3 组 DTO/VO/DAO/Svc/Ctrl/Router 与「角色 → 可见范围」配置页；组织轴因 `adm_org` 初始化为空，暂无种子数据。
- **真实存量库升级未处理**：按「改初始化不用考虑旧数据」直接改初始化脚本，没有写旧 `adm_role_scope` → 三张新表的数据迁移，也没有写 `drop table adm_role_scope`；老库升级需另行设计。
- `useUnsavedGuard` 覆盖刷新/关闭标签页与站内 `<Link>` 点击；浏览器前进/后退（`popstate`）无法在 `BrowserRouter` 下可靠取消，未伪装支持。若后续需要完整拦截，应迁移到 `createBrowserRouter + RouterProvider` 再用 `useBlocker`。
- 树形页面只在**新建**时能选父节点（`parentCode` 是 `createOnly`），不支持把已有节点移动到别的父节点下；因此也不存在「把父节点设成自己的子孙」形成环的路径。若后续要做移动，必须同时排除自身与子孙。
- （第四轮已消除）`AppsPage` 不再有领域下拉 / 领域列 / `realm_id` 筛选；应用是全局配置，与领域无关。
- 未做真实浏览器 E2E：拖拽排序（鼠标/触屏）、多级侧栏、多应用分段、401 自动登出、会话切换、子路径部署与 `HashRouter` 模式，均只有代码层与单测覆盖。
- 未做移动端真机视觉走查。
- 未做「切换第二个账号后 dashboard 内容变化」「仅 role-group 权限」等账号级 E2E（需要额外账号与授权数据）。

## 6. 后端配合清单

**没有必须的后端接口改动。** 唯一待确认项：权限 URN 是否会出现通配符（如 `*:/adm/**`）。当前后端下发的是具体「方法 + 路径」，前端按路径段边界做字面匹配；若引入通配符，需先由后端定义语义（方法通配、层级通配、优先级），再扩展 `src/auth/perm.ts` 与对应单测，否则不需要动 Rust。
