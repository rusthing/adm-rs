use robotech::macros::dao;

/// # 用户
///
/// `username` 是登录凭据，必须唯一；`mobile` 在库里是唯一键，但**允许多行为空**
/// （PostgreSQL 的唯一约束不约束 NULL），所以没填手机号的用户不会互相顶掉。
///
/// `role_id` 是外键，删除角色时由服务侧提前拦一道，把数据库的约束错误换成可读提示。
#[dao(
    unique_keys: [
        ("username", "登录账号"),
        ("mobile", "手机号"),
    ],
    foreign_keys: [
        ("role_id", "adm_role", "角色"),
    ],
    like_columns: [
        Column::Username,
        Column::Nickname,
        Column::Mobile,
        Column::Email,
        Column::Remark,
    ],
)]
pub struct AdmUserDao;
