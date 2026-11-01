use robotech::macros::dao;

/// # 应用
///
/// 菜单树的归属单位，一个领域下可以有多个应用（后台、前台、移动端）
///
/// 唯一键名与数据库里的约束名对齐（`ak_{列名_and_连接}_{表名}`），
/// 对不上就会把「重复键」的错误退化成 500。
#[dao(
    unique_keys: [
        ("code", "编码"),
        ("name", "名称"),
    ],
    like_columns: [
        Column::Code,
        Column::Name,
        Column::Remark,
    ],
)]
pub struct AdmAppDao;
