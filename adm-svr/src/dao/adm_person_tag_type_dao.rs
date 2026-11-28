use robotech::macros::dao;

/// # 人员标签类型
///
/// 人员标签（`adm_person.tags`）的分类口径：技能、岗位、安全等标签类型。
/// 标签本身仍按名称自由写入，字典是弱引用，不建外键。
///
/// 唯一键名与数据库里的约束名对齐（`ak_{列名}_{表名}`），
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
pub struct AdmPersonTagTypeDao;
