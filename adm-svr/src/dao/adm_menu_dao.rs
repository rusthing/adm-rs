use robotech::macros::dao;

/// # 菜单
///
/// 前端动态路由的数据源：一棵树 + 组件路径 + 权限点
///
/// 目录与菜单的区别由 component 是否为空推导，不用单独的类型列
///
/// 唯一键名与数据库里的约束名对齐（`ak_{列名_and_连接}_{表名}`），
/// 对不上就会把「重复键」的错误退化成 500。
#[dao(
    unique_keys: [
        ("app_id_and_tree_code", "应用ID与树编码"),
        ("app_id_and_name", "应用ID与名称"),
        ("app_id_and_code", "应用ID与编码"),
    ],
    like_columns: [
        Column::TreeCode,
        Column::Code,
        Column::Name,
        Column::Path,
        Column::Component,
        Column::Icon,
        Column::Remark,
    ],
)]
pub struct AdmMenuDao;
