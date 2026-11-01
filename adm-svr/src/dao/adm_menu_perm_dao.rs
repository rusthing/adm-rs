use robotech::macros::dao;

/// # 菜单权限
///
/// 菜单与权限点的多对多关联，前端据此计算每个页面上的按钮权限（meta.perms）
///
/// 唯一键名与数据库里的约束名对齐（`ak_{列名_and_连接}_{表名}`），
/// 对不上就会把「重复键」的错误退化成 500。
#[dao(
    unique_keys: [
        ("menu_id_and_perm_id", "菜单ID与权限ID"),
    ],
)]
pub struct AdmMenuPermDao;
