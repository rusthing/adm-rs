use robotech::macros::dao;

/// # 角色菜单
///
/// 角色与菜单的多对多关联，决定该角色登录后能看到哪些菜单
///
/// 唯一键名与数据库里的约束名对齐（`ak_{列名_and_连接}_{表名}`），
/// 对不上就会把「重复键」的错误退化成 500。
#[dao(
    unique_keys: [
        ("menu_id_and_role_id", "菜单ID与角色ID"),
    ],
)]
pub struct AdmRoleMenuDao;
