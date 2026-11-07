//! # 认证相关的业务编码
//!
//! 与框架的 `RO_CODE_WARNING_*`（`RTW` 前缀，框架级语义）区分开：这里是 adm 的
//! **业务**编码，前缀 `ADM`。前端拿 `Ro.code` 判分支比拿 `msg` 字符串稳。
//!
//! 登录失败这类结果走 `Ro::warn` + 对应编码（HTTP 200），不用 4xx：
//! 框架的 `CtrlError` 只有「参数校验 / 找不到 / 运行时」三档，把「口令不对」塞进
//! 参数校验会变成「参数校验错误 -> 账号或密码错误」，前端也得靠字符串匹配。

/// 账号或口令不正确
///
/// 「账号不存在」与「口令错误」共用这一个编码：分开会让攻击者能枚举出哪些
/// 账号存在。
pub const ADM_CODE_LOGIN_FAILED: &str = "ADM00001";

/// 账号已被锁定（连续口令错误触发）
pub const ADM_CODE_ACCOUNT_LOCKED: &str = "ADM00002";

/// 账号已停用（`enabled=false` 或 `status=已停用`）
pub const ADM_CODE_ACCOUNT_DISABLED: &str = "ADM00003";

/// 账号已过期（`expire_ms` 已到）
pub const ADM_CODE_ACCOUNT_EXPIRED: &str = "ADM00004";

/// 令牌无效（签名不对、已过期、已登出）
pub const ADM_CODE_TOKEN_INVALID: &str = "ADM00005";

/// 登录标识不唯一（同一个串同时命中多个账号的不同列）
pub const ADM_CODE_ACCOUNT_AMBIGUOUS: &str = "ADM00006";

/// 高危操作二次确认：口令不正确
///
/// 与登录失败 [`ADM_CODE_LOGIN_FAILED`] **分开**：调用方需要明确区分
/// 「口令输错」和「当前用户不可用」，且这条路径不参与登录失败计数与锁定。
pub const ADM_CODE_VERIFY_PASSWORD_FAILED: &str = "ADM00007";

/// 高危操作二次确认：错误尝试过于频繁（短时间窗口内超过阈值）
///
/// 这是频控命中，不是口令正确性结果。调用方看到它应当暂停重试并提示用户
/// 稍后再试，而不是继续试口令。
pub const ADM_CODE_VERIFY_PASSWORD_RATE_LIMITED: &str = "ADM00008";

/// 高危操作二次确认：当前用户不可用
///
/// 覆盖用户不存在、已停用、已锁定、已过期。与 [`ADM_CODE_VERIFY_PASSWORD_FAILED`]
/// 区分，方便调用方提示「换口令」还是「找管理员」。
pub const ADM_CODE_VERIFY_PASSWORD_USER_UNAVAILABLE: &str = "ADM00009";
