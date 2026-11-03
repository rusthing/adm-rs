//! # 操作类型 DTO
//!
//! 初始有查看(Read)、 添加(Create)、修改(Update)、删除(Delete)、登录(Login)、登出(Logout)、导入(Import)、导出(Export)
//! 、上传(Upload)、下载(Download)、审核(Audit)、授权(Assign)、打印(Print)这些类型
//!
//! 校验标签：`@len` / `@range` 是结构约束，`@check is_xxx` 调
//! `wheel_rs::regex_utils` 的谓词做语义校验（能带校验位），`@unit` 只是单位说明。

use robotech::macros::crud_dto;

#[crud_dto]
pub struct AdmOpTypeDto {
    /// 编码
    /// 业务编号，允许字母、数字与 _ . -（如 SYS_ADMIN、GROUP_HQ）
    /// @len 1..=50
    /// @check is_code
    pub code: String,
    /// 名称
    /// 全局唯一（AK）
    /// @len 1..=50
    pub name: String,
    /// 排序值
    /// 越小越靠前；由服务端自动分配，前端不可提交
    /// @range 0..=9999
    #[fill_by_svc]
    pub sort_order: i32,
    /// 备注
    /// @len 0..=50
    pub remark: Option<String>,
}
