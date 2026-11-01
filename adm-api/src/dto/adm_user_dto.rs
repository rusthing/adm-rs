//! # 用户 DTO
//!
//! 口令只进不出：`password` 只在写请求里出现，落库前由 `AdmUserSvc` 的写前钩子加盐
//! 摘要，查询结果（VO）里没有这一列。修改时留空表示「不改口令」，避免改个昵称
//! 也要把口令重打一遍。

use crate::dic::UserStatus;
use robotech::macros::crud_dto;

#[crud_dto]
pub struct AdmUserDto {
    /// 角色ID
    pub role_id: u64,
    /// 登录账号（唯一）
    /// @len 3..=50
    pub username: String,
    /// 昵称
    /// @len 1..=50
    pub nickname: String,
    /// 登录口令（新增必填；修改时留空表示不修改）
    /// @len 0..=64
    pub password: Option<String>,
    /// 手机号
    /// @len 0..=20
    pub mobile: Option<String>,
    /// 邮箱
    /// @len 0..=100
    pub email: Option<String>,
    /// 头像地址
    /// @len 0..=500
    pub avatar: Option<String>,
    /// 用户状态
    #[db_default]
    pub status: UserStatus,
    /// 最近登录时间戳（由登录流程回写，管理端不用手工填）
    #[db_default]
    pub last_login_ms: Option<u64>,
    /// 备注
    /// @len 0..=200
    pub remark: Option<String>,
}
