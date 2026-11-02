use robotech::macros::router;

/// # 用户口令管理路由
///
/// 只有一个接口：`POST /adm/user/{id}/reset-password`。
/// 与用户 CRUD 路由分开，避免和 `#[router(crud)]` 生成的 21 条路由挤在同一棵树。
#[router(routes [
    ("/adm/user/{id}/reset-password", post(reset_password)),
])]
struct AdmUserPasswordRouter;
