use robotech::macros::dao;

/// # 权限分组
///
/// 全局两级结构（分组 → 权限），树形由 tree_code 表达，tree_code 全局唯一
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
