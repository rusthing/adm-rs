# adm-web 前端体检与整改

范围：`/Users/zbz/workspace/rusthing/adm-rs/adm-web`。**未修改任何 Rust 代码或后端接口契约。**

- 第一轮已提交：`e984468 fix(adm-web): 前端体检整改，修正权限边界、路由菜单与列表交互`。
- 第二轮已提交并推送：`8c188f3 fix(adm-web): 第二轮前端体检整改，收敛会话、弹窗、侧栏与配置页交互`。本轮把第一轮因「改动繁琐 / 超出范围」留在「可接受 / 未做」里、但其实合理的问题继续做完，并顺带修掉通读中新发现的缺陷。

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
  - `RoleGroupsPage` / `PermissionGroupsPage`：父分组按当前 `realmId` 动态过滤且 `resetOn: ["realmId"]`，避免跨领域 treeCode 被服务端拒绝。
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
| 权限 URN 通配符（如 `*:/adm/**`） | **待后端确认语义** | 见第 6 节 |

## 4. 验证

本轮验证结果：

- `pnpm typecheck`：通过（`tsc --noEmit`，`strict` + `noUnusedLocals` / `noUnusedParameters`）。
- `pnpm test`：**9 个文件 / 51 个用例全部通过**。新增 `crud/fields.test.ts`(6)、`layout/nav.test.ts`(6)、`lib/utils.test.ts`(5)、`lib/unsaved-guard.test.ts`(4)；原有 `perm / cells / filters / sort / sm3` 共 30 个用例未回归。
- `pnpm build`：通过。`dist/assets/index-B604C7ur.js` 452.77 kB（gzip 139.73 kB）、`index-DCLNGvht.css` 32.80 kB（gzip 7.10 kB）；`dist/` 已被 `.gitignore` 排除。

第一轮另曾做过真实链路实测（`adm-svr` 9007 + Vite 5181，登录、用户搜索、首页 6 张 widget、配置页 6 条配置均正常）；**第二轮只做了静态验证**，未重启后端做浏览器实测。

## 5. 已知边界 / 未做

- `useUnsavedGuard` 覆盖刷新/关闭标签页与站内 `<Link>` 点击；浏览器前进/后退（`popstate`）无法在 `BrowserRouter` 下可靠取消，未伪装支持。若后续需要完整拦截，应迁移到 `createBrowserRouter + RouterProvider` 再用 `useBlocker`。
- 未做真实浏览器 E2E：拖拽排序（鼠标/触屏）、多级侧栏、401 自动登出、会话切换、子路径部署与 `HashRouter` 模式，均只有代码层与单测覆盖。
- 未做移动端真机视觉走查。
- 未做「切换第二个账号后 dashboard 内容变化」「仅 role-group 权限」等账号级 E2E（需要额外账号与授权数据）。

## 6. 后端配合清单

**没有必须的后端接口改动。** 唯一待确认项：权限 URN 是否会出现通配符（如 `*:/adm/**`）。当前后端下发的是具体「方法 + 路径」，前端按路径段边界做字面匹配；若引入通配符，需先由后端定义语义（方法通配、层级通配、优先级），再扩展 `src/auth/perm.ts` 与对应单测，否则不需要动 Rust。
