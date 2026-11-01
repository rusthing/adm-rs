use robotech::macros::dao;

/// # 领域用户
///
/// 领域与用户的多对多归属，决定该账号能进入哪些领域
///
/// 唯一键名与数据库里的约束名对齐（`ak_{列名_and_连接}_{表名}`），
/// 对不上就会把「重复键」的错误退化成 500。
#[dao(
    unique_keys: [
        ("realm_id_and_user_id", "领域ID与用户ID"),
    ],
)]
pub struct AdmRealmUserDao;
