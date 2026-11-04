# adm-web 前端体检与整改（本轮未提交、未推送）

范围：`/Users/zbz/workspace/rusthing/adm-rs/adm-web`。未修改任何 Rust 代码或后端接口契约。

## 1. 改了什么

### 1.1 权限、账号切换与路由

- `src/auth/perm.ts`（新增）：权限 URN 改为**路径段边界匹配**。`GET:/adm/role` 只命中自身或以 `/` 开头的子路径，不再误命中 `GET:/adm/role-group`、`GET:/adm/role-user`、`GET:/adm/role-perm`；`src/auth/authz.ts` 原样导出，`src/auth/AuthContext.tsx` 的 `hasPerm` 使用新实现。
- `src/auth/AuthContext.tsx`：登录/登出时 `queryClient.clear()`，清掉上一位账号的首页与列表缓存；`src/pages/DashboardPage.tsx` 的生效配置与 widget 查询 key 增加 `userId`，双保险避免切账号后串数据。
- `src/pages/registry.ts`（新增）：`PAGE_COMPONENTS` / `PAGE_PERMS` / `isRegisteredComponent` 成为唯一登记处。
- `src/App.tsx`：路由与默认页改为从 registry 读取；默认页按菜单 `treeCode` 稳定排序且只落到已注册组件；`/me` 加载中与失败且无缓存时，首页和任意深链显示“加载中 / 权限加载失败 + 重试”，不再误报 404 或空菜单。
- `src/components/layout/nav.ts`：未注册组件的内链菜单**不再进入侧栏**（直接访问 URL 时仍由 `UnregisteredPage` 降级提示）；外链行为不变。
- `src/pages/MenusPage.tsx`、`src/pages/LoginPage.tsx`：纠正“前端不消费菜单生成路由”“admin 按超级管理员展示全部页面”的过时文案，改为当前 `/me` 驱动与真实 RBAC 语义。

### 1.2 CrudPage 交互与真实 bug

关键文件：`src/components/crud/CrudPage.tsx`。

- 分页：总数缩水时把越界页码拉回最后一页（用 `isSuccess` 避免加载中 `total=0` 把用户刚翻的页重置）；筛选状态与 `setPage(1)` 同批更新，去掉“新条件 + 旧页码”的中间请求。
- 请求竞态：编辑详情、树形删除预检各加递增令牌，后发先至的旧响应直接丢弃；关闭删除弹窗时令牌失效，响应回来不会重新弹窗。
- 排序：`reorder` 用 `sortBusyRef` 串行化，连续点上移/下移或拖拽不会并发覆盖；失败仍回读服务端顺序。
- 搜索键盘：Enter 立即查询（兼容中文输入法 `isComposing`），Esc 立即清空；清除按钮点击区域从 `p-0.5` 提到 `p-1`。
- 空态/错误文案：区分“暂无数据”和“没有匹配的记录”，带出关键字与筛选条件；列表错误显示后端原因并保留重试。
- 表格：横向滚动 + **首列固定**（有排序列时固定排序列，否则固定第一数据列）；数字列自动右对齐 + `tabular-nums`；新增 `CrudColumn.truncate`，备注/路径等超长文案单行省略并 `title` 显示全文；表头/行操作按钮增加可访问名称。
- 表单失败提示、删除失败提示改为带实体名与服务端原因，不再只写“失败”。

### 1.3 展示精确化（按页面）

- `src/pages/UsersPage.tsx`：分组名缺失时由 `分组 <短 ID>` 改为 `shortId`，不再显示半截 `#ID`；角色抽屉切换用户时清空勾选，批量保存部分失败后回读真实绑定。
- `src/pages/RolesPage.tsx`：分组外键同样走 `shortId`；授权抽屉切换角色时清空勾选；批量授权部分失败后回读；授权成功额外失效首页缓存。
- `src/pages/AppsPage.tsx`、`MenusPage.tsx`、`PermissionsPage.tsx`、`RoleGroupsPage.tsx`、`PermissionGroupsPage.tsx`：外键未解析时统一 `shortId`，空值 `--`；备注/路径列开启 `truncate`。
- `src/pages/RealmsPage.tsx`、`RolesPage.tsx`、`RoleGroupsPage.tsx`、`PermissionGroupsPage.tsx`：备注列单行省略。
- `src/components/dashboard/WidgetRenderer.tsx`：空值占位由 `—` 统一为 `--`。
- `src/pages/DashboardPage.tsx`：配置 ID 改短 ID（悬浮看全量）；底部“全局数据”不再写死，按 `anyScopeAware` 显示“全局数据 / 未启用数据范围”。
- `src/pages/DashboardConfigPage.tsx`：配置未读完时禁用保存，避免空草稿覆盖线上配置；切换目标且存在未保存修改时二次确认；读取失败显示具体原因 + 重试。
- `src/lib/http.ts`：HTTP 401 / 403 且后端无 `msg` 时给出“登录状态已失效 / 无操作权限”，不再只显示状态码。
- `src/components/ui/primitives.tsx`：`size="sm"` 按钮高度 28px → 32px，改善触摸端点击区域；`AppShell` 移动端菜单按钮补到 36×36。

## 2. 问题清单与状态

### 阻塞（已修）

| 问题 | 状态 | 关键位置 |
| --- | --- | --- |
| 权限前缀误判，`GET:/adm/role` 命中 `role-group` 等 | 已修 + 单测 | `src/auth/perm.ts` |
| 切账号后 dashboard / 列表沿用上一账号缓存 | 已修 | `AuthContext.tsx`、`DashboardPage.tsx` |
| 未注册组件的菜单仍出现在侧栏 | 已修 | `pages/registry.ts`、`layout/nav.ts` |
| `/me` 加载中或失败时深链直接 404/空菜单 | 已修 | `App.tsx` |
| CrudPage 编辑详情、删除预检“后发先至” | 已修 | `CrudPage.tsx` |
| 筛选切换先用旧页码发一次请求 | 已修 | `CrudPage.tsx` |
| 配置未加载完可保存空草稿覆盖 | 已修 | `DashboardConfigPage.tsx` |
| 连续排序产生并发 reorder | 已修 | `CrudPage.tsx` |

### 应修（已修）

- 删除最后一页最后一条后页码不回收 → 已加页码 clamp。
- 用户-角色 / 角色授权抽屉切换对象时残留上一对象的勾选 → 已重置并回读。
- 批量授权部分成功但界面不回读 → 失败后 `refetch`。
- 外键为空或未解析显示 `#空ID` / 半截 ID → 统一 `--` / `shortId`。
- 超长备注撑宽表格、数字不右对齐、首列滚动后丢失 → 已修。
- 错误与空态文案泛化 → 已带出具体实体、关键字、筛选与后端原因。
- 搜索行只支持 Esc、不支持 Enter → 已补齐。
- Dashboard 配置读取失败无重试 → 已补齐。

### 可接受 / 未做

| 项 | 原因 |
| --- | --- |
| 菜单父节点下拉未按当前 `appId` 过滤 | CrudPage 表单字段是静态 schema，需要“依赖字段/异步 options 随表单值变化”的扩展；后端会拒绝跨应用父节点。改动面超出本轮体检范围。 |
| 三层及以上菜单在侧栏分组退化到“其他” | 现有 `nav.ts` 只按 `treeCode` 长度 3/6 分两级；路由本身仍全部可用。需要产品确定侧栏是否支持多级折叠。 |
| 401 只提示，不自动清会话/跳登录 | 需要全局鉴权事件与路由联动，本轮只精确化错误文案，避免擅自改变登录态行为。 |
| Dashboard 配置拖拽在触屏上依赖 HTML5 drag | 同页已有上移/下移按钮可用；重写为 Pointer Events 超出本轮范围。 |
| 权限 URN 通配符（如 `*:/adm/**`） | 前端按字面路径段匹配；当前后端下发的 URN 为具体方法+路径。若未来引入通配符，需要后端确认语义后再扩展。 |

## 3. 验证

- `pnpm typecheck`：通过。
- `pnpm test`：**5 个文件 / 30 个用例全部通过**，含新增 `src/auth/perm.test.ts` 3 个权限边界用例。
- `pnpm build`：通过，`dist/assets/index-WJrORfPX.js` 443.80 kB（gzip 136.47 kB）。
- 真实链路：`adm-svr` 二进制以 `adm-svr.toml` 在 **9007** 启动，Vite 在 **5181**（该端口已有同项目 dev server，热更新生效；另起的 5182 实例已关闭），用浏览器实测：
  - `admin / admin123` 登录成功落 `/dashboard`，侧栏显示 9 个菜单项，无鉴权错误；
  - `/users` 表格正常加载 3 条；搜索框输入 `admin` 按 Enter 未点按钮即变为 1 条，按 Esc 恢复 3 条；每页条数 10/20/50/100 可见且分页文本一致；
  - `/dashboard` 渲染 6 张 widget 卡片；`/dashboard-config` 正常加载 6 条配置，加载完成后保存按钮可用，无错误横幅。
- 验证后已停止本轮启动的 9007 后端；5181 为既有进程，未处置。

## 4. 未做项

- 未做“切换第二个账号后 dashboard 内容变化”的真实账号级 E2E：需要额外账号且会写入角色/菜单数据；本轮用登录/登出清缓存 + `userId` 查询键修复，并由代码路径确认。
- 未做“仅有 role-group 权限、无 role 权限”的真实权限门禁 E2E：需要构造最小角色授权数据；已用 `perm.test.ts` 覆盖误命中场景。
- 未做拖拽排序、树形级联删除的真实 UI E2E：会改动排序与菜单数据；后端语义已在上一轮集成测试覆盖，本轮只补前端竞态与确认框逻辑。
- 未做移动端真机视觉走查：仅完成代码层可点区域、横向滚动、首列固定与响应式类调整。

## 5. 后端配合清单

本轮**没有必须的后端接口改动**。唯一待确认项：权限 URN 是否会出现通配符；若会，前端边界匹配需按后端约定扩展，否则不需要动 Rust。
