use robotech::macros::dao;

/// # 用户（账号）
///
/// 回答「哪个标识能登进哪个账号」：登录名、登录用手机/邮箱、实名信息（姓名 + 身份证）、三套密码、状态
///
/// 实名信息与核验位放在本表：登录时的实名校验以账号为单位，person 只存人员档案、不记核验状态
///
/// 唯一键名与数据库里的约束名对齐（`ak_{列名_and_连接}_{表名}`），
/// 对不上就会把「重复键」的错误退化成 500。
#[dao(
    unique_keys: [
        ("name", "名称"),
        ("mobile", "手机号"),
        ("email", "电子邮箱"),
        ("id_card", "身份证号"),
    ],
    like_columns: [
        Column::Name,
        Column::NickName,
        Column::Mobile,
        Column::Email,
        Column::IdCard,
        Column::RealName,
        Column::Remark,
    ],
)]
pub struct AdmUserDao;
