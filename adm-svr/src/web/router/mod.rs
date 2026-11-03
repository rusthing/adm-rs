mod adm_app_router;
mod adm_auth_router;
mod adm_dashboard_router;
mod adm_lock_log_router;
mod adm_login_log_router;
mod adm_menu_perm_router;
mod adm_menu_router;
mod adm_op_log_router;
mod adm_op_type_router;
mod adm_option_router;
mod adm_org_router;
mod adm_org_type_router;
mod adm_org_user_router;
mod adm_perm_group_router;
mod adm_perm_router;
mod adm_person_code_type_router;
mod adm_person_router;
mod adm_realm_org_router;
mod adm_realm_router;
mod adm_realm_user_router;
mod adm_role_group_router;
mod adm_role_menu_router;
mod adm_role_perm_router;
mod adm_role_router;
mod adm_role_user_router;
mod adm_user_password_router;
mod adm_user_router;

/// # 路由自检
///
/// 每个 `#[router]` 各自装配一棵 `Router`，最终由框架按 `ROUTER_SLICE` 逐个 `.merge()`
/// 进来。合并时路径形状撞车会**直接 panic**，而这条路只有起服务才会走到 —— 放在这里
/// 让 `cargo test` 提前发现。
///
/// 写在 lib 内而不是 `tests/`：集成测试里 `ROUTER_SLICE` 是空的（lib 的目标文件没被
/// 引用，链接器把条目丢了），只有同一编译单元才拿得到真实的路由表。
#[cfg(test)]
mod tests {
    use axum::Router;

    #[test]
    fn routers_merge_without_conflict() {
        let mut router = Router::new();
        for build_router in robotech::web::ROUTER_SLICE.iter() {
            router = router.merge(build_router());
        }
        // 合并成功即说明没有冲突；这里不发请求，只验证装配阶段不 panic
        drop(router);
    }
}
