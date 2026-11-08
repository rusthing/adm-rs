//! # 认证 VO
//!
//! 登录换回来的令牌与登出结果。这两个结构不挂在实体表上，所以不用 `#[vo]`
//! （那个宏要配套的 `mo::Xxx`），手写保持与其它 Vo 一致的序列化形态：
//! `u64` 走 `u64_serde` 序列化成字符串，避免 JS 丢精度。

use crate::vo::{AdmDashboardVo, AdmMenuVo, AdmPermVo, AdmRoleScopeVo, AdmRoleVo, AdmUserVo};
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
    /// 当前账号是否已设置审核口令
    ///
    /// 审核口令独立于登录口令；未设置时前端应提示先补充，否则删除校验等
    /// 需要「审核」语义的操作无法执行。
    pub audit_pswd_set: bool,
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

/// # 当前用户聚合信息
///
/// `/adm/auth/me` 的响应：一次把「我是谁、我的角色、我的权限、我的菜单」拿全，
/// 前端不再需要自己拼 role-user / role-menu / role-perm 三次查询。
///
/// 只包含启用状态的角色、权限与可见菜单，按角色并集去重。
#[skip_serializing_none]
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AdmMeVo {
    /// 当前用户资料（不含三套口令与盐值）
    pub user: AdmUserVo,
    /// 当前用户绑定的角色（仅启用的角色）
    pub roles: Vec<AdmRoleVo>,
    /// 当前用户拥有的权限（仅启用的权限，按角色并集去重）
    pub perms: Vec<AdmPermVo>,
    /// 当前用户可见的菜单（仅启用的可见菜单，按 `treeCode` 升序）
    pub menus: Vec<AdmMenuVo>,
    /// 权限 URN 列表
    ///
    /// 与 `perms` 的内容重复，单独给出是为了前端按前缀匹配时不用再 map 一次。
    pub perm_urns: Vec<String>,
    /// 当前用户的角色可见范围（领域 / 组织 / 应用三条轴）
    ///
    /// 三张 `adm_role_*_scope` 表合并下发；后端在 DAO 层按此范围强制过滤，
    /// 没配某一轴就表示该维度全量可见，配了才限制，多角色取并集。
    pub scopes: Vec<AdmRoleScopeVo>,
    /// 当前生效的首页配置
    ///
    /// 多角色按角色 `sort_order` 取第一份启用配置；都没有时回落全局模板。
    /// 已按 widget 的 `permUrn` 过滤，停用的 widget 不下发。
    pub dashboard: Option<AdmDashboardVo>,
}
