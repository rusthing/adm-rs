use robotech::macros::router;

/// # 认证路由
///
/// 不生成 CRUD：路径写死在这里，与
/// [`adm_auth_ctrl`](crate::web::ctrl::adm_auth_ctrl) 的处理器一一对应。
///
/// 登录不校验令牌；`logout` / `me` / `change-password` 在处理器内自行校验
/// `Authorization: Bearer`，所以这棵路由树不挂统一鉴权中间件。
#[router(routes [
    ("/adm/auth/login", post(login)),
    ("/adm/auth/logout", post(logout)),
    ("/adm/auth/me", get(me)),
    ("/adm/auth/change-password", post(change_password)),
])]
struct AdmAuthRouter;
