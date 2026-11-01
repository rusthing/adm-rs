use robotech::macros::dao;

/// # 选项（字典）
///
/// 一组选项用同一个 code 归集（如 user_status），每个可选值一行
///
/// 唯一键名与数据库里的约束名对齐（`ak_{列名_and_连接}_{表名}`），
/// 对不上就会把「重复键」的错误退化成 500。
#[dao(
    unique_keys: [
        ("code", "编码"),
    ],
    like_columns: [
        Column::Code,
        Column::Name,
        Column::Value,
        Column::Remark,
    ],
)]
pub struct AdmOptionDao;
