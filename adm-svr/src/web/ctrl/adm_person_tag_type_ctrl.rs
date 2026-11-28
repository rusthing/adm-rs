use robotech::macros::ctrl;

/// # 人员标签类型控制器（CRUD）
///
/// 路由前缀 `/adm/person-tag-type`，CRUD 与检索接口全部由宏生成。
#[ctrl]
struct AdmPersonTagTypeCtrl;
