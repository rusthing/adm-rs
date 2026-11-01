//! # 常量
//!
//! 与框架常量（`robotech::cst`）区分：这里只放 adm 自身的业务常量。
//! 目前只有认证相关，后续有别的再按主题拆分文件。

mod adm_auth_cst;

pub use adm_auth_cst::*;
