# 首页 widget 数据接口清单（各服务待补齐）

> 口径：adm-svr 只提供首页配置与 adm 自身域的 widget 数据；前端经 gatex-rs
> 网关按 `service` 并行直连各服务。**不做跨服务聚合，不转发 token。**
> 每个服务按同一契约暴露自己的统计端点，单卡片失败只降级自身。

## 统一契约

- 路由：`POST /{service}/widget-data/{endpoint}`
  - 例：`POST /adm/widget-data/stats.count`
  - 网关寻址沿用 gatex 的 `Service matcher`：`/{svc-name}` 前缀 + Consul 负载均衡。
- 请求体：
  ```json
  { "params": { "days": 7 }, "title": "可选标题" }
  ```
- 请求头：`X-User-Id: <当前用户 ID>`（robotech 既有约定，服务不校验权限，信任网关注入）。
- 响应：HTTP 200 + `Ro` 信封，`extra` 为统一 widget 数据信封：
  ```json
  {
    "widgetType": "kpi | trend | todo | recent_logs | shortcuts | my_permissions",
    "title": "卡片标题",
    "status": "ok | error | disabled | forbidden",
    "data": { },
    "error": "失败原因，可为空",
    "generatedMs": "毫秒时间戳（u64 按字符串序列化）"
  }
  ```
- 约定：
  - 失败也返回 HTTP 200，`status=error` + `error` 文案，前端显示「暂不可用」。
  - 单服务建议 P95 < 300ms；超时/限流由 gatex 收口。
  - 不返回 URL、连接串、凭据；不跨库查询。

## adm（已实现）

| endpoint | 类型 | params | data |
| --- | --- | --- | --- |
| `stats.count` | kpi | `metric`: users / roles / menus / perms / orgs / persons / realms / login_logs / op_logs | `{label,value,metric,path}` |
| `stats.trend` | trend | `days` 1..90、`metric`: login / op | `{days,metric,points:[{date,count}],total,today}` |
| `stats.todos` | todo | `{}` | `{items:[{code,label,count,path,severity}],total}`（初始口令 / 锁定 / 过期 / 停用账号） |
| `logs.recent` | recent_logs | `source`: login / op、`limit` | `{source,items:[{id,userId,userName,timeMs,ip,title,urn}]}` |
| `menu.shortcuts` | shortcuts | `{}` | `{items:[{id,label,path,icon,component}]}`（按当前用户菜单） |
| `auth.my_permissions` | my_permissions | `{}` | `{roleCount,permCount,menuCount,roles,scopes,scopeNote}` |

### adm 建议追加（待办类细化，供首页按卡片粒度配置）

| endpoint | 类型 | params | data | 说明 |
| --- | --- | --- | --- | --- |
| `todo.locked_account` | todo | `{}` | `{items:[{code:"locked",label,count,path,severity}],total}` | 锁定账号 |
| `todo.default_password` | todo | `{}` | `{items:[{code:"default_password",label,count,path,severity}],total}` | 初始口令未修改 |
| `todo.unbound_person` | todo | `{}` | `{items:[{code:"unbound_person",label,count,path,severity}],total}` | 无组织人员（persons 与 org 关系缺失） |
| `todo.no_account_person` | todo | `{}` | `{items:[{code:"no_account_person",label,count,path,severity}],total}` | 无账号人员（person 未绑定 adm_user） |

> 依据：组织、人员、账号数据都在 adm 域（`stats.count` 已含 persons / orgs），
> 因此这四类待办应由 adm-svr 提供，不需要其它服务跨库联查。

## jobx-svr（待补齐）

| endpoint | 类型 | params | data | 说明 |
| --- | --- | --- | --- | --- |
| `stats.today` | kpi | `{}` | `{label,value,metric,path}` | 今日任务执行数 / 失败数 |
| `stats.trend` | trend | `days`、`metric`: run / fail | `{days,metric,points,total,today}` | 近 N 日执行趋势 |
| `todo.my` | todo | `{}` | `{items, total}` | 我的待办：待审批、失败重跑、超时任务 |
| `recent.runs` | recent_logs | `limit` | `{items}` | 最近任务执行记录 |

## oss-svr（待补齐）

| endpoint | 类型 | params | data | 说明 |
| --- | --- | --- | --- | --- |
| `stats.storage` | kpi | `{}` | `{label,value,metric,path}` | 对象存储用量 |
| `stats.trend` | trend | `days`、`metric`: upload / download | `{days,metric,points,total,today}` | 上传 / 下载趋势 |
| `todo.pending` | todo | `{}` | `{items,total}` | 待处理上传 / 审核类待办 |
| `recent.uploads` | recent_logs | `limit` | `{items}` | 最近上传记录 |

> 「无组织人员 / 无账号人员」若需要 oss 侧人员数据，只由 oss 提供
> `stats.persons` 等自身统计；跨域关联不在服务端做，避免跨库。

## msg-svr（待补齐）

| endpoint | 类型 | params | data | 说明 |
| --- | --- | --- | --- | --- |
| `stats.today` | kpi | `{}` | `{label,value,metric,path}` | 今日发送量 / 失败量 |
| `stats.trend` | trend | `days` | `{days,metric,points,total,today}` | 近 N 日发送趋势 |
| `todo.unread` | todo | `{}` | `{items,total}` | 未读 / 失败重试待办 |
| `recent.messages` | recent_logs | `limit` | `{items}` | 最近消息记录 |

## 跨服务待办

最终架构下**没有跨服务聚合端点**。首页需要「跨服务待办汇总」时：

- 方案 A（推荐）：在首页配置里放多个 `todo` widget，每个指向一个服务的
  `todo.*` 端点，前端并行取数、逐卡片降级。
- 方案 B：由 gatex 未来提供聚合/编排能力时，再收口为单一卡片；当前不做。

## 各服务 client crate 补齐情况

- `adm-api-client`：已新增 `AdmDashboardApiClient`（`effective` / `widgetData` /
  配置 CRUD / `widgetTypes` / `endpoints`），并挂到 `AdmApiClient.dashboard`。
- `jobx-api-client` / `oss-api-client` / `msg-api-client`：当前只有 `#[feign]`
  生成的 CRUD 方法；待各自实现上表端点后，按 `AdmDashboardApiClient` 的写法
  新增 `widget_data(endpoint, user_id, ms, req)` 方法。
