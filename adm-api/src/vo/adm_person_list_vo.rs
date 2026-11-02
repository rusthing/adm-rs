//! # 人员（自然人）列表 VO（脱敏）
//!
//! 批量查询（list / page / search 系，含 ex 变体）的专用响应；敏感字段用
//! [`robotech::api::mask`] 的包装类型，序列化与 Debug 都只出遮蔽结果。
//!
//! 单条详情不走本 VO，继续用 [`crate::vo::AdmPersonVo`] 回显原值——
//! 两条路靠类型区分，不靠「记得调用某个函数」。
//!
//! 字段集与 [`AdmPersonVo`] 相同，差异是四个可定位个人的字段换成了脱敏包装：
//! `name` / `mobile` / `email` / `id_card`。

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
pub struct AdmPersonListVo {
    /// 主键
    pub id: U64,
    /// 人员编码类型 ID
    /// 关联 person_code_type；为空表示该人员没有工号/学号
    #[builder(default, setter(into))]
    pub code_type_id: Option<U64>,
    /// 编码
    /// 工号、学号等业务编号，含义由 code_type_id 决定
    /// (code_type_id, code) 唯一（AK）
    #[builder(default, setter(into))]
    pub code: Option<String>,
    /// 姓名（脱敏）
    /// 序列化输出 `张*`；与拼音两列合起来仍能定位到人的只有原值路径（单条详情）
    pub name: MaskedName,
    /// 姓名拼音首字母
    /// 大写、无分隔（张三 → ZS），用于快速检索
    #[builder(default, setter(into))]
    pub name_pinyin_abbr: Option<String>,
    /// 姓名拼音全拼
    /// 小写、音节间无分隔（张三 → zhangsan），用于快速检索
    #[builder(default, setter(into))]
    pub name_pinyin_full: Option<String>,
    /// 手机号（档案联系方式，脱敏）
    /// 人员档案上的号码，可与账号登录手机号不同；不做唯一约束
    #[builder(default, setter(into))]
    pub mobile: Option<MaskedMobile>,
    /// 邮箱（档案联系方式，脱敏）
    /// 全局唯一（AK）：一个邮箱只对应一个人员档案
    #[builder(default, setter(into))]
    pub email: Option<MaskedEmail>,
    /// 身份证号（脱敏）
    /// 全局唯一（AK）：同一自然人只应有一条有效档案
    #[builder(default, setter(into))]
    pub id_card: Option<MaskedIdCard>,
    /// 备注
    #[builder(default, setter(into))]
    pub remark: Option<String>,
    /// 是否启用
    /// false 时不可再被选择，历史数据与关联全部保留
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

/// ex 批量查询从 `ModelEx` 转换：关联字段不进列表 VO，只取平铺的标量字段
#[cfg(feature = "server")]
impl From<crate::mo::adm_person::ModelEx> for AdmPersonListVo {
    fn from(m: crate::mo::adm_person::ModelEx) -> Self {
        Self {
            id: m.id.into(),
            code_type_id: m.code_type_id.map(Into::into),
            code: m.code,
            name: m.name.into(),
            name_pinyin_abbr: m.name_pinyin_abbr,
            name_pinyin_full: m.name_pinyin_full,
            mobile: m.mobile.map(Into::into),
            email: m.email.map(Into::into),
            id_card: m.id_card.map(Into::into),
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

    /// ex 批量转换后序列化只出遮蔽结果
    #[test]
    fn ex_to_list_vo_masks_sensitive_fields() {
        let ex = crate::mo::adm_person::ModelEx {
            name: "张三".to_string(),
            mobile: Some("13812348000".to_string()),
            email: Some("someone@example.com".to_string()),
            id_card: Some("11010119900307777X".to_string()),
            ..Default::default()
        };
        let vo = AdmPersonListVo::from(ex);
        let json = serde_json::to_string(&vo).unwrap();
        assert!(json.contains("\"name\":\"张*\""), "{json}");
        assert!(!json.contains("张三"), "{json}");
        assert!(!json.contains("13812348000"), "{json}");
        assert!(!json.contains("7777X"), "{json}");
    }
}
