use robotech::macros::dao;

/// # 角色
///
/// 权限的集合，按分组管理；角色与用户的关联见 role_user，与权限的关联见 role_perm
///
/// 唯一键名与数据库里的约束名对齐（`ak_{列名_and_连接}_{表名}`），
/// 对不上就会把「重复键」的错误退化成 500。
#[dao(
    unique_keys: [
        ("group_id_and_name", "分组ID与名称"),
    ],
    like_columns: [
        Column::Name,
        Column::Remark,
    ],
)]
pub struct AdmRoleDao;
