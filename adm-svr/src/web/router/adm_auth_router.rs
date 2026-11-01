use robotech::macros::router;

/// # 认证路由
///
/// 只有两个接口，不生成 CRUD：路径写死在这里，与
/// [`adm_auth_ctrl`](crate::web::ctrl::adm_auth_ctrl) 的两个处理器一一对应。
///
/// 两个都用 POST：登出虽然不改服务端「资源」（令牌本来就是无状态的），
/// 但会让令牌失效，语义上不是幂等查询。
#[router(routes [
    ("/adm/auth/login", post(login)),
    ("/adm/auth/logout", post(logout)),
])]
struct AdmAuthRouter;
