# adm-svr

Adm 管理后台的服务端应用，基于 Rust 生态构建。提供用户、角色、菜单的 CRUD 与检索接口，
通过 RESTful API 对外服务。

## 功能特性

- **用户管理** - 账号 / 昵称 / 手机号 / 邮箱 / 状态；口令加盐摘要落库，查询不返回口令
- **角色管理** - 编码与名称双唯一、数据范围、排序与启用
- **菜单管理** - 目录 / 菜单 / 按钮三种节点一棵树，写入前校验父子关系
- **RESTful API** - 基于 Axum，`#[ctrl]` / `#[router(crud)]` 自动生成 21 个 CRUD 与检索接口
- **Swagger UI** - 每个模块一份 OpenAPI 文档
- **配置热更新** - 运行时自动检测并重载配置变更
- **信号控制** - start / restart / stop / kill
- **服务注册** - Consul / Etcd / Nacos
- **多数据库** - PostgreSQL / MySQL / SQLite

## 前端

前端 `adm-web`（尚未创建）独立运行，不随本服务一起部署。开发时用 Vite dev server
通过 `server.proxy` 把 `/adm` 前缀的请求转发到本服务（默认 9007），生产环境由网关或
静态托管自行转发。本服务只提供 RESTful API 与 Swagger UI。

## 项目结构

```
src/
├── config/                  # 应用配置
│   ├── app_config.rs        # 应用配置结构体（db / web / id-worker / redis / adm / api）
│   ├── adm_config.rs        # 业务配置（口令盐值、默认口令）
│   └── mod.rs
├── dao/                     # 数据访问层（基于 SeaORM）
│   ├── adm_menu_dao.rs
│   ├── adm_role_dao.rs
│   ├── adm_user_dao.rs
│   └── mod.rs
├── svc/                     # 业务逻辑层
│   ├── adm_menu_svc.rs
│   ├── adm_role_svc.rs
│   ├── adm_user_svc.rs
│   └── mod.rs
├── utils/                   # 配置装配、口令摘要
│   ├── adm_config_utils.rs
│   ├── adm_password_utils.rs
│   └── mod.rs
├── web/                     # Web 层
│   ├── api_doc/             # Swagger 文档定义
│   ├── ctrl/                # 控制器
│   ├── router/              # 路由（含装配自检单测）
│   └── mod.rs
├── lib.rs
└── main.rs                  # 应用入口
```

## 架构设计

分层架构，基于 [robotech](https://github.com/rusthing/robotech-rs) 宏驱动：

```
main.rs  ──→ config  (配置加载与热更新)
         ──→ dao     (SeaORM 数据访问)
         ──→ svc     (业务逻辑 + 写前钩子)
         ──→ web/ctrl (请求处理)
         ──→ web/router (路由注册)
         ──→ web/api_doc (OpenAPI 文档)
```

每个实体 8 个文件，`api` crate 里 3 个（dto / vo / mo），`svr` 里 5 个
（dao / svc / ctrl / router / api_doc）。加一个实体就是把这 8 个文件按同一命名规则补齐。

## 快速开始

### 数据库准备

```sql
CREATE USER adm WITH PASSWORD 'adm';
CREATE DATABASE adm OWNER adm;
```

### 配置

编辑 `adm-svr.toml`：

```toml
profile = "dev"

[db]
url = "postgresql://adm:adm@localhost:5432/adm"

[redis]
url = "redis://:xxxxxxxx@redis:6379"

[adm]
password-salt = "adm"
default-password = "123456"

[web]
port = 9007
```

### 编译与运行

```bash
cargo build --release --all-features
cargo run --release --all-features
cargo run --release --all-features -- --config-file /path/to/config.toml
cargo run --release --all-features -- --port 9007
```

### 信号控制

```bash
cargo run -- --signal start      # 启动 (默认)
cargo run -- --signal restart    # 优雅重启
cargo run -- --signal stop       # 优雅停止
cargo run -- --signal kill       # 强制终止
```

## API 接口

服务启动后访问 Swagger UI：`http://localhost:9007/swagger-ui`

| 模块 | 前缀 | 说明 |
|------|------|------|
| 用户 | `/adm/user` | CRUD + 检索 + `{id}/reset-password` |
| 角色 | `/adm/role` | CRUD + 检索 |
| 菜单 | `/adm/menu` | CRUD + 检索 |

以用户为例（其余两个模块形状一致）：

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/adm/user` | 新增 |
| `PUT` | `/adm/user/{id}` | 修改 |
| `POST` | `/adm/user/save` | 无 id 则新增；有 id 则修改（记录不存在直接报错） |
| `POST` | `/adm/user/upsert` | 无 id 则新增；有 id 先改，记录不存在就按**同一个 id** 补建 |
| `POST` | `/adm/user/sync` | 带版本门槛的条件更新：传入 `updateMs` 严格大于存储值才写入，否则 0 行不报错（多源同步用） |
| `DELETE` | `/adm/user/{id}` | 按 ID 删除 |
| `GET` | `/adm/user/{id}` | 按 ID 查询 |
| `GET` | `/adm/user/list` | 条件查询列表 |
| `GET` | `/adm/user/page` | 条件分页 |
| `GET` | `/adm/user/ex/{id}` | 按 ID 查询（带关联） |
| `GET` | `/adm/user/search/list` | 检索列表 |
| `GET` | `/adm/user/search/page` | 检索分页 |
| `POST` | `/adm/user/{id}/reset-password` | 重置口令 |

检索参数（Bean Searcher 兼容）：

```
GET /adm/user/search/page?username-op=eq&username=admin&_page=1&_size=10&_orderBy=update_ms:desc
```

## 配置说明

### AppConfig

| 配置项 | 说明 |
|--------|------|
| `db` | 数据库连接配置 |
| `web` | Web 服务器配置（端口、地址等） |
| `id-worker` | 分布式 ID 生成器配置 |
| `redis` | Redis 连接配置（骨架阶段只装配，未承载业务缓存） |
| `adm` | 管理后台业务配置 |
| `micro-svc` | 服务注册与配置中心（Consul / Etcd / Nacos） |

> 骨架阶段没有下游调用，因此**没有** `[api]` 配置段。接入 msg / oss / alarm 时再加
> `api: HashMap<String, ApiClientConfig>`，并在本 crate 的 `robotech` features 里补
> `"api-client"`（`ApiClientConfig` 由该 feature 提供）。

### AdmConfig

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `password-salt` | `String` | `adm` | 口令加盐的盐值，改动后旧口令全部失效 |
| `default-password` | `String` | `123456` | 重置口令时使用的默认值 |

## 业务规则

写在 `svc` 的写前钩子里，不散落在 ctrl 中：

| 实体 | 钩子 | 规则 |
|------|------|------|
| 角色 | `before_add` / `before_modify` | 编码与名称去首尾空白、非空 |
| 角色 | `before_del_by_id` | 还有用户挂着时拒绝删除 |
| 用户 | `before_add` | 账号与昵称非空、口令必填并摘要、角色必须存在 |
| 用户 | `before_modify` | 口令留空表示不改；角色变更时校验存在 |
| 菜单 | `before_add` / `before_modify` | 编码与名称非空、父节点存在、禁止自引用、按钮强制 `visible=false` |
| 菜单 | `before_del_by_id` | 还有子节点时拒绝删除 |

## 技术栈

| 类别 | 技术 |
|------|------|
| Web 框架 | [Axum](https://github.com/tokio-rs/axum) 0.8 |
| 异步运行时 | [Tokio](https://tokio.rs/) 1.x |
| ORM | [SeaORM](https://www.sea-ql.org/SeaORM/) 2.0 |
| SQL 驱动 | [sqlx](https://github.com/launchbadge/sqlx) 0.9 |
| API 文档 | [utoipa](https://github.com/juhaku/utoipa) + Swagger UI |
| 微服务框架 | [robotech](https://github.com/rusthing/robotech-rs) |
| 命令行 | [clap](https://docs.rs/clap/latest/clap/) |
| 日志 | [tracing](https://github.com/tokio-rs/tracing) |
| 配置管理 | [config](https://github.com/mehcode/config-rs) |
| 分布式 ID | [idworker](https://crates.io/crates/idworker) |
| 数据校验 | [validator](https://github.com/Keats/validator) |
| 口令摘要 | [sha2](https://crates.io/crates/sha2) + [hex](https://crates.io/crates/hex) |

## 许可证

MIT License
