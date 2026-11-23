use robotech::macros::router;

/// # 用户解锁路由
///
/// `POST /adm/user/{id}/unlock`。与用户 CRUD 路由分开，避免和
/// `#[router(crud)]` 生成的 23 条路由挤在同一棵树。
#[router(routes [("/adm/user/{id}/unlock", post(unlock))])]
struct AdmUserUnlockRouter;
