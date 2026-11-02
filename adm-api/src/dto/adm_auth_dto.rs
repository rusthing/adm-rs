//! # 认证 DTO
//!
//! 登录只有一条写请求，不挂在某张实体表上，所以不走 `#[crud_dto]`——那是给
//! 「一张表一套 CRUD」用的，这里手写反而更清楚。
//!
//! ## 为什么写成两份
//!
//! `validator` 只在 `server` feature 下是依赖，而 `adm-api-client` 用的是无
//! feature 的版本。`#[cfg_attr(feature = "server", derive(Validate))]` 这种写法
//! **不成立**：`#[validate(...)]` 是 derive 宏注册的辅助属性，由 `cfg_attr`
//! 生成的 derive 不会被识别（rustc 的已知限制）。所以照 `#[crud_dto]` 的做法，
//! 按 feature 各写一份结构体，字段名与含义两边保持一致。

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// # 登录请求（服务端）
///
/// ## 口令的传递约定
///
/// `login_pswd` **不是明文**，是前端已经算过一次的 `SM3(明文)`（64 位十六进制）。
/// 服务端再拼上该账号的密码组合码做第二次 SM3 后与库里的值比对：
///
/// ```text
/// 库里存的 = SM3( 小写(SM3(明文)) + 小写(密码组合码) )
/// ```
///
/// 这样明文与「一次摘要」都不会落库：拿到库里的值也登不进来。
///
/// ## 为什么不校验 `login_pswd` 的格式
///
/// 登录是「拿已有的口令来换令牌」，不是「设置新口令」。加大小写/字符种类要求
/// 只会把历史口令挡在门外，还顺手把口令规则告诉了攻击者。这里只限长度。
#[cfg(feature = "server")]
#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema, validator::Validate)]
#[serde(rename_all = "camelCase")]
pub struct AdmLoginDto {
    /// 账号标识
    ///
    /// 可以是登录名、手机号、邮箱或身份证号中的任意一个：四列各有唯一约束，
    /// 命中多个账号时服务端会拒绝，让用户改用登录名。
    #[serde(default)]
    #[validate(length(min = 1, max = 50))]
    pub account: String,
    /// 口令的一次摘要
    ///
    /// 前端 `SM3(明文)` 的十六进制结果，定长 64。传明文会因长度不符被拒，
    /// 这也提醒调用方「别把明文发过来」。
    #[serde(default)]
    #[validate(length(min = 64, max = 64))]
    pub login_pswd: String,
}

/// # 登录请求（客户端）
///
/// 字段与含义同服务端版本，只是没有 `validator` 依赖。
#[cfg(not(feature = "server"))]
#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AdmLoginDto {
    /// 账号标识（登录名 / 手机号 / 邮箱 / 身份证号之一）
    #[serde(default)]
    pub account: String,
    /// 口令的一次摘要：`SM3(明文)` 的十六进制结果，定长 64
    #[serde(default)]
    pub login_pswd: String,
}

/// # 修改口令请求（服务端）
///
/// 个人中心专用。与 `PUT /adm/user` 的区别：
/// * 只改当前登录人自己的登录口令，不接受 `id` 参数
/// * 必须提供旧口令，防止令牌被借用后直接换掉口令
/// * 不改审核 / 支付口令
///
/// `old_pswd` 与 `new_pswd` 都是前端算好的一次摘要 `SM3(明文)`。
#[cfg(feature = "server")]
#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema, validator::Validate)]
#[serde(rename_all = "camelCase")]
pub struct AdmChangePasswordDto {
    /// 旧口令的一次摘要
    #[serde(default)]
    #[validate(length(min = 64, max = 64))]
    pub old_pswd: String,
    /// 新口令的一次摘要
    #[serde(default)]
    #[validate(length(min = 64, max = 64))]
    pub new_pswd: String,
}

/// # 修改口令请求（客户端）
#[cfg(not(feature = "server"))]
#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AdmChangePasswordDto {
    /// 旧口令的一次摘要
    #[serde(default)]
    pub old_pswd: String,
    /// 新口令的一次摘要
    #[serde(default)]
    pub new_pswd: String,
}
