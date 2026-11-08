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
    ADM_CODE_VERIFY_AUDIT_PASSWORD_NOT_SET, ADM_CODE_VERIFY_PASSWORD_FAILED,
    ADM_CODE_VERIFY_PASSWORD_RATE_LIMITED, ADM_CODE_VERIFY_PASSWORD_USER_UNAVAILABLE,
};
use crate::dao::{AdmLockLogDao, AdmLoginLogDao, AdmOpLogDao, AdmUserDao};
use crate::dic::UserStatus;
use crate::dto::{
    AdmChangePasswordDto, AdmLoginDto, AdmVerifyAuditPasswordDto, AdmVerifyPasswordDto,
};
use crate::mo::{
    adm_lock_log, adm_login_log, adm_menu, adm_op_log, adm_perm, adm_role, adm_role_menu,
    adm_role_perm, adm_role_user, adm_user,
};
use crate::utils::{
    AdmPasswordUtils, AdmTokenUtils, get_login_fail_limit, get_login_lock_ms,
    get_verify_password_fail_limit, get_verify_password_window_ms,
};
use crate::vo::{AdmLoginVo, AdmLogoutVo, AdmMeVo, AdmUserVo};
use redis::Script;
use robotech::api::{Ro, U64};
use robotech::cache::distributed::redis::RedisCache;
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

/// 口令二次确认失败计数的 Redis 键前缀
///
/// 只统计**这条接口**的错误尝试，与登录失败计数（`adm_user.fail_count`）
/// 完全隔离；后缀是用户 ID。
const VERIFY_PASSWORD_FAIL_KEY_PREFIX: &str = "adm:auth:verify-password:fail:";

/// 口令二次确认审计使用的操作类型编码
const VERIFY_PASSWORD_OP_TYPE: &str = "verify_password";
/// 口令二次确认审计标题
const VERIFY_PASSWORD_OP_TITLE: &str = "高危操作口令二次确认";
/// 口令二次确认审计的接口标识
const VERIFY_PASSWORD_OP_URN: &str = "POST:/adm/auth/verify-password";

/// 审核口令二次确认失败计数的 Redis 键前缀
///
/// 与登录口令二次确认的计数分开，避免审核口令输错把登录口令的频控额度用掉。
const VERIFY_AUDIT_PASSWORD_FAIL_KEY_PREFIX: &str = "adm:auth:verify-audit-password:fail:";

/// 审核口令二次确认审计使用的操作类型编码
const VERIFY_AUDIT_PASSWORD_OP_TYPE: &str = "verify_audit_password";
/// 审核口令二次确认审计标题
const VERIFY_AUDIT_PASSWORD_OP_TITLE: &str = "高危操作审核口令二次确认";
/// 审核口令二次确认审计的接口标识
const VERIFY_AUDIT_PASSWORD_OP_URN: &str = "POST:/adm/auth/verify-audit-password";

/// 失败计数原子 +1，并在第一次失败时设置窗口
///
/// 用 Lua 保证「读-改-写」在 Redis 内一次完成，避免并发下计数丢失，
/// 让频控在分布式部署里仍然有效。
const VERIFY_PASSWORD_FAIL_INCR_SCRIPT: &str = r"
local count = redis.call('INCR', KEYS[1])
if count == 1 then
    redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return count
";

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

    /// # 当前用户聚合信息
    ///
    /// 一次返回「用户资料 + 角色 + 权限 + 可见菜单」，前端登录后只需要调这一个
    /// 接口就能完成侧栏渲染与按钮级鉴权，不再自己拼 role-user / role-menu /
    /// role-perm 三次查询。
    ///
    /// ## 过滤规则
    /// * 角色、权限只取 `enabled = true` 的
    /// * 菜单只取 `enabled = true AND visible = true` 的
    /// * 三组关联都按角色 ID 的并集去重
    ///
    /// ## 返回值
    /// * `Ok(Ro<AdmMeVo>)` - 聚合结果
    /// * `Ok(Ro::warn + ADM00003)` - 账号已停用
    /// * `Err(SvcError)` - 数据库故障
    #[allow(clippy::result_large_err)]
    pub async fn me(user_id: u64) -> Result<Ro<AdmMeVo>, SvcError> {
        let db = get_db_conn()?;
        let user = AdmUserDao::get_by_id::<_, adm_user::Model>(U64(user_id), db.as_ref())
            .await?
            .ok_or_else(|| SvcError::NotFound(format!("用户 {user_id} 不存在")))?;

        if !user.enabled || user.status == UserStatus::Disabled as i16 {
            return Ok(Ro::warn("账号已停用，请联系管理员".to_string())
                .code(Some(ADM_CODE_ACCOUNT_DISABLED.to_string())));
        }

        // 角色：先按 role_user 拿到角色 ID，再过滤启用的角色
        let role_ids: Vec<i64> = adm_role_user::Entity::find()
            .filter(adm_role_user::Column::UserId.eq(user.id))
            .all(db.as_ref())
            .await
            .map_err(robotech::dao::DaoError::parse_db_err)?
            .into_iter()
            .map(|link| link.role_id)
            .collect();

        let roles = if role_ids.is_empty() {
            Vec::new()
        } else {
            adm_role::Entity::find()
                .filter(adm_role::Column::Id.is_in(role_ids.clone()))
                .filter(adm_role::Column::Enabled.eq(true))
                .order_by_asc(adm_role::Column::SortOrder)
                .order_by_asc(adm_role::Column::Id)
                .all(db.as_ref())
                .await
                .map_err(robotech::dao::DaoError::parse_db_err)?
        };
        let active_role_ids: Vec<i64> = roles.iter().map(|role| role.id).collect();

        // 菜单：role_menu 取菜单 ID，再过滤启用且可见的
        let menu_ids: Vec<i64> = if active_role_ids.is_empty() {
            Vec::new()
        } else {
            adm_role_menu::Entity::find()
                .filter(adm_role_menu::Column::RoleId.is_in(active_role_ids.clone()))
                .all(db.as_ref())
                .await
                .map_err(robotech::dao::DaoError::parse_db_err)?
                .into_iter()
                .map(|link| link.menu_id)
                .collect()
        };
        let menus = if menu_ids.is_empty() {
            Vec::new()
        } else {
            adm_menu::Entity::find()
                .filter(adm_menu::Column::Id.is_in(menu_ids))
                .filter(adm_menu::Column::Enabled.eq(true))
                .filter(adm_menu::Column::Visible.eq(true))
                .order_by_asc(adm_menu::Column::TreeCode)
                .all(db.as_ref())
                .await
                .map_err(robotech::dao::DaoError::parse_db_err)?
        };

        // 权限：role_perm 取权限 ID，再过滤启用的
        let perm_ids: Vec<i64> = if active_role_ids.is_empty() {
            Vec::new()
        } else {
            adm_role_perm::Entity::find()
                .filter(adm_role_perm::Column::RoleId.is_in(active_role_ids))
                .all(db.as_ref())
                .await
                .map_err(robotech::dao::DaoError::parse_db_err)?
                .into_iter()
                .map(|link| link.perm_id)
                .collect()
        };
        let perms = if perm_ids.is_empty() {
            Vec::new()
        } else {
            adm_perm::Entity::find()
                .filter(adm_perm::Column::Id.is_in(perm_ids))
                .filter(adm_perm::Column::Enabled.eq(true))
                .order_by_asc(adm_perm::Column::SortOrder)
                .order_by_asc(adm_perm::Column::Id)
                .all(db.as_ref())
                .await
                .map_err(robotech::dao::DaoError::parse_db_err)?
        };

        let perm_urns: Vec<String> = perms.iter().map(|perm| perm.urn.clone()).collect();

        // 数据范围与当前生效的首页配置：复用首页服务的预置逻辑，
        // 保证 /me 与 /adm/dashboard/summary 看到的是同一份配置
        let (scopes, dashboard) = crate::svc::me_dashboard(&roles, &perm_urns).await?;

        Ok(Ro::success("获取当前用户信息成功".to_string()).extra(Some(AdmMeVo {
            user: AdmUserVo::from(user),
            roles: roles.into_iter().map(Into::into).collect(),
            perms: perms.into_iter().map(Into::into).collect(),
            menus: menus.into_iter().map(Into::into).collect(),
            perm_urns,
            scopes,
            dashboard,
        })))
    }

    /// # 修改当前用户登录口令
    ///
    /// 与 `PUT /adm/user` 分开口令字段：这条路径只能改自己的登录口令，
    /// 且必须提供旧口令，避免令牌被盗后直接被换掉口令。
    ///
    /// ## 参数
    /// * `user_id` - 令牌里的用户 ID
    /// * `dto` - 旧 / 新口令的一次摘要（`SM3(明文)`）
    ///
    /// ## 返回值
    /// * `Ok(Ro<()>)` - 修改成功
    /// * `Ok(Ro::warn + ADM00001)` - 旧口令不正确
    /// * `Err(SvcError)` - 用户不存在或数据库故障
    #[allow(clippy::result_large_err)]
    pub async fn change_password(
        user_id: u64,
        dto: AdmChangePasswordDto,
    ) -> Result<Ro<()>, SvcError> {
        dto.validate()?;

        let db = get_db_conn()?;
        let user = AdmUserDao::get_by_id::<_, adm_user::Model>(U64(user_id), db.as_ref())
            .await?
            .ok_or_else(|| SvcError::NotFound(format!("用户 {user_id} 不存在")))?;

        if !AdmPasswordUtils::verify(&dto.old_pswd, &user.login_pswd_salt, &user.login_pswd) {
            return Ok(Ro::warn("旧口令不正确".to_string())
                .code(Some(ADM_CODE_LOGIN_FAILED.to_string())));
        }
        if !AdmPasswordUtils::is_first_hash(&dto.new_pswd) {
            return Ok(Ro::illegal_argument(
                "新口令必须是 SM3(明文) 的 64 位十六进制".to_string(),
            ));
        }

        let salt = AdmPasswordUtils::gen_salt();
        let sealed = AdmPasswordUtils::seal(&dto.new_pswd, &salt);
        let mut active: adm_user::ActiveModel = user.clone().into();
        active.login_pswd = Set(sealed);
        active.login_pswd_salt = Set(salt);
        active.login_pswd_default = Set(false);
        active.updater_id = Set(user.id);
        active.update_ms = ActiveValue::NotSet;
        AdmUserDao::update(active, db.as_ref()).await?;

        Ok(Ro::success("口令修改成功".to_string()))
    }

    /// # 校验当前用户口令（高危操作二次确认）
    ///
    /// 供其它服务在删除、发布、改权限等高风险动作前调用。身份来自请求令牌，
    /// 不接受请求体里的账号，也不走登录流程。
    ///
    /// ## 与登录的隔离
    ///
    /// **不累加登录失败次数、不触发账号锁定、不创建会话、不签发令牌**：
    /// 只读 `adm_user`，把结果写进独立的 Redis 计数键与 `adm_op_log` 审计。
    ///
    /// ## 频控
    ///
    /// 同一用户连续输错达到阈值（`adm_option.verify_password_fail_limit`，
    /// 默认 5 次）后，在窗口（`verify_password_window_ms`，默认 10 分钟）内
    /// 直接返回 `ADM00008`；成功一次即清零。频控本身不写审计，避免刷日志。
    ///
    /// ## 参数
    /// * `user_id` - 令牌里的用户 ID
    /// * `dto` - 当前口令的一次摘要（`SM3(明文)`）
    ///
    /// ## 返回值
    /// * `Ok(Ro<()>)` - 口令正确
    /// * `Ok(Ro::warn + ADM00007)` - 口令不正确
    /// * `Ok(Ro::warn + ADM00008)` - 错误尝试过于频繁
    /// * `Ok(Ro::warn + ADM00009)` - 当前用户不可用（不存在 / 停用 / 锁定 / 过期）
    /// * `Err(SvcError)` - 数据库 / Redis 故障
    #[allow(clippy::result_large_err)]
    pub async fn verify_password(
        user_id: u64,
        dto: AdmVerifyPasswordDto,
    ) -> Result<Ro<()>, SvcError> {
        dto.validate()?;

        let fail_limit = get_verify_password_fail_limit();
        let window_ms = get_verify_password_window_ms();

        // 频控先于任何口令比较：已经超限时不再验口令，也不再写审计
        if Self::verify_fail_count(VERIFY_PASSWORD_FAIL_KEY_PREFIX, user_id).await? >= fail_limit as i64
        {
            warn!("verify-password: user {user_id} rate limited");
            return Ok(Self::verify_password_rate_limited());
        }

        let db = get_db_conn()?;
        let Some(user) =
            AdmUserDao::get_by_id::<_, adm_user::Model>(U64(user_id), db.as_ref()).await?
        else {
            warn!("verify-password: user {user_id} not found");
            return Ok(Self::verify_password_user_unavailable("当前用户不可用"));
        };

        // 只读判断账号状态：不自动解锁、不修改 status / lock_until_ms / fail_count
        if !user.enabled || user.status == UserStatus::Disabled as i16 {
            Self::audit_verify(
                &user,
                false,
                VERIFY_PASSWORD_OP_TYPE,
                VERIFY_PASSWORD_OP_TITLE,
                VERIFY_PASSWORD_OP_URN,
                db.as_ref(),
            )
            .await?;
            return Ok(Self::verify_password_user_unavailable(
                "当前用户不可用：账号已停用",
            ));
        }
        if user.status == UserStatus::Locked as i16 {
            Self::audit_verify(
                &user,
                false,
                VERIFY_PASSWORD_OP_TYPE,
                VERIFY_PASSWORD_OP_TITLE,
                VERIFY_PASSWORD_OP_URN,
                db.as_ref(),
            )
            .await?;
            return Ok(Self::verify_password_user_unavailable(
                "当前用户不可用：账号已锁定",
            ));
        }
        let now = now_ms();
        if let Some(expire_ms) = user.expire_ms
            && expire_ms as u64 <= now
        {
            Self::audit_verify(
                &user,
                false,
                VERIFY_PASSWORD_OP_TYPE,
                VERIFY_PASSWORD_OP_TITLE,
                VERIFY_PASSWORD_OP_URN,
                db.as_ref(),
            )
            .await?;
            return Ok(Self::verify_password_user_unavailable(
                "当前用户不可用：账号已过期",
            ));
        }

        // 口令比较沿用登录的同一套强度：SM3(一次摘要 + 密码组合码)
        if !AdmPasswordUtils::verify(&dto.login_pswd, &user.login_pswd_salt, &user.login_pswd) {
            let fail_count =
                Self::bump_verify_fail_count(VERIFY_PASSWORD_FAIL_KEY_PREFIX, user_id, window_ms)
                    .await?;
            Self::audit_verify(
                &user,
                false,
                VERIFY_PASSWORD_OP_TYPE,
                VERIFY_PASSWORD_OP_TITLE,
                VERIFY_PASSWORD_OP_URN,
                db.as_ref(),
            )
            .await?;
            if fail_count >= fail_limit as i64 {
                warn!("verify-password: user {user_id} reached fail limit {fail_count}");
                return Ok(Self::verify_password_rate_limited());
            }
            return Ok(Ro::warn("口令不正确".to_string())
                .code(Some(ADM_CODE_VERIFY_PASSWORD_FAILED.to_string())));
        }

        // 成功：只清本接口的失败计数，不碰 adm_user 的任何登录状态字段
        Self::clear_verify_fail_count(VERIFY_PASSWORD_FAIL_KEY_PREFIX, user_id).await?;
        Self::audit_verify(
            &user,
            true,
            VERIFY_PASSWORD_OP_TYPE,
            VERIFY_PASSWORD_OP_TITLE,
            VERIFY_PASSWORD_OP_URN,
            db.as_ref(),
        )
        .await?;
        Ok(Ro::success("口令校验通过".to_string()))
    }

    /// # 校验当前登录用户的审核口令
    ///
    /// 与 [`Self::verify_password`] 同一条处理链：同样的账号状态判断、同样的
    /// 失败频控与审计，只是比较 `adm_user.audit_pswd`，并使用独立的 Redis
    /// 计数键，避免审核口令输错把登录口令二次确认的额度用掉。
    ///
    /// 用户尚未设置审核口令时返回 `ADM00010`，提示先到用户管理设置，
    /// 不让用户反复尝试一个根本不存在的口令。
    ///
    /// ## 参数
    /// * `user_id` - 令牌里的用户 ID
    /// * `dto` - 审核口令的一次摘要（`SM3(明文)`）
    #[allow(clippy::result_large_err)]
    pub async fn verify_audit_password(
        user_id: u64,
        dto: AdmVerifyAuditPasswordDto,
    ) -> Result<Ro<()>, SvcError> {
        dto.validate()?;

        let fail_limit = get_verify_password_fail_limit();
        let window_ms = get_verify_password_window_ms();

        if Self::verify_fail_count(VERIFY_AUDIT_PASSWORD_FAIL_KEY_PREFIX, user_id).await?
            >= fail_limit as i64
        {
            warn!("verify-audit-password: user {user_id} rate limited");
            return Ok(Self::verify_password_rate_limited());
        }

        let db = get_db_conn()?;
        let Some(user) =
            AdmUserDao::get_by_id::<_, adm_user::Model>(U64(user_id), db.as_ref()).await?
        else {
            warn!("verify-audit-password: user {user_id} not found");
            return Ok(Self::verify_password_user_unavailable("当前用户不可用"));
        };

        if !user.enabled || user.status == UserStatus::Disabled as i16 {
            Self::audit_verify(
                &user,
                false,
                VERIFY_AUDIT_PASSWORD_OP_TYPE,
                VERIFY_AUDIT_PASSWORD_OP_TITLE,
                VERIFY_AUDIT_PASSWORD_OP_URN,
                db.as_ref(),
            )
            .await?;
            return Ok(Self::verify_password_user_unavailable(
                "当前用户不可用：账号已停用",
            ));
        }
        if user.status == UserStatus::Locked as i16 {
            Self::audit_verify(
                &user,
                false,
                VERIFY_AUDIT_PASSWORD_OP_TYPE,
                VERIFY_AUDIT_PASSWORD_OP_TITLE,
                VERIFY_AUDIT_PASSWORD_OP_URN,
                db.as_ref(),
            )
            .await?;
            return Ok(Self::verify_password_user_unavailable(
                "当前用户不可用：账号已锁定",
            ));
        }
        let now = now_ms();
        if let Some(expire_ms) = user.expire_ms
            && expire_ms as u64 <= now
        {
            Self::audit_verify(
                &user,
                false,
                VERIFY_AUDIT_PASSWORD_OP_TYPE,
                VERIFY_AUDIT_PASSWORD_OP_TITLE,
                VERIFY_AUDIT_PASSWORD_OP_URN,
                db.as_ref(),
            )
            .await?;
            return Ok(Self::verify_password_user_unavailable(
                "当前用户不可用：账号已过期",
            ));
        }

        if user.audit_pswd.trim().is_empty() {
            Self::audit_verify(
                &user,
                false,
                VERIFY_AUDIT_PASSWORD_OP_TYPE,
                VERIFY_AUDIT_PASSWORD_OP_TITLE,
                VERIFY_AUDIT_PASSWORD_OP_URN,
                db.as_ref(),
            )
            .await?;
            return Ok(Ro::warn("当前用户未设置审核口令".to_string())
                .code(Some(ADM_CODE_VERIFY_AUDIT_PASSWORD_NOT_SET.to_string())));
        }

        if !AdmPasswordUtils::verify(&dto.audit_pswd, &user.audit_pswd_salt, &user.audit_pswd) {
            let fail_count = Self::bump_verify_fail_count(
                VERIFY_AUDIT_PASSWORD_FAIL_KEY_PREFIX,
                user_id,
                window_ms,
            )
            .await?;
            Self::audit_verify(
                &user,
                false,
                VERIFY_AUDIT_PASSWORD_OP_TYPE,
                VERIFY_AUDIT_PASSWORD_OP_TITLE,
                VERIFY_AUDIT_PASSWORD_OP_URN,
                db.as_ref(),
            )
            .await?;
            if fail_count >= fail_limit as i64 {
                warn!("verify-audit-password: user {user_id} reached fail limit {fail_count}");
                return Ok(Self::verify_password_rate_limited());
            }
            return Ok(Ro::warn("审核口令不正确".to_string())
                .code(Some(ADM_CODE_VERIFY_PASSWORD_FAILED.to_string())));
        }

        Self::clear_verify_fail_count(VERIFY_AUDIT_PASSWORD_FAIL_KEY_PREFIX, user_id).await?;
        Self::audit_verify(
            &user,
            true,
            VERIFY_AUDIT_PASSWORD_OP_TYPE,
            VERIFY_AUDIT_PASSWORD_OP_TITLE,
            VERIFY_AUDIT_PASSWORD_OP_URN,
            db.as_ref(),
        )
        .await?;
        Ok(Ro::success("审核口令校验通过".to_string()))
    }

    /// 口令二次确认频控命中响应
    fn verify_password_rate_limited() -> Ro<()> {
        Ro::warn("口令校验失败次数过多，请稍后再试".to_string())
            .code(Some(ADM_CODE_VERIFY_PASSWORD_RATE_LIMITED.to_string()))
    }

    /// 口令二次确认「用户不可用」响应
    fn verify_password_user_unavailable(msg: &str) -> Ro<()> {
        Ro::warn(msg.to_string()).code(Some(ADM_CODE_VERIFY_PASSWORD_USER_UNAVAILABLE.to_string()))
    }

    /// 口令二次确认失败计数的 Redis 键
    fn verify_fail_key(prefix: &str, user_id: u64) -> String {
        format!("{prefix}{user_id}")
    }

    /// 读取当前失败计数；键不存在按 0 处理
    async fn verify_fail_count(prefix: &str, user_id: u64) -> Result<i64, SvcError> {
        let count = RedisCache::get::<i64>(&Self::verify_fail_key(prefix, user_id))
            .await
            .map_err(|e| SvcError::Runtime(anyhow::anyhow!("查询口令校验失败计数失败: {e}")))?;
        Ok(count.unwrap_or(0))
    }

    /// 原子累加失败计数并返回累加后的值；首次失败时同时设置窗口
    async fn bump_verify_fail_count(
        prefix: &str,
        user_id: u64,
        window_ms: u64,
    ) -> Result<i64, SvcError> {
        let mut conn = robotech::redis::get_redis_conn()
            .map_err(|e| SvcError::Runtime(anyhow::anyhow!("Redis 连接失败: {e}")))?;
        let count: i64 = Script::new(VERIFY_PASSWORD_FAIL_INCR_SCRIPT)
            .key(Self::verify_fail_key(prefix, user_id))
            .arg(window_ms.max(1) as i64)
            .invoke_async(&mut conn)
            .await
            .map_err(|e| SvcError::Runtime(anyhow::anyhow!("累加口令校验失败计数失败: {e}")))?;
        Ok(count)
    }

    /// 口令正确时清掉本接口的失败计数
    async fn clear_verify_fail_count(prefix: &str, user_id: u64) -> Result<(), SvcError> {
        RedisCache::del(&Self::verify_fail_key(prefix, user_id))
            .await
            .map_err(|e| SvcError::Runtime(anyhow::anyhow!("清理口令校验失败计数失败: {e}")))?;
        Ok(())
    }

    /// 写审计：谁（user_id）、什么时候（create_ms，DAO 自动填）、成功还是失败
    ///
    /// 只写结果，不写口令、摘要、盐或任何可还原口令的字段。
    async fn audit_verify<C>(
        user: &adm_user::Model,
        success: bool,
        op_type: &str,
        op_title: &str,
        op_urn: &str,
        db: &C,
    ) -> Result<(), SvcError>
    where
        C: ConnectionTrait,
    {
        let audit = adm_op_log::ActiveModel {
            id: ActiveValue::NotSet,
            user_id: Set(user.id),
            op_type_code: Set(op_type.to_string()),
            op_title: Set(op_title.to_string()),
            op_urn: Set(op_urn.to_string()),
            remark: Set(Some(
                if success {
                    "口令校验成功"
                } else {
                    "口令校验失败"
                }
                .to_string(),
            )),
            creater_id: Set(user.id),
            create_ms: ActiveValue::NotSet,
            updater_id: Set(user.id),
            update_ms: ActiveValue::NotSet,
        };
        AdmOpLogDao::insert(audit, db).await?;
        Ok(())
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
            // 审核口令允许留空（尚未启用审核功能），这里只判断「有没有配」。
            audit_pswd_set: !user.audit_pswd.trim().is_empty(),
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
