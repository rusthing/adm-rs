//! # 口令摘要
//!
//! 骨架阶段的口令处理：`hex(sha256(salt + raw))`。加盐保证同一口令在不同部署下
//! 摘要不同，避免彩虹表直接命中。
//!
//! > ⚠️ SHA-256 是**快**哈希，抗暴力破解能力有限。正式接入认证（登录、令牌、
//! > 失败锁定）时应整体换成慢哈希（argon2 / bcrypt / pbkdf2），届时只需替换本文件
//! > 的两个函数，调用方（`AdmUserSvc` 的写前钩子）不用动。

use sha2::{Digest, Sha256};

/// # 口令工具
pub struct AdmPasswordUtils;

impl AdmPasswordUtils {
    /// # 计算加盐摘要
    ///
    /// ## 参数
    /// * `salt` - 盐值，来自配置 `[adm] password-salt`
    /// * `raw` - 明文口令
    ///
    /// ## 返回值
    /// * `String` - 小写十六进制的摘要
    ///
    /// ## 示例
    /// ```ignore
    /// let hashed = AdmPasswordUtils::hash("adm", "admin123");
    /// assert_eq!(hashed.len(), 64);
    /// ```
    pub fn hash(salt: &str, raw: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(salt.as_bytes());
        hasher.update(raw.as_bytes());
        hex::encode(hasher.finalize())
    }

    /// # 校验明文口令与摘要是否匹配
    ///
    /// ## 参数
    /// * `salt` - 盐值，必须与生成摘要时一致
    /// * `raw` - 待校验的明文口令
    /// * `hashed` - 库里存的摘要
    ///
    /// ## 返回值
    /// * `bool` - 匹配返回 `true`
    pub fn verify(salt: &str, raw: &str, hashed: &str) -> bool {
        Self::hash(salt, raw) == hashed
    }
}
