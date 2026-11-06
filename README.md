# Adm

基于 Rust 生态的管理后台服务系统，提供用户、角色、菜单的 CRUD 与检索能力，通过 RESTful API
对外提供服务。当前是**骨架版本**：分层、配置、迁移、文档与宏用法都已就位，业务规则只做了
最基础的几条（口令摘要、父子校验、删除前置检查）。

## 项目结构

```
adm-rs/
├── Cargo.toml              # 工作区配置
├── adm-api/                # 共享数据类型 (DTO / VO / MO / DIC)
│   └── src/
│       ├── dic/            # 字典枚举（序列化为整数）
│       ├── dto/            # 数据传输对象 (Data Transfer Object)
│       ├── vo/             # 视图对象 (View Object)
│       └── mo/             # 模型对象 (Model Object, SeaORM 实体)
├── adm-api-client/         # API 客户端（Feign，支持服务发现）
│   └── src/
│       └── api_client/     # 用户 / 角色 / 菜单 的 API 客户端
├── adm-svr/                # 服务端应用
│   ├── migrations/         # 数据库迁移文件
│   │   └── pgsql/
│   └── src/
│       ├── config/         # 应用配置 (AppConfig / AdmConfig)
│       ├── dao/            # 数据访问层 (基于 SeaORM)
│       ├── svc/            # 业务逻辑层
│       ├── utils/          # 配置装配、口令摘要
│       ├── web/            # Web 层
│       │   ├── api_doc/    # OpenAPI 文档
│       │   ├── ctrl/       # 控制器
│       │   └── router/     # 路由
│       ├── lib.rs
│       └── main.rs         # 应用入口
├── doc/                    # 建模与运维文档
│   ├── PowerDesigner建模指南/
│   └── 升级数据库.adoc
└── model/                  # PowerDesigner 模型产物
    └── create-table-pgsql.sql
```

## 核心功能

### 用户 (User)
- 账号 / 昵称 / 手机号 / 邮箱 / 头像 / 状态
- 口令加盐摘要落库，查询接口不返回口令
- 「重置口令」独立接口，把口令换回配置里的默认值
- 删除角色前检查是否还有用户挂着

### 角色 (Role)
- 编码 / 名称双唯一
- 可见范围：领域 / 组织 / 应用三条独立轴的白名单（`adm_role_realm_scope` / `adm_role_org_scope` / `adm_role_app_scope`），只管「能看哪些」，功能权限由角色菜单 / 权限决定
- 排序与启用状态

### 菜单 (Menu)
- 目录 / 菜单 / 按钮三种节点共用一张表，`parent_id` 自关联成树
- 编码唯一，作为权限标识的唯一来源
- 写入前校验父节点存在、禁止把自己挂到自己下面
- 按钮节点强制 `visible = false`
- 删除前检查子节点

## 技术栈

| 类别 | 技术 |
|------|------|
| Web 框架 | [Axum](https://github.com/tokio-rs/axum) 0.8 |
| 异步运行时 | [Tokio](https://tokio.rs/) 1.x |
| ORM | [SeaORM](https://www.sea-ql.org/SeaORM/) 2.0 |
| API 文档 | [utoipa](https://github.com/juhaku/utoipa) + Swagger UI |
| 微服务框架 | [robotech](https://github.com/rusthing/robotech-rs) |
| 序列化 | [serde](https://serde.rs/) + [serde_json](https://github.com/serde-rs/json) |
| 配置管理 | [config](https://github.com/mehcode/config-rs) |
| 命令行 | [clap](https://docs.rs/clap/latest/clap/) |
| 日志 | [tracing](https://github.com/tokio-rs/tracing) |
| 数据库 | PostgreSQL（也支持 MySQL / SQLite） |
| 服务注册 | Consul / Etcd / Nacos |

## 快速开始

### 前置条件

- [Rust](https://www.rust-lang.org/) 1.85+（edition 2024）
- PostgreSQL 数据库
- （可选）Consul 用于服务注册与配置中心

### 数据库准备

```sql
CREATE USER adm WITH PASSWORD 'adm';
CREATE DATABASE adm OWNER adm;
```

建表与初始化数据由迁移自动执行，也可以手工跑一遍：

```bash
psql -U adm -d adm -f model/create-table-pgsql.sql
psql -U adm -d adm -f adm-svr/migrations/pgsql/20261027082000_init-data.sql
```

### 配置

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

### 编译与运行

```bash
# 编译
cargo build --release --all-features

# 运行
cargo run --release --all-features

# 指定配置文件
cargo run --release --all-features -- --config-file /path/to/config.toml

# 指定端口
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

服务启动后，Swagger UI 按模块分开挂载：

| 模块 | Swagger 地址 |
|------|--------------|
| 用户 | `http://localhost:9007/swagger-ui`（`/adm/user/openapi.json`） |
| 角色 | `/adm/role/openapi.json` |
| 菜单 | `/adm/menu/openapi.json` |

### 用户 (User)

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/adm/user` | 新增用户 |
| `PUT` | `/adm/user/{id}` | 修改用户 |
| `POST` | `/adm/user/save` | 无 id 则新增；有 id 则修改（记录不存在直接报错） |
| `POST` | `/adm/user/upsert` | 无 id 则新增；有 id 先改，记录不存在就按**同一个 id** 补建 |
| `POST` | `/adm/user/sync` | 带版本门槛的条件更新：传入 `updateMs` 严格大于存储值才写入，否则 0 行不报错（多源同步用） |
| `DELETE` | `/adm/user/{id}` | 按 ID 删除 |
| `GET` | `/adm/user/{id}` | 按 ID 查询 |
| `GET` | `/adm/user/list` | 条件查询列表 |
| `GET` | `/adm/user/page` | 条件分页查询 |
| `GET` | `/adm/user/search/list` | 检索列表（Bean Searcher 兼容参数） |
| `GET` | `/adm/user/search/page` | 检索分页 |
| `POST` | `/adm/user/{id}/reset-password` | 重置口令为默认值 |

### 角色 (Role) / 菜单 (Menu)

路径前缀分别为 `/adm/role` 与 `/adm/menu`，接口形状与用户完全一致（除 `reset-password`）。
完整清单见各自 Swagger 文档，或 `web/api_doc/` 下的定义。

### 检索参数

`/search/*` 系列沿用 Bean Searcher 的字段参数写法：

```
GET /adm/user/search/page?username-op=eq&username=admin&_page=1&_size=10&_orderBy=update_ms:desc
```

- 字段参数：`{field}` / `{field}-op`（运算符）/ `{field}-ic`（忽略大小写）
- 全局参数：`_page`（从 1 开始）/ `_size`（默认 10）/ `_orderBy`（**必须 snake_case**）/ `_keyword`

## 数据模型

### 角色 (adm_role)

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `i64` | 主键 |
| `code` | `String` | 角色编码（唯一） |
| `name` | `String` | 角色名称（唯一） |
| `sort` | `i32` | 排序 |
| `enabled` | `bool` | 启用 |
| `remark` | `Option<String>` | 备注 |

### 用户 (adm_user)

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `i64` | 主键 |
| `role_id` | `i64` | 角色ID（外键，`on delete restrict`） |
| `username` | `String` | 登录账号（唯一） |
| `nickname` | `String` | 昵称 |
| `password` | `Option<String>` | 加盐摘要，`NULL` 表示未设置口令 |
| `mobile` | `Option<String>` | 手机号（唯一，允许多行为空） |
| `email` | `Option<String>` | 邮箱 |
| `avatar` | `Option<String>` | 头像地址 |
| `status` | `i16` | 用户状态，见 `UserStatus` |
| `last_login_ms` | `Option<i64>` | 最近登录时间戳 |

### 菜单 (adm_menu)

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `i64` | 主键 |
| `parent_id` | `Option<i64>` | 父菜单ID（自关联，空为根） |
| `code` | `String` | 菜单编码（唯一） |
| `name` | `String` | 菜单名称 |
| `menu_type` | `i16` | 类型，见 `MenuType` |
| `path` / `component` / `perm` / `icon` | `Option<String>` | 前端路由、组件、权限标识、图标 |
| `sort` | `i32` | 排序 |
| `visible` | `bool` | 是否显示 |
| `enabled` | `bool` | 启用 |

> 所有实体均包含 `creater_id`、`create_ms`、`updater_id`、`update_ms` 审计字段。

## 使用 API 客户端

`adm-api-client` 提供了 Rust 语言的客户端，支持通过服务发现调用远程 adm 服务：

```rust
use adm_api_client::{get_adm_api_client, setup_adm_api_client};

setup_adm_api_client(apis_config, &None).await?;

let client = get_adm_api_client()?;
client.user.search_page_ex(params, None).await?;
client.role.page_by_query_dto(dto, None).await?;
```

## 约定与注意事项

- **路由前缀由结构体名推导**：`AdmUserCtrl` → `/adm/user`。名字的第一段是前缀，其余按
  短横线拼接，所以新增实体时结构体名必须写成 `Adm<Entity>Ctrl`。
- **一个 ctrl 模块只能被一棵路由树使用**：`#[router(crud)]` 与 `#[router(routes ...)]`
  各自生成一棵树，非 CRUD 接口要单独建 `*_ctrl.rs` + `*_router.rs` + `*_api_doc.rs`
  （参考 `adm_user_password_*`）。
- **`_orderBy` 必须 snake_case**：`add_order_by` 直接拼列名，与检索字段的 camelCase 支持不一致。
- **`U64` 在 JSON 里是裸数字**：雪花 ID 超过 2^53 会被 JS 丢精度，接前端时需评估是否改用字符串。
- **口令摘要用的是加盐 SHA-256**：骨架阶段够用，正式接入认证时应整体换成慢哈希
  （argon2 / bcrypt / pbkdf2），只需替换 `AdmPasswordUtils`。

## 下一步

骨架阶段刻意没做的部分，按建议顺序：

1. `adm-web` 前端（Vite + React + antd，独立部署，走 dev proxy 到 9007）
2. 登录与令牌：`/adm/auth/login`、JWT 签发与校验、失败锁定（把 `UserStatus::Locked` 用起来）
3. 角色 ↔ 菜单授权：新增 `adm_role_menu` 关联表 + 按角色查菜单树的接口
4. 可见范围管理界面：为三张 `adm_role_*_scope` 表提供配置入口（当前仅能通过初始化 SQL 写入）
5. 操作日志 `adm_oper_log`，由 `#[svc]` 的 `after_write` 钩子统一落库

## 许可证

MIT License
