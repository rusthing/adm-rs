use robotech::macros::dao;

/// # 角色
///
/// `code` 与 `name` 都做唯一键：编码重了会让授权含义含糊，名称重了会让运维在界面上
/// 分不清两个角色。两者都要在报错时给出字段中文名，所以都登记在 `unique_keys` 里。
#[dao(
    unique_keys: [
        ("code", "角色编码"),
        ("name", "角色名称"),
    ],
    like_columns: [
        Column::Code,
        Column::Name,
        Column::Remark,
    ],
)]
pub struct AdmRoleDao;
