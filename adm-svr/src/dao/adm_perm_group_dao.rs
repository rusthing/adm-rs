use robotech::macros::dao;

/// # 权限分组
///
/// 按领域隔离的两级结构（分组 → 权限），树形由 tree_code 表达
///
/// 唯一键名与数据库里的约束名对齐（`ak_{列名_and_连接}_{表名}`），
/// 对不上就会把「重复键」的错误退化成 500。
#[dao(
    unique_keys: [
        ("realm_id_and_tree_code", "领域ID与树编码"),
    ],
    like_columns: [
        Column::TreeCode,
        Column::Name,
        Column::Remark,
    ],
)]
pub struct AdmPermGroupDao;
