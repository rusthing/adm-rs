//! # 操作日志 VO
//!
//! 记录谁在什么时候对哪个接口做了什么；只增不改，用户删除受限以保证可追溯

use robotech::macros::vo;

#[vo]
pub struct AdmOpLogVo {
    /// 主键
    pub id: u64,
    /// 操作用户 ID
    /// 关联 user；日志表要求可追溯，所以用户删除受限（restrict）
    pub user_id: u64,
    /// 操作类型编码
    /// 关联 op_type.code（存编码不是 ID）
    /// @len 1..=50
    /// @check is_code
    pub op_type_code: String,
    /// 操作标题
    /// 列表展示用，如「新增用户」「导出报表」
    /// @len 1..=50
    pub op_title: String,
    /// 操作 URN
    /// 被调用接口的 URN，格式同 perm.urn（METHOD:路径），如 GET:/api/v1/users
    /// 与 perm.urn 同宽 100：两者是同一套标识，长度不一致会在审计里出现被截断的地址
    /// @len 1..=100
    pub op_urn: String,
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
