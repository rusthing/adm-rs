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

use crate::dto::{AdmUserAddDto, AdmUserModifyDto, AdmUserSaveDto};
use crate::utils::AdmPasswordUtils;
use robotech::macros::svc;
use robotech::svc::SvcError;
use sea_orm::ConnectionTrait;
use std::borrow::Cow;
use validator::ValidationError;

/// # 用户（账号）服务
///
/// 三个写方法都先过口令封存钩子，再走框架的 CRUD。
#[svc(
    before_add = seal_passwords_on_add,
    before_modify = seal_passwords_on_modify,
    before_save = seal_passwords_on_save,
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
    (dto.login_pswd, dto.login_pswd_salt) = seal_pswd_pair(dto.login_pswd, dto.login_pswd_salt)?;
    (dto.audit_pswd, dto.audit_pswd_salt) = seal_pswd_pair(dto.audit_pswd, dto.audit_pswd_salt)?;
    (dto.pay_pswd, dto.pay_pswd_salt) = seal_pswd_pair(dto.pay_pswd, dto.pay_pswd_salt)?;
    Ok(dto)
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
