//! # adm-api-client
//!
//! 管理后台的 Rust 客户端。基于 robotech 的 Feign 客户端，支持通过服务发现
//! （Consul / Etcd / Nacos）寻址，也支持直接给 `base-url` 直连。
//!
//! 用法见 [`api_client::AdmApiClient`]。

mod api_client;

pub use adm_api::*;
pub use api_client::*;
