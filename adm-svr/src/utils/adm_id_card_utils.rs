//! 身份证号的写库前校验与归一化。
//!
//! DTO 上的 `@check is_id_card_cn` 只挂在 AddDto 上：`ModifyDto` / `SaveDto` /
//! `SyncDto` 由宏刻意去掉了字段级 `validate`，所以普通修改和 `/sync` 都不会
//! 走这条校验。迁移时源端的 `1`、`12`、`测试`、`452****034`、18 位但校验位
//! 错误的号码就是从这里进来的。
//!
//! 这里补一个服务层钩子能直接调用的入口：空白串归一成 `None`，非空值必须通过
//! `wheel_rs::regex_utils::is_id_card_cn`（18 位、出生日期真实且不在未来、
//! ISO 7064 校验位正确）。

use std::borrow::Cow;

use robotech::svc::SvcError;
use validator::ValidationError;
use wheel_rs::regex_utils::is_id_card_cn;

/// 校验并归一化身份证号。
///
/// DTO 宏会把源字段 `Option<String>` 再包一层，所以这里收到的是
/// `Option<Option<String>>`：
///
/// - 外层 `None`：请求没传这一列，保持 `None`（更新时即“不修改这一列”）；
/// - 外层 `Some(None)`：请求显式传了 `null`，保持 `Some(None)`（清空）；
/// - `Some(Some(""))` / 全空白：按“没有身份证号”处理，归一成 `Some(None)`；
/// - 其它：去掉首尾空白后必须是合法的 18 位中国大陆身份证号。
pub fn normalize_id_card(
    id_card: Option<Option<String>>,
) -> Result<Option<Option<String>>, SvcError> {
    let Some(value) = id_card else {
        return Ok(None);
    };
    let Some(value) = value else {
        return Ok(Some(None));
    };
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Ok(Some(None));
    }
    if is_id_card_cn(trimmed) {
        return Ok(Some(Some(trimmed.to_owned())));
    }

    let mut error = ValidationError::new("id_card");
    error.message = Some(Cow::from("身份证号格式不正确，必须是 18 位且校验位正确"));
    Err(error.into())
}

#[cfg(test)]
mod tests {
    use super::normalize_id_card;

    #[test]
    fn accepts_valid_id_card() {
        assert_eq!(
            normalize_id_card(Some(Some("11010519491231002X".to_string()))).unwrap(),
            Some(Some("11010519491231002X".to_string()))
        );
    }

    #[test]
    fn rejects_short_and_masked_values() {
        for value in [
            "1",
            "12",
            "123123",
            "452****034",
            "18577278656",
            "51370119991263",
        ] {
            assert!(
                normalize_id_card(Some(Some(value.to_string()))).is_err(),
                "{value} 不应通过"
            );
        }
    }

    #[test]
    fn rejects_eighteen_digits_with_bad_checksum() {
        assert!(normalize_id_card(Some(Some("110105194912310021".to_string()))).is_err());
    }

    #[test]
    fn blank_becomes_none() {
        assert_eq!(
            normalize_id_card(Some(Some("   ".to_string()))).unwrap(),
            Some(None)
        );
    }
}
