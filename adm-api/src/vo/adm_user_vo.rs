use crate::dic::UserStatus;
use robotech::macros::vo;

/// # 用户
///
/// 不返回 `password`：口令只进不出，前端拿不到也就不会把它渲染到页面上。
/// 需要知道用户属于哪个角色时看 `role_id`，要角色明细请单独查角色接口 ——
/// 把角色整个对象嵌进来会让用户列表的响应体随角色字段变化而膨胀。
#[vo]
pub struct AdmUserVo {
    /// ID
    pub id: u64,
    /// 角色ID
    pub role_id: u64,
    /// 登录账号
    pub username: String,
    /// 昵称
    pub nickname: String,
    /// 手机号
    pub mobile: Option<String>,
    /// 邮箱
    pub email: Option<String>,
    /// 头像地址
    pub avatar: Option<String>,
    /// 用户状态
    pub status: UserStatus,
    /// 最近登录时间戳
    pub last_login_ms: Option<u64>,
    /// 备注
    pub remark: Option<String>,
    /// 创建者ID
    pub creater_id: u64,
    /// 创建时间
    pub create_ms: u64,
    /// 更新者ID
    pub updater_id: u64,
    /// 更新时间
    pub update_ms: u64,
}
