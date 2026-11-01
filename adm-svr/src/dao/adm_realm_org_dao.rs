use robotech::macros::dao;

/// # 领域组织
///
/// 领域与组织的多对多归属，一个组织可服务于多个领域
///
/// 唯一键名与数据库里的约束名对齐（`ak_{列名_and_连接}_{表名}`），
/// 对不上就会把「重复键」的错误退化成 500。
#[dao(
    unique_keys: [
        ("realm_id_and_org_id", "领域ID与组织ID"),
    ],
)]
pub struct AdmRealmOrgDao;
