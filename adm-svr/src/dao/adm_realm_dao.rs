use robotech::macros::dao;

/// # 领域
///
/// 用户与组织的数据域划分单位：只用于界定用户/组织归属与角色的数据可见范围，
/// 与应用、菜单、角色、权限等全局配置无关
///
/// 一个组织/用户可以归属多个领域，关联见 realm_org / realm_user；角色的数据范围见 adm_role_scope
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
