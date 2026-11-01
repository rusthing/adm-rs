use robotech::macros::dao;

/// # 人员编码类型
///
/// 有工号、学号等
///
/// 唯一键名与数据库里的约束名对齐（`ak_{列名_and_连接}_{表名}`），
/// 对不上就会把「重复键」的错误退化成 500。
#[dao(
    unique_keys: [
        ("name", "名称"),
    ],
    like_columns: [
        Column::Name,
        Column::Remark,
    ],
)]
pub struct AdmPersonCodeTypeDao;
