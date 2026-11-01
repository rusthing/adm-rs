use crate::dic::DataScope;
use robotech::macros::vo;

/// # 角色
#[vo]
pub struct AdmRoleVo {
    /// ID
    pub id: u64,
    /// 角色编码
    pub code: String,
    /// 角色名称
    pub name: String,
    /// 数据范围
    pub data_scope: DataScope,
    /// 排序
    pub sort: i32,
    /// 启用
    pub enabled: bool,
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
