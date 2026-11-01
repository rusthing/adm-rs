use robotech::macros::dao;

/// # 组织用户
///
/// 组织与用户的多对多关系，一个人在多个组织任职时有多行
///
/// 唯一键名与数据库里的约束名对齐（`ak_{列名_and_连接}_{表名}`），
/// 对不上就会把「重复键」的错误退化成 500。
#[dao(
    unique_keys: [
        ("org_id_and_user_id", "组织ID与用户ID"),
    ],
)]
pub struct AdmOrgUserDao;
