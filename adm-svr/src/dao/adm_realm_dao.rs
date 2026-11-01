use robotech::macros::dao;

/// # 领域
///
/// 权限与数据隔离的顶层单位：用户、组织、角色分组、权限分组都按领域隔离
///
/// 一个组织/用户可以归属多个领域，关联见 realm_org / realm_user
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
pub struct AdmRealmDao;
