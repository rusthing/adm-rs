//! # 角色 DTO
//!
//! 角色是「权限的容器」：`code` 给程序用（权限判断），`name` 给人看（界面展示），
//! 两者都做唯一键 —— 编码重了会让授权含义含糊，名称重了会让运维在界面上分不清。

use crate::dic::DataScope;
use robotech::macros::crud_dto;

#[crud_dto]
pub struct AdmRoleDto {
    /// 角色编码（程序内唯一标识，建议大写下划线）
    /// @len 1..=50
    pub code: String,
    /// 角色名称
    /// @len 1..=50
    pub name: String,
    /// 数据范围
    #[db_default]
    pub data_scope: DataScope,
    /// 排序（升序，值小的靠前）
    /// @range 0..=9999
    #[db_default]
    pub sort: i32,
    /// 启用
    #[db_default]
    pub enabled: bool,
    /// 备注
    /// @len 0..=200
    pub remark: Option<String>,
}
