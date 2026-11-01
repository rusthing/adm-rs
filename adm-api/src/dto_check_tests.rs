//! # DTO 校验标签的回归测试
//!
//! 验证 `#[crud_dto]` 对模型注释里四个标签的处理，重点是 `@check`：
//! 它要真的调 `wheel_rs::regex_utils` 的谓词（能拦住校验位错的身份证），
//! 而不是把注释当摆设。
//!
//! 这些用例跟着宏走：改了标签语义，这里应该先红。

#![cfg(all(test, feature = "server"))]

use crate::dto::adm_option_dto::*;
use validator::Validate;

fn valid_option() -> AdmOptionAddDto {
    AdmOptionAddDto {
        code: Some("user_status".to_string()),
        name: Some("用户状态".to_string()),
        value: Some("1".to_string()),
        ..Default::default()
    }
}

#[test]
fn valid_value_passes() {
    assert!(valid_option().validate().is_ok());
}

#[test]
fn check_tag_rejects_bad_code() {
    let dto = AdmOptionAddDto {
        // `is_code` 只允许字母/数字/下划线/点/连字符，空格与感叹号都不行
        code: Some("bad code!".to_string()),
        ..valid_option()
    };
    let errors = dto.validate().unwrap_err();
    assert!(
        errors.field_errors().contains_key("code"),
        "@check is_code 应当拒绝非法编码"
    );
}

#[test]
fn check_message_is_chinese() {
    let dto = AdmOptionAddDto {
        code: Some("bad code!".to_string()),
        ..valid_option()
    };
    let errors = dto.validate().unwrap_err();
    let message = errors.field_errors()["code"][0]
        .message
        .as_deref()
        .unwrap_or_default();
    assert!(
        message.contains("编码"),
        "提示语应当带上字段中文名，实际是 {message}"
    );
}

#[test]
fn len_tag_still_works() {
    let dto = AdmOptionAddDto {
        code: Some("a".repeat(51)),
        ..valid_option()
    };
    assert!(
        dto.validate().unwrap_err().field_errors().contains_key("code"),
        "@len 1..=50 应当拦住超长编码"
    );
}

#[test]
fn optional_none_is_skipped() {
    // remark 是 Option<String>，注释带 @len 0..=50；None 不该报格式错
    let dto = AdmOptionAddDto {
        remark: None,
        ..valid_option()
    };
    assert!(dto.validate().is_ok());
}

#[test]
fn required_field_missing_is_reported() {
    let dto = AdmOptionAddDto {
        name: None,
        ..valid_option()
    };
    assert!(
        dto.validate().unwrap_err().field_errors().contains_key("name"),
        "必填字段缺失应当报错"
    );
}
