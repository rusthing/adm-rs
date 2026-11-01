//! # 操作类型 VO
//!
//! 初始有查看(Read)、 添加(Create)、修改(Update)、删除(Delete)、登录(Login)、登出(Logout)、导入(Import)、导出(Export)
//! 、上传(Upload)、下载(Download)、审核(Audit)、授权(Assign)、打印(Print)这些类型

use robotech::macros::vo;

#[vo]
pub struct AdmOpTypeVo {
    /// 主键
    pub id: u64,
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
    /// 越小越靠前
    /// @range 0..=9999
    pub sort_order: i32,
    /// 备注
    /// @len 0..=50
    pub remark: Option<String>,
    /// 创建人 ID
    pub creater_id: u64,
    /// 创建时间戳（毫秒）
    pub create_ms: u64,
    /// 最后修改人 ID
    pub updater_id: u64,
    /// 最后修改时间戳（毫秒）
    pub update_ms: u64,
}
