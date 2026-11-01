use robotech::macros::dao;

/// # 角色权限
///
/// 角色与权限的多对多授权关系，鉴权时按 user → role_user → role_perm → perm.urn 展开
///
/// 唯一键名与数据库里的约束名对齐（`ak_{列名_and_连接}_{表名}`），
/// 对不上就会把「重复键」的错误退化成 500。
#[dao(
    unique_keys: [
        ("role_id_and_perm_id", "角色ID与权限ID"),
    ],
)]
pub struct AdmRolePermDao;
