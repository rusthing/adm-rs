//! # 口令摘要
//!
//! 按模型里的约定做**两级 SM3**：
//!
//! ```text
//! 库里存的 login_pswd = SM3( 小写(SM3(明文)) + 小写(密码组合码) )
//! ```
//!
//! - 内层 `SM3(明文)` 由前端算，明文不过网；登录时前端把这次摘要发过来。
//! - 外层带每行独立的 6 位组合码，由服务端在**设置口令时**生成并落库。
//!   拿库里这列的值登不进来：要先反推内层摘要，等于再破一次 SM3。
//!
//! 三套口令（登录 / 审核 / 支付）用同一套算法，只是列名不同，共用本模块的函数。
//!
//! ## 与「加盐慢哈希」的区别
//!
//! 组合码只防「库泄露后直接重放」，不防离线暴力破解——SM3 是快哈希，攻击者
//! 拿到库可以高速试。真正的在线防线是登录失败锁定（见 `AdmAuthSvc`）。
//! 换成 argon2 之类的慢哈希需要前端协议一起改，属于另一件事，这里不做。

use rand::Rng;
use wheel_rs::sm3_utils::sm3_hex;

/// 组合码字符集
///
/// 去掉容易混淆的 `0/o`、`1/l/i`：组合码是给程序用的，但排障时人要能念出来。
const SALT_ALPHABET: &[u8] = b"23456789abcdefghjkmnpqrstuvwxyz";

/// # 口令工具
pub struct AdmPasswordUtils;

impl AdmPasswordUtils {
    /// 组合码长度，与 `login_pswd_salt CHAR(6)` 对齐
    pub const SALT_LEN: usize = 6;
    /// 摘要长度（SM3 输出 32 字节 → 64 位小写十六进制）
    pub const HASH_LEN: usize = 64;

    /// # 生成 6 位随机组合码
    ///
    /// 用线程本地 CSPRNG（`rand::rng()`，由操作系统熵源播种）。
    ///
    /// ## 返回值
    /// * `String` - 6 位小写字母与数字，字符集见 [`SALT_ALPHABET`]
    ///
    /// ## 示例
    /// ```ignore
    /// let salt = AdmPasswordUtils::gen_salt();
    /// assert_eq!(salt.len(), 6);
    /// ```
    pub fn gen_salt() -> String {
        let mut rng = rand::rng();
        (0..Self::SALT_LEN)
            .map(|_| {
                let idx = rng.random_range(0..SALT_ALPHABET.len());
                SALT_ALPHABET[idx] as char
            })
            .collect()
    }

    /// # 由「前端一次摘要」与组合码算出落库值
    ///
    /// ## 参数
    /// * `first_hash` - 前端算的 `SM3(明文)`，大小写不敏感（内部转小写）
    /// * `salt` - 该行的 6 位组合码
    ///
    /// ## 返回值
    /// * `String` - 64 位小写十六进制
    pub fn seal(first_hash: &str, salt: &str) -> String {
        let mut buffer = String::with_capacity(Self::HASH_LEN + Self::SALT_LEN);
        buffer.push_str(&first_hash.to_lowercase());
        buffer.push_str(&salt.to_lowercase());
        sm3_hex(buffer)
    }

    /// # 校验口令
    ///
    /// ## 参数
    /// * `first_hash` - 前端算的 `SM3(明文)`
    /// * `salt` - 库里的组合码
    /// * `stored` - 库里的摘要
    ///
    /// ## 返回值
    /// * `bool` - 一致返回 `true`
    pub fn verify(first_hash: &str, salt: &str, stored: &str) -> bool {
        // 长度先挡一下：省掉一次 SM3，也避免超长输入白算
        if !Self::is_first_hash(first_hash) || salt.len() != Self::SALT_LEN {
            return false;
        }
        Self::seal(first_hash, salt) == stored
    }

    /// # 判断是不是「一次摘要」
    ///
    /// 设置口令的接口要求调用方传 `SM3(明文)` 而不是明文。传明文（长度不对）
    /// 或传了别的字符串，都在这里挡掉——否则明文会被当成摘要再摘要一次，
    /// 存进去的值永远校验不过，排查起来毫无线索。
    ///
    /// ## 参数
    /// * `value` - 待判定的字符串
    ///
    /// ## 返回值
    /// * `bool` - 64 位十六进制返回 `true`
    pub fn is_first_hash(value: &str) -> bool {
        value.len() == Self::HASH_LEN
            && value.bytes().all(|b| b.is_ascii_hexdigit())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 组合码字符集与长度
    #[test]
    fn gen_salt_shape() {
        for _ in 0..50 {
            let salt = AdmPasswordUtils::gen_salt();
            assert_eq!(salt.len(), AdmPasswordUtils::SALT_LEN);
            assert!(salt.bytes().all(|b| SALT_ALPHABET.contains(&b)));
        }
        // 随机性：连取两次不该相同
        assert_ne!(AdmPasswordUtils::gen_salt(), AdmPasswordUtils::gen_salt());
    }

    /// 摘要定长、大小写归一
    #[test]
    fn seal_is_length_stable_and_case_insensitive() {
        let lower = AdmPasswordUtils::seal(&"a".repeat(64), "abc234");
        let upper = AdmPasswordUtils::seal(&"A".repeat(64), "ABC234");
        assert_eq!(lower.len(), AdmPasswordUtils::HASH_LEN);
        assert_eq!(lower, upper);
    }

    /// 组合码参与运算：同一口令、不同组合码得到不同摘要
    #[test]
    fn salt_changes_digest() {
        let first = "b".repeat(64);
        assert_ne!(
            AdmPasswordUtils::seal(&first, "aaaaaa"),
            AdmPasswordUtils::seal(&first, "bbbbbb")
        );
    }

    /// 校验：对得上、对不上、长度不对都覆盖
    #[test]
    fn verify_paths() {
        let first = "c".repeat(64);
        let salt = "xy2345";
        let stored = AdmPasswordUtils::seal(&first, salt);

        assert!(AdmPasswordUtils::verify(&first, salt, &stored));
        assert!(!AdmPasswordUtils::verify(&"d".repeat(64), salt, &stored));
        // 组合码不对
        assert!(!AdmPasswordUtils::verify(&first, "xy2346", &stored));
        // 明显不是摘要的输入（明文、空串）直接 false，不算 SM3
        assert!(!AdmPasswordUtils::verify("admin123", salt, &stored));
        assert!(!AdmPasswordUtils::verify("", salt, &stored));
    }

    /// 一次摘要的判定
    #[test]
    fn first_hash_recognition() {
        assert!(AdmPasswordUtils::is_first_hash(&"a".repeat(64)));
        assert!(AdmPasswordUtils::is_first_hash(&"0".repeat(64)));
        // 长度不对
        assert!(!AdmPasswordUtils::is_first_hash("abc"));
        assert!(!AdmPasswordUtils::is_first_hash(&"a".repeat(65)));
        // 非十六进制
        assert!(!AdmPasswordUtils::is_first_hash(&"g".repeat(64)));
        // 大写也算（前端可能大写输出），seal 里会统一转小写
        assert!(AdmPasswordUtils::is_first_hash(&"A".repeat(64)));
    }
}
