//! # 用户（账号）列表 VO（脱敏）
//!
//! 批量查询（list / page / search 系，含 ex 变体）的专用响应；敏感字段用
//! [`robotech::api::mask`] 的包装类型，序列化与 Debug 都只出遮蔽结果，
//! 没有任何「拿回原值」的出口。
//!
//! 单条详情（get_by_id / get_ex_by_id）不走本 VO，继续用 [`crate::vo::AdmUserVo`]
//! 回显原值——两条路靠类型区分，不靠「记得调用某个函数」。
//!
//! 字段集与 [`AdmUserVo`] 相同，差异只有四个可定位个人的字段换成了脱敏包装：
//! `mobile` / `email` / `id_card` / `real_name`。三套口令与盐值照旧不进 VO。

use derive_setters::Setters;
use robotech::api::{
    MaskedEmail, MaskedIdCard, MaskedMobile, MaskedName, U64,
};
use serde::{Deserialize, Serialize};
use serde_with::skip_serializing_none;
use typed_builder::TypedBuilder;
use utoipa::ToSchema;

#[cfg(feature = "server")]
use sea_orm::FromQueryResult;

#[skip_serializing_none]
#[derive(
    Debug, Serialize, Deserialize, Clone, Setters, TypedBuilder, ToSchema,
)]
#[cfg_attr(feature = "server", derive(FromQueryResult))]
#[serde(rename_all = "camelCase")]
#[builder]
pub struct AdmUserListVo {
    /// 主键
    pub id: U64,
    /// 人员 ID
    /// 为空表示纯账号（外部认证、系统账号、机器人），不关联人员档案
    #[builder(default, setter(into))]
    pub person_id: Option<U64>,
    /// 登录名
    pub name: String,
    /// 昵称
    #[builder(default, setter(into))]
    pub nick_name: Option<String>,
    /// 手机号（登录用，脱敏）
    /// 全局唯一（AK）；序列化输出形如 `138****8000`
    #[builder(default, setter(into))]
    pub mobile: Option<MaskedMobile>,
    /// 手机号是否已验证
    pub mobile_verified: bool,
    /// 邮箱（登录用，脱敏）
    /// 全局唯一（AK）；序列化输出形如 `s***e@example.com`
    #[builder(default, setter(into))]
    pub email: Option<MaskedEmail>,
    /// 邮箱是否已验证
    pub email_verified: bool,
    /// 身份证号（登录实名用，脱敏）
    /// 可空：未实名的账号为 NULL；序列化输出保留前四位的等长遮蔽
    #[builder(default, setter(into))]
    pub id_card: Option<MaskedIdCard>,
    /// 真实姓名（登录实名用，脱敏）
    /// 可空：与 id_card 配对，未实名的账号两列都为空；序列化输出 `张*`
    #[builder(default, setter(into))]
    pub real_name: Option<MaskedName>,
    /// 是否已验证实名
    pub real_name_verified: bool,
    /// 过期时间戳（毫秒）
    /// 账户到期时间；定时任务扫描到已过期时把 enabled 置 false
    #[builder(default, setter(into))]
    pub expire_ms: Option<U64>,
    /// 状态
    /// 1-正常 2-已停用 3-已锁定
    pub status: i16,
    /// 登录失败次数
    /// 登录成功后清零；达到阈值时把 status 置 3 并写入 lock_until_ms
    pub fail_count: i16,
    /// 锁定到期时间戳（毫秒）
    /// 为空或已过期表示未锁定
    #[builder(default, setter(into))]
    pub lock_until_ms: Option<U64>,
    /// 最近登录时间戳（毫秒）
    /// 只记录成功登录，失败尝试见 login_log
    #[builder(default, setter(into))]
    pub last_login_ms: Option<U64>,
    /// 备注
    #[builder(default, setter(into))]
    pub remark: Option<String>,
    /// 是否启用
    /// false 时不可登录、不参与鉴权与菜单渲染
    pub enabled: bool,
    /// 创建人 ID
    pub creater_id: U64,
    /// 创建时间戳（毫秒）
    pub create_ms: U64,
    /// 最后修改人 ID
    pub updater_id: U64,
    /// 最后修改时间戳（毫秒）
    pub update_ms: U64,
}

/// ex 批量查询（list-ex / page-ex / search 系 ex 变体）从 `ModelEx` 转换：
/// 关联字段（adm_person / 各 has_many）不进列表 VO，只取平铺的标量字段
#[cfg(feature = "server")]
impl From<crate::mo::adm_user::ModelEx> for AdmUserListVo {
    fn from(m: crate::mo::adm_user::ModelEx) -> Self {
        Self {
            id: m.id.into(),
            person_id: m.person_id.map(Into::into),
            name: m.name,
            nick_name: m.nick_name,
            mobile: m.mobile.map(Into::into),
            mobile_verified: m.mobile_verified,
            email: m.email.map(Into::into),
            email_verified: m.email_verified,
            id_card: m.id_card.map(Into::into),
            real_name: m.real_name.map(Into::into),
            real_name_verified: m.real_name_verified,
            expire_ms: m.expire_ms.map(Into::into),
            status: m.status,
            fail_count: m.fail_count,
            lock_until_ms: m.lock_until_ms.map(Into::into),
            last_login_ms: m.last_login_ms.map(Into::into),
            remark: m.remark,
            enabled: m.enabled,
            creater_id: m.creater_id.into(),
            create_ms: m.create_ms.into(),
            updater_id: m.updater_id.into(),
            update_ms: m.update_ms.into(),
        }
    }
}

#[cfg(all(test, feature = "server"))]
mod tests {
    use super::*;

    /// ex 批量转换后序列化只出遮蔽结果：原值不进 JSON，也不进 Debug
    #[test]
    fn ex_to_list_vo_masks_sensitive_fields() {
        let ex = crate::mo::adm_user::ModelEx {
            name: "admin".to_string(),
            mobile: Some("13812348000".to_string()),
            email: Some("someone@example.com".to_string()),
            id_card: Some("11010119900307777X".to_string()),
            real_name: Some("张三".to_string()),
            ..Default::default()
        };
        let vo = AdmUserListVo::from(ex);
        let json = serde_json::to_string(&vo).unwrap();
        assert!(json.contains("\"mobile\":\"138****8000\""), "{json}");
        assert!(json.contains("\"realName\":\"张*\""), "{json}");
        assert!(!json.contains("13812348000"), "{json}");
        assert!(!json.contains("someone@example.com"), "{json}");
        assert!(!json.contains("7777X"), "{json}");
        assert!(!json.contains("张三"), "{json}");
        assert!(!format!("{vo:?}").contains("13812348000"), "Debug 也不该带原值");
    }
}
