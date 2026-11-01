use robotech::macros::dao;

/// # 组织
///
/// 树形结构由 tree_code 表达；与领域、用户都是多对多（realm_org / org_user），组织本身不自带领域列
///
/// 唯一键名与数据库里的约束名对齐（`ak_{列名_and_连接}_{表名}`），
/// 对不上就会把「重复键」的错误退化成 500。
#[dao(
    unique_keys: [
        ("code", "编码"),
        ("full_name", "全名"),
        ("tree_code", "树编码"),
    ],
    like_columns: [
        Column::Code,
        Column::TreeCode,
        Column::Name,
        Column::FullName,
        Column::Remark,
    ],
)]
pub struct AdmOrgDao;
