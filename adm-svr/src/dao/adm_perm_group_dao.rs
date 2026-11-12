use robotech::macros::dao;

/// # 权限分组
///
/// 层级不固定，树形由 tree_code 表达，tree_code 全局唯一；
/// 平台种子按「平台管理 → 菜单一级 → 主体 → 操作类型」四层组织
///
/// 唯一键名与数据库里的约束名对齐（`ak_{列名_and_连接}_{表名}`），
/// 对不上就会把「重复键」的错误退化成 500。
#[dao(
    unique_keys: [
        ("tree_code", "树编码"),
    ],
    like_columns: [
        Column::TreeCode,
        Column::Name,
        Column::Remark,
    ],
)]
pub struct AdmPermGroupDao;
