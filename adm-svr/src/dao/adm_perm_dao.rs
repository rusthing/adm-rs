use robotech::macros::dao;

/// # 权限
///
/// 最小授权单元，用 URN 表达「HTTP 方法 + 资源路径」；与角色的关联见 role_perm，与菜单的关联见 menu_perm
///
/// 唯一键名与数据库里的约束名对齐（`ak_{列名_and_连接}_{表名}`），
/// 对不上就会把「重复键」的错误退化成 500。
#[dao(
    unique_keys: [
        ("group_id_and_name", "分组ID与名称"),
        ("urn", "URN"),
    ],
    like_columns: [
        Column::OpTypeCode,
        Column::Name,
        Column::Urn,
        Column::Remark,
    ],
)]
pub struct AdmPermDao;
