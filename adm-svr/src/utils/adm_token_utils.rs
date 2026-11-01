//! # 访问令牌（JWT）
//!
//! 无状态令牌：签名与有效期都在令牌自己身上，校验不查库。为此**没有**会话表，
//! 登录日志（`adm_login_log`）只承担审计与「会话什么时候结束」的记录。
//!
//! ## 登出怎么生效
//!
//! 无状态令牌天生撤不回来，所以登出要把这个令牌的 `jti` 写进 Redis 黑名单
//! （TTL 就是令牌剩余寿命，到期自动清掉，不会无限增长）。之后凡是需要
//! 「登出即刻失效」的调用方走 [`AdmTokenUtils::verify_online`]——
//! 它比 [`AdmTokenUtils::verify`] 多查一次黑名单。
//!
//! 只有 `logout` 用 `verify_online`：现有接口的用户身份来自网关塞的
//! `X-User-Id` 请求头，框架还没有鉴权中间件；等加中间件时在那里调
//! `verify_online` 即可，黑名单已经在写了，不用再改一遍数据结构。
//!
//! ## 认领字段
//!
//! * `sub` - 用户 ID（字符串，JWT 规范要求）
//! * `jti` - 登录日志 ID，即会话 ID；黑名单按它建键
//! * `name` - 登录名，排障时不用回查库
//! * `iat` / `exp` - 签发与到期，单位是**秒**（JWT 标准），对外仍暴露毫秒

use crate::config::get_adm_config;
use robotech::cache::distributed::redis::RedisCache;
use robotech::svc::SvcError;
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::time::Duration;
use tracing::warn;
use wheel_rs::time_utils::now_ms;

/// 黑名单键前缀
///
/// 后面拼 `jti`。加前缀是为了和别的业务键区分，也方便用 `SCAN adm:token:*` 排查。
const REVOKED_KEY_PREFIX: &str = "adm:token:revoked:";

/// # 令牌认领（claims）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdmTokenClaims {
    /// 用户 ID
    pub sub: String,
    /// 会话 ID（= `adm_login_log.id`）
    pub jti: String,
    /// 登录名
    pub name: String,
    /// 签发时间（秒）
    pub iat: i64,
    /// 到期时间（秒）
    pub exp: i64,
}

impl AdmTokenClaims {
    /// # 取用户 ID
    ///
    /// ## 返回值
    /// * `Ok(u64)` - `sub` 能解析成用户 ID
    /// * `Err(SvcError)` - 令牌里的 `sub` 不是数字（伪造或跨系统串用）
    pub fn user_id(&self) -> Result<u64, SvcError> {
        self.sub
            .parse::<u64>()
            .map_err(|_| invalid_token("令牌中的用户标识不是数字"))
    }

    /// # 取会话 ID
    ///
    /// ## 返回值
    /// * `Ok(u64)` - `jti` 能解析成登录日志 ID
    /// * `Err(SvcError)` - 不是数字
    pub fn login_log_id(&self) -> Result<u64, SvcError> {
        self.jti
            .parse::<u64>()
            .map_err(|_| invalid_token("令牌中的会话标识不是数字"))
    }

    /// # 到期时间（毫秒）
    pub fn expire_ms(&self) -> u64 {
        // exp 是秒，负值只可能来自伪造，按 0 处理
        (self.exp.max(0) as u64) * 1000
    }
}

/// # 令牌工具
pub struct AdmTokenUtils;

impl AdmTokenUtils {
    /// # 签发令牌
    ///
    /// ## 参数
    /// * `user_id` - 用户 ID
    /// * `name` - 登录名（写进认领，排障用）
    /// * `login_log_id` - 会话 ID
    ///
    /// ## 返回值
    /// * `Ok((String, u64))` - 令牌与到期时间戳（毫秒）
    /// * `Err(SvcError)` - 配置缺失或签名失败
    pub fn issue(
        user_id: u64,
        name: &str,
        login_log_id: u64,
    ) -> Result<(String, u64), SvcError> {
        let config = get_adm_config()?;
        let now_secs = (now_ms() / 1000) as i64;
        // 时长不足 1 秒会让 exp 等于 iat，令牌一签发就过期；向上取整到 1 秒
        let ttl_secs = (config.token_ttl_ms / 1000).max(1) as i64;

        let claims = AdmTokenClaims {
            sub: user_id.to_string(),
            jti: login_log_id.to_string(),
            name: name.to_string(),
            iat: now_secs,
            exp: now_secs + ttl_secs,
        };

        let header = jsonwebtoken::Header::new(jsonwebtoken::Algorithm::HS256);
        let key = jsonwebtoken::EncodingKey::from_secret(config.jwt_secret.as_bytes());
        let token = jsonwebtoken::encode(&header, &claims, &key)
            .map_err(|e| SvcError::Runtime(anyhow::anyhow!("签发令牌失败: {e}")))?;

        Ok((token, claims.expire_ms()))
    }

    /// # 校验令牌（只验签名与有效期）
    ///
    /// 不查黑名单，因此**不保证**这个令牌没被登出过。需要登出即失效的场景用
    /// [`Self::verify_online`]。
    ///
    /// ## 参数
    /// * `token` - 裸令牌（不含 `Bearer ` 前缀）
    ///
    /// ## 返回值
    /// * `Ok(AdmTokenClaims)` - 签名有效且未过期
    /// * `Err(SvcError)` - 签名不对、算法不符或已过期
    pub fn verify(token: &str) -> Result<AdmTokenClaims, SvcError> {
        let config = get_adm_config()?;
        let mut validation = jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::HS256);
        // 默认有 60 秒宽容期：过期一分钟后仍能通过校验。这里归零，
        // 「过期就是过期」，不给自己留模糊地带。
        validation.leeway = 0;

        let key = jsonwebtoken::DecodingKey::from_secret(config.jwt_secret.as_bytes());
        jsonwebtoken::decode::<AdmTokenClaims>(token, &key, &validation)
            .map(|data| data.claims)
            .map_err(|e| {
                warn!("verify token failed: {e}");
                invalid_token("令牌无效或已过期")
            })
    }

    /// # 把令牌加入黑名单
    ///
    /// TTL 取令牌剩余寿命：到期后这条记录自己消失，不用清理任务。
    /// 已经过期的令牌不写——它本来就进不来。
    ///
    /// ## 参数
    /// * `claims` - 已校验过的认领
    ///
    /// ## 返回值
    /// * `Ok(())` - 写入成功（或无需写入）
    /// * `Err(SvcError)` - Redis 不可用
    pub async fn revoke(claims: &AdmTokenClaims) -> Result<(), SvcError> {
        let now_secs = (now_ms() / 1000) as i64;
        let remain_secs = claims.exp - now_secs;
        if remain_secs <= 0 {
            return Ok(());
        }
        let key = Self::revoked_key(&claims.jti);
        RedisCache::set(&key, &"1", Some(Duration::from_secs(remain_secs as u64)))
            .await
            .map_err(|e| SvcError::Runtime(anyhow::anyhow!("令牌加入黑名单失败: {e}")))
    }

    /// # 令牌是否已被登出
    ///
    /// ## 参数
    /// * `jti` - 会话 ID
    ///
    /// ## 返回值
    /// * `Ok(true)` - 已登出（在黑名单里）
    /// * `Ok(false)` - 未登出
    /// * `Err(SvcError)` - Redis 不可用
    ///
    /// ## 为什么 Redis 不可用时直接报错
    ///
    /// 不能「查不到就当没登出」：Redis 挂了的时候，放行等于登出形同虚设；
    /// 报错则是登出请求失败，前端看得见，也不会静默放行。
    pub async fn is_revoked(jti: &str) -> Result<bool, SvcError> {
        RedisCache::exists(&Self::revoked_key(jti))
            .await
            .map_err(|e| SvcError::Runtime(anyhow::anyhow!("查询令牌黑名单失败: {e}")))
    }

    /// # 校验令牌并确认未被登出
    ///
    /// ## 参数
    /// * `token` - 裸令牌
    ///
    /// ## 返回值
    /// * `Ok(AdmTokenClaims)` - 有效且未登出
    /// * `Err(SvcError)` - 无效、过期或已登出
    pub async fn verify_online(token: &str) -> Result<AdmTokenClaims, SvcError> {
        let claims = Self::verify(token)?;
        if Self::is_revoked(&claims.jti).await? {
            return Err(invalid_token("令牌已登出，请重新登录"));
        }
        Ok(claims)
    }

    /// 黑名单键
    fn revoked_key(jti: &str) -> String {
        format!("{REVOKED_KEY_PREFIX}{jti}")
    }
}

/// # 构造「令牌无效」错误
///
/// 归到 `SvcError::Validation`：控制器会把它映射成 400 + `Ro::illegal_argument`，
/// 与框架其它「请求不合格」的出口保持一致。
fn invalid_token(message: &str) -> SvcError {
    let mut error = validator::ValidationError::new("invalid_token");
    error.message = Some(Cow::Owned(message.to_string()));
    SvcError::Validation(error)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::{AdmConfig, set_adm_config};
    use std::sync::{Mutex, MutexGuard};

    /// 配置是进程级静态，多个测试并发改会互相覆盖：串行执行
    static CONFIG_LOCK: Mutex<()> = Mutex::new(());

    fn lock_config() -> MutexGuard<'static, ()> {
        // 前一个测试 panic 会把锁毒化，这里直接取回内部值继续
        CONFIG_LOCK.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// 使配置就绪：签/验令牌都依赖 `[adm]` 段
    fn init_config(secret: &str) {
        set_adm_config(&AdmConfig {
            jwt_secret: secret.to_string(),
            token_ttl_ms: 60_000,
            ..Default::default()
        });
    }

    /// 签发 → 校验：认领字段原样回来
    #[test]
    fn issue_and_verify_roundtrip() {
        let _guard = lock_config();
        init_config("unit-test-secret");

        let (token, expire_ms) = AdmTokenUtils::issue(1024, "admin", 99).expect("issue");
        let claims = AdmTokenUtils::verify(&token).expect("verify");

        assert_eq!(claims.user_id().unwrap(), 1024);
        assert_eq!(claims.login_log_id().unwrap(), 99);
        assert_eq!(claims.name, "admin");
        assert_eq!(claims.expire_ms(), expire_ms);
    }

    /// 改一个字符签名就失效
    #[test]
    fn tampered_token_is_rejected() {
        let _guard = lock_config();
        init_config("unit-test-secret");

        let (token, _) = AdmTokenUtils::issue(1, "admin", 1).expect("issue");
        let mut chars: Vec<char> = token.chars().collect();
        // 动载荷段的最后一个字符
        let payload_end = token.rfind('.').unwrap() - 1;
        chars[payload_end] = if chars[payload_end] == 'A' { 'B' } else { 'A' };
        let tampered: String = chars.into_iter().collect();

        assert!(AdmTokenUtils::verify(&tampered).is_err());
    }

    /// 换密钥后旧令牌失效
    #[test]
    fn secret_change_invalidates_token() {
        let _guard = lock_config();
        init_config("unit-test-secret");
        let (token, _) = AdmTokenUtils::issue(1, "admin", 1).expect("issue");

        init_config("another-secret");
        assert!(AdmTokenUtils::verify(&token).is_err());
    }

    /// 认领里的 `sub` / `jti` 必须是数字，否则拿不到用户与会话
    #[test]
    fn non_numeric_claims_are_rejected() {
        let claims = AdmTokenClaims {
            sub: "abc".to_string(),
            jti: "xyz".to_string(),
            name: "admin".to_string(),
            iat: 0,
            exp: 0,
        };
        assert!(claims.user_id().is_err());
        assert!(claims.login_log_id().is_err());
    }
}
