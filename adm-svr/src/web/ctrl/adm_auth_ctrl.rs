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
use crate::dto::AdmLoginDto;
use crate::svc::AdmAuthSvc;
use crate::vo::{AdmLoginVo, AdmLogoutVo};
use axum::debug_handler;
use axum::extract::ConnectInfo;
use axum::http::HeaderMap;
use axum::http::header::AUTHORIZATION;
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
pub async fn logout(headers: HeaderMap) -> Result<Json<Ro<AdmLogoutVo>>, CtrlError> {
    match bearer_token(&headers) {
        Some(token) => Ok(Json(AdmAuthSvc::logout(token).await?)),
        None => Ok(Json(
            Ro::warn("请求头缺少 Authorization".to_string())
                .code(Some(ADM_CODE_TOKEN_INVALID.to_string())),
        )),
    }
}

/// # 从 `Authorization` 头里取裸令牌
///
/// ## 参数
/// * `headers` - 请求头
///
/// ## 返回值
/// * `Some(&str)` - 形如 `Bearer xxx` 时返回 `xxx`（去掉前后空白）
/// * `None` - 没有该头、方案不是 Bearer，或令牌为空
///
/// ## 说明
/// 方案名按 RFC 7235 大小写不敏感，`bearer` / `BEARER` 都收。
fn bearer_token(headers: &HeaderMap) -> Option<&str> {
    let raw = headers.get(AUTHORIZATION)?.to_str().ok()?;
    let (scheme, token) = raw.split_once(' ')?;
    if !scheme.eq_ignore_ascii_case("bearer") {
        return None;
    }
    let token = token.trim();
    if token.is_empty() { None } else { Some(token) }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    fn headers_with(value: &str) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert(AUTHORIZATION, HeaderValue::from_str(value).expect("header"));
        headers
    }

    /// 标准形态
    #[test]
    fn parse_standard_bearer() {
        assert_eq!(
            bearer_token(&headers_with("Bearer abc.def.ghi")),
            Some("abc.def.ghi")
        );
    }

    /// 方案名大小写不敏感，前后空白忽略
    #[test]
    fn parse_case_insensitive_and_trimmed() {
        assert_eq!(bearer_token(&headers_with("bearer  tok ")), Some("tok"));
        assert_eq!(bearer_token(&headers_with("BEARER tok")), Some("tok"));
    }

    /// 缺头、方案不对、令牌为空都不算数
    #[test]
    fn reject_invalid_shapes() {
        assert_eq!(bearer_token(&HeaderMap::new()), None);
        assert_eq!(bearer_token(&headers_with("Basic abc")), None);
        assert_eq!(bearer_token(&headers_with("Bearer ")), None);
        assert_eq!(bearer_token(&headers_with("Bearer")), None);
    }
}
