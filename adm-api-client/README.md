# adm-api-client

Adm 服务的 Rust API 客户端库，基于 [robotech](https://github.com/rusthing/robotech-rs) 的
Feign 客户端实现，支持通过服务发现或直连方式调用远程 adm 服务。

## 功能

- 完整的用户 / 角色 / 菜单 RESTful API 客户端封装
- 支持 Consul / Etcd / Nacos 服务发现自动寻址
- 支持配置热更新，无需重启即可切换服务地址
- 复用 `adm-api` 的 DTO / VO / DIC 类型

## 模块结构

```
src/
├── api_client/
│   ├── adm_api_client_utils.rs     # 客户端聚合与初始化
│   ├── adm_menu_api_client.rs      # 菜单 API 客户端
│   ├── adm_role_api_client.rs      # 角色 API 客户端
│   ├── adm_user_api_client.rs      # 用户 API 客户端
│   └── mod.rs
└── lib.rs
```

## 使用

### 添加依赖

```toml
[dependencies]
adm-api-client = "1.0.0"
```

### 初始化客户端

```rust
use adm_api_client::{get_adm_api_client, setup_adm_api_client};
use robotech::api_client::ApiClientConfig;
use std::collections::HashMap;

let mut apis_config = HashMap::new();
apis_config.insert(
    "adm".to_string(),
    ApiClientConfig {
        base_url: "http://localhost:9007".to_string(),
        ..Default::default()
    },
);

setup_adm_api_client(apis_config, &None).await?;
let client = get_adm_api_client()?;
```

### 调用 API

```rust
// 用户
client.user.page_by_query_dto(query_dto, None).await?;
client.user.get_by_id(U64(1), None).await?;
client.user.search_page(params, None).await?;

// 角色
client.role.list_by_query_dto(query_dto, None).await?;

// 菜单
client.menu.search_list_ex(params, None).await?;
```

## API 客户端结构

```rust
pub struct AdmApiClient {
    pub user: AdmUserApiClient,   // 用户管理
    pub role: AdmRoleApiClient,   // 角色管理
    pub menu: AdmMenuApiClient,   // 菜单管理
}
```

## 注意事项

- 路由前缀由客户端结构体名推导：`AdmUserApiClient` → `/adm/user`，必须与服务端
  `AdmUserCtrl` 的命名严格一致
- 每个 `#[feign]` 客户端都实现了 `new(FeignApiClient)`，需要直连而不走服务发现时可以手工构造
- 手写接口（如 `POST /adm/user/{id}/reset-password`）不在 Feign 生成的 CRUD 方法里，
  需要调用方自己发请求，或在该客户端上补一个手写方法

## 技术栈

- [robotech](https://github.com/rusthing/robotech-rs) - Feign 客户端与服务发现
- [reqwest](https://github.com/seanmonstar/reqwest) - HTTP 客户端
- [serde](https://serde.rs/) / [serde_json](https://github.com/serde-rs/json) - 序列化
- [arc-swap](https://crates.io/crates/arc-swap) - 无锁配置热更新

## 许可证

MIT License
