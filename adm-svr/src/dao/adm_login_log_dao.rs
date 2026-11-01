use robotech::macros::dao;

/// # 登录日志
///
/// 每次登录尝试一行（含失败），用于安全审计与异常登录排查
///
/// 唯一键名与数据库里的约束名对齐（`ak_{列名_and_连接}_{表名}`），
/// 对不上就会把「重复键」的错误退化成 500。
#[dao(
    like_columns: [
        Column::LoginIp,
    ],
)]
pub struct AdmLoginLogDao;
