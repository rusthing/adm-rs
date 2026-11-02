//! # 业务接口鉴权
//!
//! 现有 CRUD 控制器只从 `X-User-Id` 请求头取当前用户 ID，这个头是网关塞进来的，
//! 客户端自己也能伪造。真实 RBAC 上线后，所有业务接口都必须先校验
//! `Authorization: Bearer <token>`，再把令牌里的用户 ID 写回 `X-User-Id`，
//! 控制器与 Service 层无需改动。
//!
//! ## 不需要令牌的接口
//!
//! * `/adm/auth/login` - 登录前还没有令牌
//!
//! `/adm/auth/logout` 本来就在处理器里校验令牌；`/adm/auth/me` 与
//! `/adm/auth/change-password` 由于路径在认证路由里，也在处理器内用
//! [`verify_bearer`] 校验。
//!
//! ## 失败响应
//!
//! 缺令牌、令牌无效、已过期、已登出，统一返回 HTTP 401 + `Ro.code = ADM00005`，
//! 不区分具体原因（避免给攻击者探测空间）。
//!
//! ## 只做身份认证，不做接口级授权
//!
//! 本中间件只证明「请求来自哪个用户」，不按权限 URN 拒绝请求。
//! 接口级授权（`GET:/adm/user` 这类 URN 的匹配与拒止）后续在 gatex-rs 实现；
//! 前端菜单与页面门禁只是展示层，不能替代服务端授权。

use crate::cst::ADM_CODE_TOKEN_INVALID;
use crate::utils::AdmTokenUtils;
use axum::extract::Request;
use axum::http::header::AUTHORIZATION;
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use axum::Json;
use robotech::api::Ro;

/// 控制器读取的当前用户头名
pub const USER_ID_HEADER_NAME: &str = "X-User-Id";

/// # 从 `Authorization` 头里取裸令牌
///
/// 方案名大小写不敏感（RFC 7235），前后空白忽略。
pub fn bearer_token(headers: &HeaderMap) -> Option<&str> {
    let raw = headers.get(AUTHORIZATION)?.to_str().ok()?;
    let (scheme, token) = raw.split_once(' ')?;
    if !scheme.eq_ignore_ascii_case("bearer") {
        return None;
    }
    let token = token.trim();
    if token.is_empty() { None } else { Some(token) }
}

/// # 手动校验令牌
///
/// 用于认证路由里那几个「需要登录但不在统一中间件覆盖范围」的处理器。
///
/// ## 返回值
/// * `Ok(u64)` - 令牌有效且未登出，返回用户 ID
/// * `Err(String)` - 缺令牌或令牌无效，错误文本用于 `Ro.detail`
pub async fn verify_bearer(headers: &HeaderMap) -> Result<u64, String> {
    let token = bearer_token(headers).ok_or_else(|| "请求头缺少 Authorization Bearer".to_string())?;
    let claims = AdmTokenUtils::verify_online(token)
        .await
        .map_err(|error| error.to_string())?;
    claims.user_id().map_err(|error| error.to_string())
}

/// # 业务接口鉴权中间件
///
/// 校验通过后把令牌里的 `sub` 覆盖写入 `X-User-Id`，再交给下游处理器。
/// 这样控制器继续用原来的 `get_current_user_id(&headers)`，不需要逐个改造。
pub async fn require_auth(mut request: Request, next: Next) -> Response {
    let Some(token) = bearer_token(request.headers()) else {
        return unauthorized("请求头缺少 Authorization Bearer");
    };

    let claims = match AdmTokenUtils::verify_online(token).await {
        Ok(claims) => claims,
        Err(error) => return unauthorized(&error.to_string()),
    };
    let user_id = match claims.user_id() {
        Ok(user_id) => user_id,
        Err(error) => return unauthorized(&error.to_string()),
    };
    let value = match HeaderValue::from_str(&user_id.to_string()) {
        Ok(value) => value,
        Err(error) => return unauthorized(&error.to_string()),
    };
    request
        .headers_mut()
        .insert(USER_ID_HEADER_NAME, value);

    next.run(request).await
}

/// 统一 401 响应
fn unauthorized(detail: &str) -> Response {
    (
        StatusCode::UNAUTHORIZED,
        Json(
            Ro::<()>::warn("未登录或令牌已失效".to_string())
                .code(Some(ADM_CODE_TOKEN_INVALID.to_string()))
                .detail(Some(detail.to_string())),
        ),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn headers_with(value: &str) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert(AUTHORIZATION, HeaderValue::from_str(value).expect("header"));
        headers
    }

    #[test]
    fn parse_standard_bearer() {
        assert_eq!(
            bearer_token(&headers_with("Bearer abc.def.ghi")),
            Some("abc.def.ghi")
        );
    }

    #[test]
    fn parse_case_insensitive_and_trimmed() {
        assert_eq!(bearer_token(&headers_with("bearer  tok ")), Some("tok"));
        assert_eq!(bearer_token(&headers_with("BEARER tok")), Some("tok"));
    }

    #[test]
    fn reject_invalid_shapes() {
        assert_eq!(bearer_token(&HeaderMap::new()), None);
        assert_eq!(bearer_token(&headers_with("Basic abc")), None);
        assert_eq!(bearer_token(&headers_with("Bearer ")), None);
        assert_eq!(bearer_token(&headers_with("Bearer")), None);
    }
}
