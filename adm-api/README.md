# adm-api

Adm 项目的共享数据类型库，为 `adm-svr`（服务端）和 `adm-api-client`（客户端）提供统一的
DIC、DTO、VO 和 MO 类型定义。

## 功能

- **DIC** - 字典枚举，序列化为整数判别式，用于状态、类型这类有限取值
- **DTO** (Data Transfer Object) - 写请求参数，`#[crud_dto]` 生成 Add / Modify / Save / Query 四类
- **VO** (View Object) - 读响应数据，`#[vo]` 生成 Vo / ExVo 两类
- **MO** (Model Object) - SeaORM 实体模型（需开启 `server` feature）

## 模块结构

```
src/
├── dic/                    # 字典枚举
│   ├── data_scope.rs       # 数据范围
│   ├── menu_type.rs        # 菜单类型
│   └── user_status.rs      # 用户状态
├── dto/                    # 写请求参数
│   ├── adm_menu_dto.rs
│   ├── adm_role_dto.rs
│   └── adm_user_dto.rs
├── vo/                     # 读响应数据
│   ├── adm_menu_vo.rs
│   ├── adm_role_vo.rs
│   └── adm_user_vo.rs
├── mo/                     # 数据库实体（仅 server feature）
│   ├── adm_menu.rs
│   ├── adm_role.rs
│   ├── adm_user.rs
│   └── prelude.rs
└── lib.rs
```

## Features

| Feature | 说明 | 引入的依赖 |
|---------|------|-----------|
| `server` | 启用服务端相关功能，包括 SeaORM 实体、对象映射和校验 | `sea-orm`、`o2o`、`validator`、`robotech/orm` |

## 使用

### 作为客户端依赖（默认）

```toml
[dependencies]
adm-api = "1.0.0"
```

此时只含 `dic` / `dto` / `vo`，适用于 API 客户端场景。

### 作为服务端依赖

```toml
[dependencies]
adm-api = { version = "1.0.0", features = ["server"] }
```

额外包含 `mo` 模块（SeaORM 实体），支持完整的数据库操作与对象映射。

## 编写约定

### DTO

```rust
#[crud_dto]
pub struct AdmUserDto {
    /// 登录账号（唯一）
    /// @len 3..=50
    pub username: String,
    /// 口令（新增必填；修改时留空表示不修改）
    /// @len 0..=64
    pub password: Option<String>,
    /// 状态
    #[db_default]
    pub status: UserStatus,
}
```

- 结构体名必须以 `Dto` 结尾，模块名由名字推导（`adm_user_dto.rs`）
- 不要写 `id` 字段：宏会跳过它，主键由 `ModifyDto` / `SaveDto` 自带
- `@len` / `@range` 写在文档注释里，`@len` 只能用于 `String` / `Option<String>`，
  `@range` 只能用于数值字段
- `#[db_default]` 表示「新增时可以不传，交给数据库默认值」，同时跳过必填校验
- 可空列在生成的 Add / Modify DTO 里是 **`Option<Option<T>>`**：`None` 表示不改，
  `Some(None)` 表示置 `NULL`，`Some(Some(v))` 表示写入

### VO

```rust
#[vo]
pub struct AdmUserVo {
    pub id: u64,
    pub status: UserStatus,
}
```

- `u64` 会被映射成 `U64` 包装类型（`U32` / `U16` / `U8` 同理），用于避免 JSON 精度问题
- 字段类型以 `Vo` 结尾时会自动变成 `ExVo`，并且只出现在 ExVo 里
- 被 VO 使用的字典枚举必须声明 `#[dic(default = ...)]`

### DIC

```rust
#[dic(default = Normal)]
pub enum UserStatus {
    Normal = 1,
    Disabled = 2,
}
```

- 判别式即落库值（`INT2`），不要随意改动已有取值
- 必须实现 `Display` / `EnumString` / `AsRefStr`（`strum` derive）

## 许可证

MIT License
