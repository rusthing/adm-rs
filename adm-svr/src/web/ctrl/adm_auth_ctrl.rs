//! # 认证控制器
//!
//! 登录 / 登出两个接口。这里**不用** `#[ctrl]` 宏：那个宏生成的是「一张表一套
//! CRUD」的 21 个方法，认证不属于任何一张表。手写两个处理器，路由与接口文档
//! 仍走 `#[router]` / `#[api_doc]`，和其它实体保持一样的注册方式。
//!
//! ## 客户端 IP
//!
//! 取自连进来的 `SocketAddr`（服务端用 `into_make_service_with_connect_info`
//! 启动），**不读** `X-Forwarded-For`：那个头客户端能随便写，写进 `login_ip`
//! 等于让审计字段失真。部署在反向代理后面时这里记到的是代理的 IP，
//! 要拿真实来源得先加「可信代理白名单」，属于网关侧的事。

use crate::cst::ADM_CODE_TOKEN_INVALID;
use crate::dto::{AdmChangePasswordDto, AdmLoginDto, AdmVerifyPasswordDto};
use crate::svc::AdmAuthSvc;
use crate::vo::{AdmLoginVo, AdmLogoutVo, AdmMeVo};
use crate::web::auth::{bearer_token, verify_bearer};
use axum::debug_handler;
use axum::extract::ConnectInfo;
use axum::http::HeaderMap;
use axum::response::Json;
use robotech::api::Ro;
use robotech::web::CtrlError;
use std::net::SocketAddr;

/// # 登录
///
/// 校验账号与口令，成功后签发令牌。业务失败（口令错、已锁定、已停用）
/// 返回 HTTP 200 + `Ro.code`，见 [`crate::cst`]。
///
/// ## 请求头
/// 无（这是唯一不需要 `X-User-Id` 的写接口）
///
/// ## 请求体
/// * `AdmLoginDto` - 账号标识 + 前端一次摘要
///
/// ## 返回值
/// * `Ro<AdmLoginVo>` - 令牌、到期时间、是否仍是初始口令
#[utoipa::path(
    post,
    path = "/adm/auth/login",
    request_body = AdmLoginDto,
    responses((status = OK, body = Ro<AdmLoginVo>))
)]
#[debug_handler]
#[allow(clippy::result_large_err)]
pub async fn login(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Json(dto): Json<AdmLoginDto>,
) -> Result<Json<Ro<AdmLoginVo>>, CtrlError> {
    let ro = AdmAuthSvc::login(dto, &addr.ip().to_string()).await?;
    Ok(Json(ro))
}

/// # 登出
///
/// 令牌立即作废（写 Redis 黑名单）并回写本次会话的登出时间。
///
/// ## 请求头
/// * `Authorization` - `Bearer <登录拿到的令牌>`
///
/// ## 返回值
/// * `Ro<AdmLogoutVo>` - 登出时间；令牌无效或已登出时 `Ro.code` 为
///   [`ADM_CODE_TOKEN_INVALID`]，HTTP 仍是 200
#[utoipa::path(
    post,
    path = "/adm/auth/logout",
    params(("Authorization" = String, Header, description = "Bearer <token>")),
    responses((status = OK, body = Ro<AdmLogoutVo>))
)]
#[debug_handler]
#[allow(clippy::result_large_err)]
pub async fn logout(headers: HeaderMap) -> Result<Json<Ro<AdmLogoutVo>>, CtrlError> {
    match bearer_token(&headers) {
        Some(token) => Ok(Json(AdmAuthSvc::logout(token).await?)),
        None => Ok(Json(
            Ro::warn("请求头缺少 Authorization".to_string())
                .code(Some(ADM_CODE_TOKEN_INVALID.to_string())),
        )),
    }
}

/// # 当前用户聚合信息
///
/// 返回当前令牌对应账号的资料、角色、权限与可见菜单。前端登录后调用它完成
/// 侧栏渲染与按钮级鉴权，不再依赖 `id=1 / name=admin` 之类的超管启发式。
///
/// ## 请求头
/// * `Authorization` - `Bearer <登录拿到的令牌>`
///
/// ## 返回值
/// * `Ro<AdmMeVo>` - 聚合结果
/// * `ADM00005` - 缺少令牌 / 令牌无效 / 已登出 / 已过期
#[utoipa::path(
    get,
    path = "/adm/auth/me",
    params(("Authorization" = String, Header, description = "Bearer <token>")),
    responses((status = OK, body = Ro<AdmMeVo>))
)]
#[debug_handler]
#[allow(clippy::result_large_err)]
pub async fn me(headers: HeaderMap) -> Result<Json<Ro<AdmMeVo>>, CtrlError> {
    // dev-bypass：前端不带令牌，直接按系统账号 0 返回菜单与权限。
    if crate::config::dev_bypass_enabled() {
        return Ok(Json(AdmAuthSvc::me(0).await?));
    }
    match verify_bearer(&headers).await {
        Ok(user_id) => Ok(Json(AdmAuthSvc::me(user_id).await?)),
        Err(detail) => Ok(Json(
            Ro::warn("未登录或令牌已失效".to_string())
                .code(Some(ADM_CODE_TOKEN_INVALID.to_string()))
                .detail(Some(detail)),
        )),
    }
}

/// # 修改当前用户登录口令
///
/// 个人中心专用接口：只改自己的登录口令，必须带旧口令。
/// 两个字段都是前端算好的一次摘要 `SM3(明文)`，与登录口令的既有约定一致。
///
/// ## 请求头
/// * `Authorization` - `Bearer <登录拿到的令牌>`
///
/// ## 请求体
/// * `AdmChangePasswordDto` - `oldPswd` / `newPswd`
///
/// ## 返回值
/// * `Ro<()>` - 修改成功
/// * `ADM00001` - 旧口令不正确
/// * `ADM00005` - 令牌无效
#[utoipa::path(
    post,
    path = "/adm/auth/change-password",
    request_body = AdmChangePasswordDto,
    params(("Authorization" = String, Header, description = "Bearer <token>")),
    responses((status = OK, description = "口令修改成功"))
)]
#[debug_handler]
#[allow(clippy::result_large_err)]
pub async fn change_password(
    headers: HeaderMap,
    Json(dto): Json<AdmChangePasswordDto>,
) -> Result<Json<Ro<()>>, CtrlError> {
    match verify_bearer(&headers).await {
        Ok(user_id) => Ok(Json(AdmAuthSvc::change_password(user_id, dto).await?)),
        Err(detail) => Ok(Json(
            Ro::warn("未登录或令牌已失效".to_string())
                .code(Some(ADM_CODE_TOKEN_INVALID.to_string()))
                .detail(Some(detail)),
        )),
    }
}

/// # 校验当前用户口令（高危操作二次确认）
///
/// 供其它服务在删除、发布、改权限等高风险动作前确认操作人身份。身份取
/// `Authorization: Bearer` 里的当前用户，请求体只带口令的一次摘要；
/// **不累加登录失败次数、不触发账号锁定、不创建会话、不刷新令牌**。
///
/// ## 请求头
/// * `Authorization` - `Bearer <登录拿到的令牌>`
///
/// ## 请求体
/// * `AdmVerifyPasswordDto` - `loginPswd`（`SM3(明文)`，64 位十六进制）
///
/// ## 返回值
/// * `Ro<()>` - 口令正确
/// * `ADM00005` - 令牌无效
/// * `ADM00007` - 口令不正确
/// * `ADM00008` - 错误尝试过于频繁
/// * `ADM00009` - 当前用户不可用（不存在 / 停用 / 锁定 / 过期）
#[utoipa::path(
    post,
    path = "/adm/auth/verify-password",
    request_body = AdmVerifyPasswordDto,
    params(("Authorization" = String, Header, description = "Bearer <token>")),
    responses((status = OK, description = "口令校验通过"))
)]
#[debug_handler]
#[allow(clippy::result_large_err)]
pub async fn verify_password(
    headers: HeaderMap,
    Json(dto): Json<AdmVerifyPasswordDto>,
) -> Result<Json<Ro<()>>, CtrlError> {
    match verify_bearer(&headers).await {
        Ok(user_id) => Ok(Json(AdmAuthSvc::verify_password(user_id, dto).await?)),
        Err(detail) => Ok(Json(
            Ro::warn("未登录或令牌已失效".to_string())
                .code(Some(ADM_CODE_TOKEN_INVALID.to_string()))
                .detail(Some(detail)),
        )),
    }
}
