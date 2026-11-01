use robotech::macros::router;

/// # 角色路由
///
/// `#[router(crud)]` 生成 `/adm/role` 前缀下的一整套接口（新增/修改/保存/删除/查询/
/// 检索），与 [`AdmRoleCtrl`](crate::web::ctrl::adm_role_ctrl) 一一对应。
#[router(crud)]
struct AdmRoleRouter;
