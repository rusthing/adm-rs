//! # 权限 VO
//!
//! 最小授权单元，用 URN 表达「HTTP 方法 + 资源路径」；与角色的关联见 role_perm，与菜单的关联见 menu_perm

use robotech::macros::vo;

#[vo]
pub struct AdmPermVo {
    /// 主键
    pub id: u64,
    /// 权限分组 ID
    /// 关联 perm_group；(group_id, name) 唯一，不同分组可以重名
    pub group_id: u64,
    /// 主体编码
    /// 权限作用的业务对象（用户 / 人员 / 组织 / 角色 / 菜单 / 权限 / 领域 / 应用 / 日志 ...），
    /// 与 perm_group 第三层主体分组一一对应；权限名称只写动作，不再带「用户-」这类前缀
    /// @len 1..=50
    /// @check is_code
    pub subject_code: String,
    /// 操作类型编码
    /// 必填；关联 op_type.code（存编码不是 ID），一个权限点必须能对应一种操作类型，
    /// 不允许为空，取值受 op_type 字典限制
    /// @len 1..=50
    /// @check is_code
    pub op_type_code: String,
    /// 名称
    /// 同一分组内唯一（AK）
    /// @len 1..=50
    pub name: String,
    /// URN
    /// 格式 METHOD:路径，如 GET:/api/v1/users；全局唯一（AK）
    /// 鉴权时按前缀匹配，写错一个字符就是永不命中，创建后不要改
    /// @len 1..=100
    pub urn: String,
    /// 排序值
    /// 同一分组内排序，越小越靠前
    /// @range 0..=9999
    pub sort_order: i32,
    /// 备注
    /// @len 0..=50
    pub remark: Option<String>,
    /// 是否启用
    /// false 时不可再被选择，不参与鉴权与菜单渲染，历史数据与关联全部保留
    /// 与删除的区别：删除是物理删除（外键 restrict 会挡住），停用只影响后续使用
    pub enabled: bool,
    /// 创建人 ID
    pub creater_id: u64,
    /// 创建时间戳（毫秒）
    pub create_ms: u64,
    /// 最后修改人 ID
    pub updater_id: u64,
    /// 最后修改时间戳（毫秒）
    pub update_ms: u64,
}
