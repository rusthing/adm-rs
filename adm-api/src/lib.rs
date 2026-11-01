//! # adm-api
//!
//! 管理后台的共享类型库，被 `adm-svr`（服务端）与 `adm-api-client`（客户端）同时依赖。
//!
//! ## 模块
//! * [`dic`] - 字典枚举，序列化为整数判别式
//! * [`dto`] - 写请求参数（`#[crud_dto]` 生成 Add / Modify / Save / Query 四类）
//! * [`vo`] - 读响应数据（`#[vo]` 生成 Vo / ExVo 两类）
//! * `mo` - SeaORM 实体，仅 `server` feature 下编译
//!
//! ## feature
//! * 默认（无 feature） - 只含 `dic` / `dto` / `vo`，供客户端使用
//! * `server` - 额外启用 `mo`，并带上 `sea-orm` / `o2o` / `validator`

pub mod dic;
pub mod dto;
pub mod vo;

#[cfg(feature = "server")]
pub mod mo;
