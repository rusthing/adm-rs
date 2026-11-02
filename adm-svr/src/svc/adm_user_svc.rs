//! # 用户（账号）服务
//!
//! 除了框架生成的 CRUD，这里只做一件事：**写库前把三套口令封成最终摘要**。
//!
//! ## 为什么必须在这里做
//!
//! 模型约定库里存的是 `SM3(小写(SM3(明文)) + 小写(密码组合码))`：内层摘要由前端
//! 算（明文不过网），外层摘要与组合码必须由服务端生成。如果原样落库，存进去的
//! 就只是内层摘要，登录时再算一遍外层永远对不上——「写得进、登不进」。
//!
//! 组合码由服务端随机生成而不是接收调用方传的：组合码一旦由客户端指定，它就
//! 失去了「同一口令在不同行产生不同摘要」的作用。
//!
//! ## 覆盖范围
//!
//! `add` / `modify` / `save` 三个写入口都挂上了。`save` 是 upsert，绕过它等于
//! 留一条「用 save 写明文摘要」的后门。
//!
//! ## 读不回来
//!
//! `AdmUserVo` 里没有口令列，所以前端拿不到已存的口令摘要，也就不存在「把
//! 原值再提交一次」被二次摘要的机会；要改口令就重新输一次。
//!
//! ## 与登录的关系
//!
//! 登录（`AdmAuthSvc::login`）用同一个 [`AdmPasswordUtils::verify`] 校验，
//! 两边口径一致，改算法只改那一处。

use crate::config::get_adm_config;
use crate::dto::{AdmUserAddDto, AdmUserModifyDto, AdmUserSaveDto};
use crate::mo::adm_user;
use crate::utils::AdmPasswordUtils;
use robotech::db::get_db_conn;
use robotech::macros::svc;
use sea_orm::{ActiveValue, Set};
use std::borrow::Cow;
use validator::ValidationError;
use wheel_rs::sm3_utils::sm3_hex;

// `SvcError`、`ConnectionTrait`、`Validate` 等由 `#[svc]` 注入，这里不能再 use
// 一遍（E0252 重复引入）。

/// # 用户（账号）服务
///
/// 三个写方法都先过口令封存钩子，再走框架的 CRUD。
///
/// 批量查询返回 `AdmUserListVo`：手机号、邮箱、身份证、实名四个可定位个人的
/// 字段只出遮蔽结果；单条详情继续用 `AdmUserVo` 回显原值。
#[svc(
    list_vo = AdmUserListVo,
    before_add = seal_passwords_on_add,
    before_modify = seal_passwords_on_modify,
    before_save = seal_passwords_on_save
)]
pub struct AdmUserSvc;

/// # 封存一对「口令 + 组合码」
///
/// ## 参数
/// * `pswd` - 调用方传的口令，约定是 `SM3(明文)` 的 64 位十六进制
/// * `salt` - 调用方传的组合码，**会被忽略**（服务端自己生成）
///
/// ## 返回值
/// * `Ok((Some(摘要), Some(组合码)))` - 传了口令：返回最终的库内值
/// * `Ok((None, None))` - 没传口令：两列都不写，保留库里原值
/// * `Err(SvcError)` - 传了但不是一次摘要（多半是直接传了明文）
///
/// ## 为什么「没传」要连同组合码一起置空
///
/// 只换组合码不换口令，会让原本正确的口令当场失效——这是最容易踩的坑，
/// 所以两列要么一起写，要么一起不写。
#[allow(clippy::result_large_err)]
fn seal_pswd_pair(
    pswd: Option<String>,
    _salt: Option<String>,
) -> Result<(Option<String>, Option<String>), SvcError> {
    match pswd {
        None => Ok((None, None)),
        // 空串与空白串按「没设置」处理：审核 / 支付口令允许留空，
        // 前端清空输入框后提交空串不应该被当成非法摘要。
        Some(first_hash) if first_hash.trim().is_empty() => Ok((None, None)),
        Some(first_hash) => {
            let first_hash = first_hash.trim().to_string();
            if !AdmPasswordUtils::is_first_hash(&first_hash) {
                return Err(invalid_first_hash());
            }
            let generated = AdmPasswordUtils::gen_salt();
            let sealed = AdmPasswordUtils::seal(&first_hash, &generated);
            Ok((Some(sealed), Some(generated)))
        }
    }
}

/// # 一次摘要格式不对
///
/// 归到 `SvcError::Validation`：控制器映射成 400，消息直接说明期望的形态，
/// 免得调用方以为是密码策略拒绝。
fn invalid_first_hash() -> SvcError {
    let mut error = ValidationError::new("invalid_password_hash");
    error.message = Some(Cow::Owned(
        "口令必须是 SM3(明文) 的 64 位小写十六进制，不能直接传明文".to_string(),
    ));
    SvcError::Validation(error)
}

/// # 新增时封存三套口令
///
/// 挂在 `before_add` 上：钩子在同一个事务里、`validate` 之前执行，
/// 生成值本身仍然要过校验（长度 64 / 组合码长度 6）。
///
/// ## 参数
/// * `dto` - 新增请求
/// * `_db` - 事务连接（本钩子不查库，保留参数是为了对上框架的钩子签名）
#[allow(clippy::result_large_err)]
pub async fn seal_passwords_on_add<C>(
    mut dto: AdmUserAddDto,
    _db: &C,
) -> Result<AdmUserAddDto, SvcError>
where
    C: ConnectionTrait,
{
    let (login_pswd, login_pswd_salt) =
        seal_pswd_pair(dto.login_pswd.take(), dto.login_pswd_salt.take())?;
    // 新增时登录口令必须给出：库列 NOT NULL，缺了会在插入阶段报 500，
    // 不如在这里明确拒绝
    let (Some(login_pswd), Some(login_pswd_salt)) = (login_pswd, login_pswd_salt) else {
        return Err(required_login_pswd());
    };
    dto.login_pswd = Some(login_pswd);
    dto.login_pswd_salt = Some(login_pswd_salt);

    // 审核 / 支付口令允许留空，但列是 NOT NULL：新增时用空串占位，
    // 表示「能力尚未启用」，与「没传所以保留原值」区分开
    let (audit_pswd, audit_pswd_salt) =
        seal_pswd_pair(dto.audit_pswd.take(), dto.audit_pswd_salt.take())?;
    dto.audit_pswd = Some(audit_pswd.unwrap_or_default());
    dto.audit_pswd_salt = Some(audit_pswd_salt.unwrap_or_default());

    let (pay_pswd, pay_pswd_salt) = seal_pswd_pair(dto.pay_pswd.take(), dto.pay_pswd_salt.take())?;
    dto.pay_pswd = Some(pay_pswd.unwrap_or_default());
    dto.pay_pswd_salt = Some(pay_pswd_salt.unwrap_or_default());

    Ok(dto)
}

/// # 新增用户缺少登录口令
fn required_login_pswd() -> SvcError {
    let mut error = ValidationError::new("login_password_required");
    error.message = Some(Cow::Owned("新增用户必须设置登录口令".to_string()));
    SvcError::Validation(error)
}

/// # 重置登录口令为配置里的默认值
///
/// ## 参数
/// * `user_id` - 被重置的用户 ID
/// * `operator_id` - 执行重置的当前用户 ID（写审计列）
///
/// ## 返回
/// * `Ok(Ro<()>)` - 重置成功；库里的 `login_pswd_default` 置为 `true`
/// * `Err(SvcError)` - 用户不存在或数据库故障
///
/// ## 默认值来源
///
/// `[adm] default-password`。它可以是明文（`123456`）也可以直接是
/// `SM3(明文)`：前者由服务端算一次摘要，后者原样使用，避免重复摘要。
impl AdmUserSvc {
    pub async fn reset_password(user_id: u64, operator_id: u64) -> Result<Ro<()>, SvcError> {
    let db = get_db_conn()?;
    let user = AdmUserDao::get_by_id::<_, adm_user::Model>(U64(user_id), db.as_ref())
        .await?
        .ok_or_else(|| SvcError::NotFound(format!("用户 {user_id} 不存在")))?;

    let config = get_adm_config()?;
    let default_password = config.default_password.trim();
    let first_hash = if AdmPasswordUtils::is_first_hash(default_password) {
        default_password.to_lowercase()
    } else {
        sm3_hex(default_password)
    };
    let salt = AdmPasswordUtils::gen_salt();
    let sealed = AdmPasswordUtils::seal(&first_hash, &salt);

    let mut active: adm_user::ActiveModel = user.into();
    active.login_pswd = Set(sealed);
    active.login_pswd_salt = Set(salt);
    active.login_pswd_default = Set(true);
    active.updater_id = Set(operator_id as i64);
    active.update_ms = ActiveValue::NotSet;
    AdmUserDao::update(active, db.as_ref()).await?;

    Ok(Ro::success("口令已重置为默认值".to_string()))
    }
}

/// # 修改时封存三套口令
///
/// 没传口令的字段保持 `None`，DAO 不会写这两列，库里的口令原样保留。
#[allow(clippy::result_large_err)]
pub async fn seal_passwords_on_modify<C>(
    mut dto: AdmUserModifyDto,
    _db: &C,
) -> Result<AdmUserModifyDto, SvcError>
where
    C: ConnectionTrait,
{
    (dto.login_pswd, dto.login_pswd_salt) = seal_pswd_pair(dto.login_pswd, dto.login_pswd_salt)?;
    (dto.audit_pswd, dto.audit_pswd_salt) = seal_pswd_pair(dto.audit_pswd, dto.audit_pswd_salt)?;
    (dto.pay_pswd, dto.pay_pswd_salt) = seal_pswd_pair(dto.pay_pswd, dto.pay_pswd_salt)?;
    Ok(dto)
}

/// # 保存（upsert）时封存三套口令
///
/// `save` 的钩子不带连接（框架给的签名如此），本钩子也不需要。
#[allow(clippy::result_large_err)]
pub async fn seal_passwords_on_save(
    mut dto: AdmUserSaveDto,
) -> Result<AdmUserSaveDto, SvcError> {
    (dto.login_pswd, dto.login_pswd_salt) = seal_pswd_pair(dto.login_pswd, dto.login_pswd_salt)?;
    (dto.audit_pswd, dto.audit_pswd_salt) = seal_pswd_pair(dto.audit_pswd, dto.audit_pswd_salt)?;
    (dto.pay_pswd, dto.pay_pswd_salt) = seal_pswd_pair(dto.pay_pswd, dto.pay_pswd_salt)?;
    Ok(dto)
}
