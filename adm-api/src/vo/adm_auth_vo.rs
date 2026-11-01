//! # 认证 VO
//!
//! 登录换回来的令牌与登出结果。这两个结构不挂在实体表上，所以不用 `#[vo]`
//! （那个宏要配套的 `mo::Xxx`），手写保持与其它 Vo 一致的序列化形态：
//! `u64` 走 `u64_serde` 序列化成字符串，避免 JS 丢精度。

use serde::{Deserialize, Serialize};
use serde_with::skip_serializing_none;
use utoipa::ToSchema;
use wheel_rs::serde::u64_serde;

/// # 登录结果
#[skip_serializing_none]
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AdmLoginVo {
    /// 访问令牌（JWT）
    ///
    /// 后续请求放请求头：`Authorization: Bearer <token>`。
    pub token: String,
    /// 令牌类型，固定 `Bearer`，配合请求头使用
    pub token_type: String,
    /// 令牌到期时间戳（毫秒）
    ///
    /// 到期后令牌自动失效，前端应在此之前重新登录；服务端不做续期。
    #[serde(with = "u64_serde")]
    pub expire_ms: u64,
    /// 用户 ID
    #[serde(with = "u64_serde")]
    pub user_id: u64,
    /// 登录名
    pub name: String,
    /// 昵称
    pub nick_name: Option<String>,
    /// 是否仍是初始口令
    ///
    /// `true` 时前端应强制跳转改密页面：初始口令是管理员重置出来的，
    /// 不换掉等于谁都能进。
    pub login_pswd_default: bool,
    /// 本次登录的会话 ID（`adm_login_log.id`）
    ///
    /// 登出时服务端按它回写 `logout_ms`，客户端不需要传，留在响应里是为了排查
    /// 「某个会话什么时候结束的」。
    #[serde(with = "u64_serde")]
    pub login_log_id: u64,
}

/// # 登出结果
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AdmLogoutVo {
    /// 会话结束时间戳（毫秒）
    #[serde(with = "u64_serde")]
    pub logout_ms: u64,
    /// 会话 ID（`adm_login_log.id`）
    #[serde(with = "u64_serde")]
    pub login_log_id: u64,
}
