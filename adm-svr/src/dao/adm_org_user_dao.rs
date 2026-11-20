use robotech::macros::dao;

/// # 组织用户
///
/// 领域、组织与用户的三方关系：一个人在某领域的某组织任职，同一人可在多个领域/组织各占一行
///
/// 唯一键名与数据库里的约束名对齐（`ak_{列名_and_连接}_{表名}`），
/// 对不上就会把「重复键」的错误退化成 500。
#[dao(
    unique_keys: [
        ("realm_id_and_org_id_and_user_id", "领域ID、组织ID与用户ID"),
    ],
    foreign_keys: [
        ("realm_id", "adm_realm", "领域"),
        ("org_id", "adm_org", "组织"),
        ("user_id", "adm_user", "用户"),
    ],
)]
pub struct AdmOrgUserDao;
