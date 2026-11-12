# Adm

基于 Rust（robotech / SeaORM）的平台管理后台：账号与人员、组织、角色与授权、权限与菜单、
领域与应用、审计日志，以及按角色下发的首页配置。后端对外的 CRUD 与检索接口全部由宏生成，
前端 `adm-web` 是按后端下发的菜单树渲染的独立 SPA。

## 项目结构

```
adm-rs/
├── Cargo.toml              # 工作区配置
├── adm-api/                # 共享数据类型 (DTO / VO / MO / DIC)
│   └── src/
│       ├── dic/            # 字典枚举（序列化为整数）
│       ├── dto/            # 数据传输对象（含 @len / @range / @check 校验标签）
│       ├── vo/             # 视图对象（列表 VO 对敏感字段做等长遮蔽）
│       └── mo/             # 模型对象（SeaORM 实体）
├── adm-api-client/         # API 客户端（Feign，支持服务发现）
├── adm-svr/                # 服务端应用
│   ├── migrations/pgsql/   # 迁移基线三件套：建表 / 建索引 / 种子
│   └── src/
│       ├── config/         # AppConfig / AdmConfig
│       ├── dao/            # 数据访问层（唯一键、模糊检索列、关联定义）
│       ├── svc/            # 业务逻辑层
│       ├── utils/          # 配置装配、口令摘要、JWT 令牌、选项缓存
│       └── web/            # ctrl / router / api_doc
├── adm-web/                # 前端（Vite + React 19 + Tailwind 4 + react-query）
├── doc/                    # 建模指南、升级数据库、排序规范、首页 widget 接口清单
└── model/                  # PowerDesigner 逻辑 / 物理模型 + 导出的 DDL
    ├── adm-rs.ldm
    ├── adm-rs-pgsql.pdm
    └── create-table-pgsql.sql
```

## 核心模型

### 账号（`adm_user`）与人员（`adm_person`）

- **人员是自然人主数据**（姓名 / 拼音 / 证件 / 联系方式），不能登录；
  账号是能登录的凭据，通过 `user.person_id` 回指人员。
- 一个自然人可以有多个账号；`person_id` 为空表示**纯账号**（外部认证、系统账号、机器人）。
- 实名信息（`real_name` + `id_card`）与核验位放在账号上，因为核验以登录主体为单位；
  `person` 上同一份数据由核验流程在同一事务里一起写。
- 三套口令（登录 / 审核 / 支付）相互独立：落库值 = `SM3(小写(SM3(明文)) + 组合码)`，
  内层摘要由前端算（明文不过网），6 位组合码由服务端在设置口令时生成。
- 列表接口（`page` / `list` / `search`）返回**遮蔽后**的手机 / 邮箱 / 身份证 / 姓名，
  单条详情才回显原值。

### 组织（`adm_org`）

- 全局一棵树，层级由 `tree_code` 表达（每层 3 位，全局唯一）；类型来自 `adm_org_type`。
- 成员关系在 `adm_org_user`（组织 ↔ 账号多对多），领域归属在 `adm_realm_org`。

### 领域（`adm_realm`）与应用（`adm_app`）

- 领域是**数据域**：只决定「账号 / 组织属于哪个域」，靠 `adm_realm_user` / `adm_realm_org`
  多对多绑定，表上不存领域列。
- 应用是**功能域**：菜单树按应用隔离，应用、菜单、角色、权限都是全局配置，与领域无关。
- 种子：领域 `platform`（平台）、应用 `adm`（平台管理）。

### 角色与授权

- `adm_role_group` 是角色分组树；角色挂在分组下。
- 授权四张关系表：`adm_role_user`（谁有该角色）、`adm_role_menu`（能看见哪些菜单）、
  `adm_role_perm`（能调哪些接口）、`adm_role_*_scope`（领域 / 组织 / 应用三条可见范围轴）。
- 菜单授权**必须包含祖先**：只给子菜单不给父目录，侧栏里它就挂不上；种子已按此校验。

### 权限（`adm_perm`）与权限分组（`adm_perm_group`）

- 权限的 URN 形如 `GET:/adm/user`（`方法:路径`），是接口级鉴权的唯一来源。
- `subject_code` 记录**权限作用的对象**（`user` / `person` / `org` / `role` / `menu` /
  `perm` / `realm` / `app` / `login_log` …共 26 个），因此权限名称只写动作
  （`按条件删除`），不再带「用户-」这类前缀。
- 权限分组是一棵树，种子按四层组织：
  `平台管理(001)` → `菜单一级(001002…)` → `主体(9 位)` → `操作类型(12 位)`，
  共 155 个分组承载 555 个权限点。层级不写死在代码里，由 `tree_code` 表达。
- 前端授权抽屉按「主体 → 操作类型」两段展示，主体段可一键整段授予。

### 菜单（`adm_menu`）

- `tree_code` 表达层级（每层 3 位），在**应用内**唯一；`component` 为空即目录节点，
  非空且已在前端 `pages/registry.ts` 登记才可点。
- 种子有五个一级：概览 / 组织与人员 / 角色与授权 / 系统配置 / 审计日志。
- 一级菜单的顺序决定侧栏分组顺序（按 `tree_code` 升序）。

### 审计与首页

- `adm_login_log`（会话起止）、`adm_op_log`（谁在什么时候调了哪个接口）、
  `adm_lock_log`（锁定与解锁原因）三个只读视图。
- `adm_dashboard` / `adm_dashboard_widget` / `adm_widget_endpoint` 决定每个角色看到什么首页：
  按角色优先级取第一份配置，未命中回落到全局模板；单个卡片失败只降级自身。

## 技术栈

| 类别 | 技术 |
|------|------|
| Web 框架 | [Axum](https://github.com/tokio-rs/axum) 0.8 |
| 异步运行时 | [Tokio](https://tokio.rs/) 1.x |
| ORM | [SeaORM](https://www.sea-ql.org/SeaORM/) 2.0 |
| API 文档 | [utoipa](https://github.com/juhaku/utoipa) + Swagger UI |
| 微服务框架 | [robotech](https://github.com/rusthing/robotech-rs) |
| 序列化 | [serde](https://serde.rs/) + [serde_json](https://github.com/serde-rs/json) |
| 配置 / 缓存 | [config](https://github.com/mehcode/config-rs) + Redis |
| 数据库 | PostgreSQL |
| 前端 | Vite 7 + React 19 + Tailwind 4 + TanStack Query 5 |

## 快速开始

### 前置条件

- [Rust](https://www.rust-lang.org/) 1.85+（edition 2024）
- PostgreSQL、Redis（令牌黑名单）
- Node 20+（前端）
- （可选）Consul 用于服务注册与配置中心

### 数据库准备

```sql
CREATE USER adm WITH PASSWORD 'adm';
CREATE DATABASE adm OWNER adm;
```

迁移基线三份文件必须按顺序执行（也可交给迁移器自动跑）：

```bash
psql -U adm -d adm -f adm-svr/migrations/pgsql/20261109000000_create-table.sql
psql -U adm -d adm -f adm-svr/migrations/pgsql/20261109000001_create-index.sql
psql -U adm -d adm -f adm-svr/migrations/pgsql/20261109000002_init-data.sql
```

`model/create-table-pgsql.sql` 是同一份建表 DDL 的模型导出，与 `20261109000000` 逐字节一致。

### 配置与运行

编辑 `adm-svr/adm-svr.toml`：

```toml
profile = "dev"

[db]
url = "postgresql://adm:adm@localhost:5432/adm"

[redis]
url = "redis://:xxxxxxxx@redis:6379"

[adm]
password-salt = "adm"          # 口令加盐，生产务必替换
default-password = "123456"    # 重置口令时的默认值

[web]
port = 9007
```

```bash
cargo run --release --all-features                        # 启动
cargo run --release --all-features -- --port 9007         # 指定端口
cargo run -- --signal restart|stop|kill                   # 优雅重启 / 停止 / 强杀
```

前端：

```bash
cd adm-web
npm install
npm run dev        # 走 dev proxy 到 9007
npm run build      # tsc --noEmit && vite build
npm test           # vitest
```

### 种子账号

| 登录名 | 说明 | 角色（菜单 / 权限点） |
|--------|------|------------------------|
| `admin` | 系统管理员，给客户管理员用，隐藏权限与菜单管理等易误操作入口 | 系统管理员（14 / 287） |
| `super` | 平台管理员，一般给运维 / 平台 owner | 平台管理员（22 / 555，全部） |
| `owl` | 审计员，只读登录 / 操作 / 锁定日志 | 审计员（6 / 50） |
| `system` | 纯账号，不关联人员，供开发环境系统账号调用 | 系统组（22 / 555，全部） |

另有「组织管理员」角色（10 / 149）留给按领域 / 组织 / 应用授权的客户侧管理员，种子里没有账号。
初始口令见 `[adm] default-password`，首次登录后应立刻修改（`login_pswd_default` 会提示）。

## API 接口

服务启动后，Swagger UI 按模块分开挂载（`/adm/user/openapi.json`、`/adm/perm/openapi.json` …）。

### 鉴权

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/adm/auth/login` | 登录名 / 手机 / 邮箱 + 口令，返回 JWT 与当前授权快照 |
| `POST` | `/adm/auth/logout` | 登出，`jti` 进 Redis 黑名单 |
| `GET` | `/adm/auth/me` | 当前账号、角色、权限 URN、可见范围、首页配置 |
| `POST` | `/adm/auth/change-password` | 修改登录口令 |
| `POST` | `/adm/auth/verify-password` | 校验当前口令（敏感操作前二次确认） |
| `POST` | `/adm/auth/verify-audit-password` | 校验审核口令，未设置时回落登录口令 |

### CRUD 与检索

每个实体都有同一套接口（以 `/adm/user` 为例）：`POST /`、`PUT /{id}`、`POST /save`、
`POST /upsert`、`POST /sync`、`DELETE /{id}`、`GET /{id}`、`GET /list`、`GET /page`、
`GET /search/list`、`GET /search/page`，树形实体另有 `GET /delete-preview/{id}` 与
`POST /reorder`。日志实体是只读的（`readonly` 路由）。

`/search/*` 沿用 Bean Searcher 的参数写法：

```
GET /adm/user/search/page?username-op=eq&username=admin&_page=1&_size=10&_orderBy=update_ms:desc
```

- 字段参数：`{field}` / `{field}-op`（运算符）/ `{field}-ic`（忽略大小写）
- 全局参数：`_page`（从 1 开始）/ `_size` / `_orderBy`（**必须 snake_case**）/ `_keyword`

## 约定与注意事项

- **路由前缀由结构体名推导**：`AdmUserCtrl` → `/adm/user`，所以新增实体必须写成
  `Adm<Entity>Ctrl`。
- **一个 ctrl 只能被一棵路由树使用**：非 CRUD 接口单独建 `*_ctrl.rs` + `*_router.rs` +
  `*_api_doc.rs`（参考 `adm_user_password_*`）。
- **`U64` 在 JSON 里是字符串**：雪花 ID 超过 2^53，前端类型里 ID 一律 `string`；
  反序列化同时接受字符串与数字。
- **改表 = 三件套一起改**：`model/*.ldm` + `*.pdm` + `create-table-pgsql.sql`，
  并同步 `adm-svr/migrations/pgsql/` 下的建表基线；实体层按
  mo → dto → vo → dao → svc → ctrl → router → api_doc 逐层对齐。
- **列注释就是校验契约**：`@len` / `@range` / `@unit` / `@check is_xxx` 是 DTO 校验的
  唯一来源，改列宽必须同步 `@len`。
- **`_orderBy` 必须 snake_case**：拼接的是列名，与检索字段的 camelCase 支持不一致。
- **口令是两级 SM3 而非慢哈希**：组合码只防「库泄露后直接重放」，真正的在线防线是
  登录失败锁定。换 argon2 需要前端协议一起改，属于另一件事。

## 已知缺口

- 领域成员（`adm_realm_user` / `adm_realm_org`）与角色可见范围（`adm_role_*_scope`）
  后端接口齐全，但前端还没有配置入口，目前只能走 SQL 或直接调接口。
- 组织成员（`adm_org_user`）同样没有界面；人员 ↔ 组织的关系暂时只能靠接口维护。

## 许可证

MIT License
