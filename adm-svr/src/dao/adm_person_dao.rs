use robotech::macros::dao;

/// # 人员（自然人）
///
/// 回答「这个人是谁」：真实姓名、拼音、身份证、联系方式，是身份主数据
///
/// 不记实名核验状态：核验位在 user.real_name_verified 上，一个自然人多个账号时各自独立
///
/// 一个自然人可以有零个或多个账号，账号侧通过 user.person_id 回指
///
/// 唯一键名与数据库里的约束名对齐（`ak_{列名_and_连接}_{表名}`），
/// 对不上就会把「重复键」的错误退化成 500。
#[dao(
    unique_keys: [
        ("code_type_id_and_code", "编码类型ID与编码"),
        ("email", "电子邮箱"),
        ("id_card", "身份证号"),
    ],
    like_columns: [
        Column::Code,
        Column::Name,
        Column::NamePinyinAbbr,
        Column::NamePinyinFull,
        Column::Mobile,
        Column::Email,
        Column::IdCard,
        Column::Remark,
    ],
)]
pub struct AdmPersonDao;
