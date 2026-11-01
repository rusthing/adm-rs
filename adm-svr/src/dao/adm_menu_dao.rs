use robotech::macros::dao;

/// # 菜单
///
/// `code` 是权限编码的唯一来源，做唯一键。`parent_id` 是自关联外键，删除父节点时
/// 由服务侧先检查有没有子节点 —— 数据库侧是 `on delete restrict`，不检查会直接
/// 抛约束错误。
#[dao(
    unique_keys: [
        ("code", "菜单编码"),
    ],
    foreign_keys: [
        ("parent_id", "adm_menu", "父菜单"),
    ],
    like_columns: [
        Column::Code,
        Column::Name,
        Column::Path,
        Column::Perm,
        Column::Remark,
    ],
)]
pub struct AdmMenuDao;
