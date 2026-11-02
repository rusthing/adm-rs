//! # 认证服务
//!
//! 登录与登出。这是 adm 里唯一「不看 `X-User-Id` 头」的服务：登录还没有身份，
//! 登出靠令牌自证。
//!
//! ## 登录的判定顺序
//!
//! ```text
//! 1. 定位账号（登录名 / 手机号 / 邮箱 / 身份证任一，命中多个则拒绝）
//! 2. 锁定期内 → 直接拒绝（不验口令、不累加次数）
//! 3. 锁定已到期 → 当场解锁并留痕，继续走
//! 4. 验口令
//!    4.1 错 → 累加 fail_count；到阈值则锁定 + 写 adm_lock_log
//!    4.2 对 → 继续
//! 5. 停用 / 过期 → 拒绝
//! 6. 成功：清零失败计数、写 adm_login_log、签发令牌
//! ```
//!
//! 「停用」「过期」放在验口令**之后**：这两种状态只告诉口令正确的人。
//! 顺序反过来等于给攻击者一个免费的「这个账号存在且被停用了」探测接口。
//!
//! ## 失败都返回 200
//!
//! 业务拒绝走 `Ro::warn` + 业务编码（见 [`crate::cst`]），HTTP 状态仍是 200——
//! 与框架里「重复键」等业务错误一致，前端读 `Ro.code` 判分支。
//! 只有真正的基础设施故障（数据库、Redis、配置缺失）才向上抛 `SvcError`。

use crate::cst::{
    ADM_CODE_ACCOUNT_AMBIGUOUS, ADM_CODE_ACCOUNT_DISABLED, ADM_CODE_ACCOUNT_EXPIRED,
    ADM_CODE_ACCOUNT_LOCKED, ADM_CODE_LOGIN_FAILED, ADM_CODE_TOKEN_INVALID,
};
use crate::dao::{AdmLockLogDao, AdmLoginLogDao, AdmUserDao};
use crate::dic::UserStatus;
use crate::dto::AdmLoginDto;
use crate::mo::{adm_lock_log, adm_login_log, adm_user};
use crate::utils::{
    AdmPasswordUtils, AdmTokenUtils, get_login_fail_limit, get_login_lock_ms,
};
use crate::vo::{AdmLoginVo, AdmLogoutVo};
use robotech::api::{Ro, U64};
use robotech::dao::{begin_transaction, commit_transaction};
use robotech::db::get_db_conn;
use robotech::svc::SvcError;
use sea_orm::{
    ActiveValue, ColumnTrait, Condition, ConnectionTrait, EntityTrait, QueryFilter, QueryOrder,
    QuerySelect, Set,
};
use tracing::warn;
use validator::Validate;
use wheel_rs::time_utils::now_ms;

/// 操作者：系统
///
/// 登录失败锁定、到期自动解锁这类「系统自己的动作」写审计列时用它，
/// 与框架的 `SYS_OPERATOR_USER_ID` 一致。
const SYSTEM_OPERATOR_ID: i64 = 0;

/// # 认证服务
pub struct AdmAuthSvc;

/// 账号的锁定状态
///
/// 区分四种是为了处理 `status` 与 `lock_until_ms` 两处记录的先后：
/// 管理端直接把 `status` 改成锁定时不会填 `lock_until_ms`，那是永久锁；
/// 登录失败触发的锁定两者都会写，到期能自动解。
enum LockState {
    /// 未锁定
    Unlocked,
    /// 锁到某个时刻，到期自动解
    Timed(u64),
    /// 永久锁定，要管理员手工解
    Permanent,
    /// 定时锁已到期，需要当场解锁并留痕
    Expired,
}

#[allow(clippy::result_large_err)]
impl AdmAuthSvc {
    /// # 登录
    ///
    /// ## 参数
    /// * `dto` - 登录请求（账号标识 + 前端一次摘要）
    /// * `login_ip` - 客户端 IP，来自连接的 `SocketAddr`
    ///
    /// ## 返回值
    /// * `Ok(Ro<AdmLoginVo>)` - 成功带令牌；业务拒绝时 `Ro::is_err()` 为真并带编码
    /// * `Err(SvcError)` - 数据库 / Redis / 配置层面的故障
    pub async fn login(dto: AdmLoginDto, login_ip: &str) -> Result<Ro<AdmLoginVo>, SvcError> {
        dto.validate()?;

        let db = get_db_conn()?;
        let tx = begin_transaction(db.as_ref()).await?;
        // 失败路径（口令错、锁定）也要落库，所以先把结果拿出来再统一提交；
        // 只有真出错才让 tx 在 `?` 上 drop 回滚
        let ro = Self::login_in_tx(&dto, login_ip, &tx).await?;
        commit_transaction(tx).await?;
        Ok(ro)
    }

    /// # 登出
    ///
    /// 两件事：把令牌的 `jti` 写进 Redis 黑名单（立即失效），回写
    /// `adm_login_log.logout_ms`（审计）。
    ///
    /// ## 参数
    /// * `token` - 裸令牌（不含 `Bearer ` 前缀）
    ///
    /// ## 返回值
    /// * `Ok(Ro<AdmLogoutVo>)` - 登出成功
    /// * `Ok(Ro<……>)` - 令牌无效/已登出时是 `warn`，HTTP 仍是 200
    /// * `Err(SvcError)` - Redis / 数据库故障
    pub async fn logout(token: &str) -> Result<Ro<AdmLogoutVo>, SvcError> {
        // 已登出的令牌不再重复处理：重复登出要么是前端重试，要么是令牌被
        // 别人拿到——两种都只回一句「已失效」，不暴露更多
        let claims = match AdmTokenUtils::verify_online(token).await {
            Ok(claims) => claims,
            Err(e) => {
                warn!("logout with invalid token: {e}");
                return Ok(Ro::warn("令牌无效或已登出".to_string())
                    .code(Some(ADM_CODE_TOKEN_INVALID.to_string())));
            }
        };

        let login_log_id = claims.login_log_id()?;

        // 先吊销再回写日志：反过来的话，日志写着「已登出」而令牌还能用
        AdmTokenUtils::revoke(&claims).await?;

        let db = get_db_conn()?;
        let now = now_ms();
        let existing = AdmLoginLogDao::get_by_id::<_, adm_login_log::Model>(
            U64(login_log_id),
            db.as_ref(),
        )
        .await?;

        let logout_ms = match existing {
            Some(log) => match log.logout_ms {
                // 已经有登出时间：保留第一次的，登出时间不该被重试改写
                Some(previous) => previous as u64,
                None => {
                    let mut active: adm_login_log::ActiveModel = log.into();
                    active.logout_ms = Set(Some(now as i64));
                    // 让 DAO 用服务端时间推进 update_ms
                    active.update_ms = ActiveValue::NotSet;
                    AdmLoginLogDao::update(active, db.as_ref()).await?;
                    now
                }
            },
            // 令牌能验通过却查不到登录日志：只可能是日志被清理过。
            // 令牌已经吊销，这里如实返回时间，不编造会话
            None => {
                warn!("login log {login_log_id} not found while logout");
                now
            }
        };

        Ok(
            Ro::success("登出成功".to_string()).extra(Some(AdmLogoutVo {
                logout_ms,
                login_log_id,
            })),
        )
    }

    /// # 登录（事务内）
    async fn login_in_tx<C>(
        dto: &AdmLoginDto,
        login_ip: &str,
        db: &C,
    ) -> Result<Ro<AdmLoginVo>, SvcError>
    where
        C: ConnectionTrait,
    {
        let now = now_ms();
        let account = dto.account.trim();

        // 1. 定位账号：四列各有唯一约束，用 OR 一次查回来。
        //    多取一条就够判断「是否命中多个账号」
        let users = adm_user::Entity::find()
            .filter(
                Condition::any()
                    .add(adm_user::Column::Name.eq(account))
                    .add(adm_user::Column::Mobile.eq(account))
                    .add(adm_user::Column::Email.eq(account))
                    .add(adm_user::Column::IdCard.eq(account)),
            )
            .limit(2)
            .all(db)
            .await
            .map_err(robotech::dao::DaoError::parse_db_err)?;

        let user = match users.len() {
            // 账号不存在与口令错误共用一句提示，避免枚举账号
            0 => return Ok(Self::login_failed()),
            // 同一个串同时是 A 的登录名、B 的手机号：无法判定，让用户改用登录名
            1 => users.into_iter().next().expect("len checked"),
            _ => {
                return Ok(Ro::warn(
                    "该标识对应多个账号，请改用登录名".to_string(),
                )
                .code(Some(ADM_CODE_ACCOUNT_AMBIGUOUS.to_string())));
            }
        };

        // 2/3. 锁定检查；已到期的定时锁当场解开
        match Self::lock_state(&user, now) {
            LockState::Timed(until) => {
                return Ok(Ro::warn(format!(
                    "账号已锁定，将于 {} 自动解锁",
                    format_ms(until)
                ))
                .code(Some(ADM_CODE_ACCOUNT_LOCKED.to_string())));
            }
            LockState::Permanent => {
                return Ok(Ro::warn("账号已锁定，请联系管理员解锁".to_string())
                    .code(Some(ADM_CODE_ACCOUNT_LOCKED.to_string())));
            }
            LockState::Expired => Self::unlock_expired(&user, now, db).await?,
            LockState::Unlocked => {}
        }

        // 4. 验口令
        if !AdmPasswordUtils::verify(&dto.login_pswd, &user.login_pswd_salt, &user.login_pswd) {
            return Self::on_password_error(&user, now, db).await;
        }

        // 5. 账号状态：口令对了才有必要告诉对方「停用 / 过期」
        if !user.enabled || user.status == UserStatus::Disabled as i16 {
            return Ok(Ro::warn("账号已停用，请联系管理员".to_string())
                .code(Some(ADM_CODE_ACCOUNT_DISABLED.to_string())));
        }
        if let Some(expire_ms) = user.expire_ms
            && expire_ms as u64 <= now
        {
            return Ok(Ro::warn(format!("账号已于 {} 到期", format_ms(expire_ms as u64)))
                .code(Some(ADM_CODE_ACCOUNT_EXPIRED.to_string())));
        }

        // 6. 成功：清零失败计数、记录本次登录
        let mut active: adm_user::ActiveModel = user.clone().into();
        active.fail_count = Set(0);
        active.lock_until_ms = Set(None);
        active.status = Set(UserStatus::Normal as i16);
        active.last_login_ms = Set(Some(now as i64));
        active.updater_id = Set(user.id);
        active.update_ms = ActiveValue::NotSet;
        AdmUserDao::update(active, db).await?;

        let login_log = adm_login_log::ActiveModel {
            id: ActiveValue::NotSet,
            user_id: Set(Some(user.id)),
            login_ms: Set(now as i64),
            logout_ms: ActiveValue::NotSet,
            login_ip: Set(login_ip.to_string()),
            creater_id: Set(user.id),
            create_ms: ActiveValue::NotSet,
            updater_id: Set(user.id),
            update_ms: ActiveValue::NotSet,
        };
        let login_log = AdmLoginLogDao::insert(login_log, db).await?;

        let (token, expire_ms) = AdmTokenUtils::issue(
            user.id as u64,
            &user.name,
            login_log.id as u64,
        )?;

        Ok(Ro::success("登录成功".to_string()).extra(Some(AdmLoginVo {
            token,
            token_type: "Bearer".to_string(),
            expire_ms,
            user_id: user.id as u64,
            name: user.name,
            nick_name: user.nick_name,
            login_pswd_default: user.login_pswd_default,
            login_log_id: login_log.id as u64,
        })))
    }

    /// 统一的「登录失败」响应
    fn login_failed() -> Ro<AdmLoginVo> {
        Ro::warn("账号或口令不正确".to_string())
            .code(Some(ADM_CODE_LOGIN_FAILED.to_string()))
    }

    /// 判定锁定状态
    fn lock_state(user: &adm_user::Model, now: u64) -> LockState {
        match user.lock_until_ms {
            Some(until) => {
                // 负值只可能来自脏数据，按「已到期」处理（宁可放行也不要永久锁死）
                let until = until.max(0) as u64;
                if until > now {
                    LockState::Timed(until)
                } else {
                    LockState::Expired
                }
            }
            // 没有到期时间却标着「已锁定」：管理端手工锁的，等人工解
            None if user.status == UserStatus::Locked as i16 => LockState::Permanent,
            None => LockState::Unlocked,
        }
    }

    /// 解锁已到期的账号，并在 `adm_lock_log` 上补解锁时间
    async fn unlock_expired<C>(
        user: &adm_user::Model,
        now: u64,
        db: &C,
    ) -> Result<(), SvcError>
    where
        C: ConnectionTrait,
    {
        let mut active: adm_user::ActiveModel = user.clone().into();
        active.status = Set(UserStatus::Normal as i16);
        active.lock_until_ms = Set(None);
        active.fail_count = Set(0);
        active.updater_id = Set(SYSTEM_OPERATOR_ID);
        active.update_ms = ActiveValue::NotSet;
        AdmUserDao::update(active, db).await?;

        // 找最近一条还没解开的锁定记录；管理端直接改 lock_until_ms 的情况下没有
        // 这条记录，那就只解账号、不补日志
        let pending = adm_lock_log::Entity::find()
            .filter(adm_lock_log::Column::UserId.eq(user.id))
            .filter(adm_lock_log::Column::UnlockMs.is_null())
            .order_by_desc(adm_lock_log::Column::LockMs)
            .one(db)
            .await
            .map_err(robotech::dao::DaoError::parse_db_err)?;

        if let Some(log) = pending {
            let mut active: adm_lock_log::ActiveModel = log.into();
            active.unlock_ms = Set(Some(now as i64));
            active.unlock_reason = Set(Some("锁定到期，登录时自动解锁".to_string()));
            active.updater_id = Set(SYSTEM_OPERATOR_ID);
            active.update_ms = ActiveValue::NotSet;
            AdmLockLogDao::update(active, db).await?;
        }

        Ok(())
    }

    /// 口令错误：累加失败次数，到阈值就锁定
    async fn on_password_error<C>(
        user: &adm_user::Model,
        now: u64,
        db: &C,
    ) -> Result<Ro<AdmLoginVo>, SvcError>
    where
        C: ConnectionTrait,
    {
        // 刚验过口令说明当前没锁；计数从库里的值接着加，不改「从 0 开始」的语义
        let fail_count = user.fail_count.saturating_add(1);
        let limit = get_login_fail_limit();

        let mut active: adm_user::ActiveModel = user.clone().into();
        active.fail_count = Set(fail_count);
        active.updater_id = Set(SYSTEM_OPERATOR_ID);
        active.update_ms = ActiveValue::NotSet;

        if fail_count < limit {
            AdmUserDao::update(active, db).await?;
            return Ok(Self::login_failed());
        }

        // 到阈值：锁定 + 留痕。lock_until_ms 与 status 一起写，
        // 到期后由登录流程自己解开（见 `unlock_expired`）
        let lock_ms = get_login_lock_ms();
        let until = now.saturating_add(lock_ms);
        active.status = Set(UserStatus::Locked as i16);
        active.lock_until_ms = Set(Some(until as i64));
        AdmUserDao::update(active, db).await?;

        let lock_log = adm_lock_log::ActiveModel {
            id: ActiveValue::NotSet,
            user_id: Set(Some(user.id)),
            lock_ms: Set(now as i64),
            lock_reason: Set(format!("连续 {fail_count} 次登录口令错误")),
            unlock_ms: ActiveValue::NotSet,
            unlock_reason: ActiveValue::NotSet,
            creater_id: Set(SYSTEM_OPERATOR_ID),
            create_ms: ActiveValue::NotSet,
            updater_id: Set(SYSTEM_OPERATOR_ID),
            update_ms: ActiveValue::NotSet,
        };
        AdmLockLogDao::insert(lock_log, db).await?;

        // 锁定这一刻也要给出「锁到什么时候」：用户刚把口令输错，不是攻击者，
        // 告知解锁时间能省掉一次求助
        Ok(
            Ro::warn(format!("口令错误次数过多，账号已锁定至 {}", format_ms(until)))
                .code(Some(ADM_CODE_ACCOUNT_LOCKED.to_string())),
        )
    }
}

/// # 毫秒时间戳转可读文本
///
/// 提示语里给用户看的时间。用服务器本地时区；跨时区部署时前端应自己按
/// `expire_ms` 渲染，这里的文案只是兜底。
fn format_ms(ms: u64) -> String {
    match chrono::DateTime::from_timestamp_millis(ms as i64) {
        Some(dt) => dt
            .with_timezone(&chrono::Local)
            .format("%Y-%m-%d %H:%M:%S")
            .to_string(),
        // 超出 chrono 可表示范围（脏数据）：原样给时间戳，至少能排查
        None => format!("{ms}ms"),
    }
}
