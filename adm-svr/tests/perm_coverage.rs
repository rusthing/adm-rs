//! # 权限点覆盖率硬门禁
//!
//! 校验两件事：
//! 1. `src/web/router` 里注册的每个接口（除 `/adm/auth/*` 的 6 条豁免），都能被
//!    某个 `adm_perm.urn` 按「HTTP 方法 + 路径前缀」覆盖；新增资源忘记补权限点会
//!    直接让测试失败。
//! 2. 最新种子迁移里新增的 URN 必须都能对上真实路由，避免写错路径或拼写方法。
//!
//! 测试只读仓库文件（路由源码 + SQL 迁移），不连数据库，`cargo test` 即可跑。

use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

/// 一条路由：方法 + 完整路径
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
struct Route {
    method: String,
    path: String,
}

impl Route {
    fn new(method: &str, path: &str) -> Self {
        Self {
            method: method.to_string(),
            path: path.to_string(),
        }
    }
}

/// 解析一条 URN（`METHOD:路径`）
fn split_urn(urn: &str) -> Option<(String, String)> {
    let (method, path) = urn.split_once(':')?;
    let method = method.trim().to_uppercase();
    if !matches!(method.as_str(), "GET" | "POST" | "PUT" | "DELETE") {
        return None;
    }
    let path = path.trim();
    if !path.starts_with('/') {
        return None;
    }
    Some((method, path.to_string()))
}

/// 读取 `router` 目录
fn router_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("src/web/router")
}

/// 读取 `migrations` 目录
fn migrations_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations/pgsql")
}

/// 从源码里找 `adm_crud_router!("前缀", ...)` / `adm_readonly_router!(...)`
fn macro_prefix(src: &str, macro_name: &str) -> Option<String> {
    let at = src.find(macro_name)?;
    let rest = &src[at + macro_name.len()..];
    let open = rest.find('(')?;
    let after = &rest[open + 1..];
    parse_quoted(after).map(|(path, _)| path)
}

/// 解析以 `"` 开头的字符串字面量，返回内容和消耗后的剩余部分
fn parse_quoted(text: &str) -> Option<(String, &str)> {
    let text = text.trim_start();
    let body = text.strip_prefix('"')?;
    let end = body.find('"')?;
    Some((body[..end].to_string(), &body[end + 1..]))
}

/// 解析 `.route("路径", method(handler))`，允许路径与 handler 换行
fn parse_axum_routes(src: &str, out: &mut BTreeSet<Route>) {
    let mut cursor = 0usize;
    while let Some(offset) = src[cursor..].find(".route(") {
        let start = cursor + offset + ".route(".len();
        let Some((path, rest)) = parse_quoted(&src[start..]) else {
            cursor = start;
            continue;
        };
        let rest = rest.trim_start();
        let rest = rest.strip_prefix(',').unwrap_or(rest).trim_start();
        let method: String = rest
            .chars()
            .take_while(|c| c.is_ascii_alphabetic())
            .collect();
        if matches!(method.as_str(), "get" | "post" | "put" | "delete") {
            out.insert(Route::new(&method.to_uppercase(), &path));
        }
        cursor = start;
    }
}

/// 解析 `#[router(routes [("路径", method(handler))])]`
fn parse_macro_routes(src: &str, out: &mut BTreeSet<Route>) {
    let mut cursor = 0usize;
    while let Some(offset) = src[cursor..].find("(\"") {
        let start = cursor + offset + 1;
        let Some((path, rest)) = parse_quoted(&src[start..]) else {
            cursor = start;
            continue;
        };
        let rest = rest.trim_start();
        let rest = rest.strip_prefix(',').unwrap_or(rest).trim_start();
        let method: String = rest
            .chars()
            .take_while(|c| c.is_ascii_alphabetic())
            .collect();
        if matches!(method.as_str(), "get" | "post" | "put" | "delete")
            && rest[method.len()..].trim_start().starts_with('(')
        {
            out.insert(Route::new(&method.to_uppercase(), &path));
        }
        cursor = start;
    }
}

/// 收集全部路由；认证路由单独返回（豁免集合）
fn collect_routes() -> (BTreeSet<Route>, BTreeSet<Route>) {
    let mut crud = BTreeSet::new();
    let mut auth = BTreeSet::new();

    for entry in fs::read_dir(router_dir()).expect("读取 router 目录") {
        let entry = entry.expect("读取 router 条目");
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("rs") {
            continue;
        }
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or_default();
        if name == "mod.rs" {
            continue;
        }
        let src = fs::read_to_string(&path).expect("读取路由源码");

        if let Some(prefix) = macro_prefix(&src, "adm_crud_router!") {
            for method in ["GET", "POST", "PUT", "DELETE"] {
                crud.insert(Route::new(method, &prefix));
            }
            // 框架会额外生成 `POST {prefix}/sync`；sync 按用户要求独立成权限点
            crud.insert(Route::new("POST", &format!("{prefix}/sync")));
            continue;
        }
        if let Some(prefix) = macro_prefix(&src, "adm_readonly_router!") {
            crud.insert(Route::new("GET", &prefix));
            if src.contains("post(") || src.contains("put(") || src.contains("delete(") {
                panic!("只读路由 {name} 不应出现写方法");
            }
            continue;
        }

        let target = if name == "adm_auth_router.rs" {
            &mut auth
        } else {
            &mut crud
        };
        parse_axum_routes(&src, target);
        parse_macro_routes(&src, target);
    }

    (crud, auth)
}

/// 扫描全部 SQL 迁移里的 URN 字面量
fn collect_urns() -> BTreeSet<(String, String)> {
    let mut urns = BTreeSet::new();
    for entry in fs::read_dir(migrations_dir()).expect("读取 migrations 目录") {
        let entry = entry.expect("读取 migrations 条目");
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("sql") {
            continue;
        }
        let src = fs::read_to_string(&path).expect("读取迁移 SQL");
        let bytes = src.as_bytes();
        let mut index = 0usize;
        while index < bytes.len() {
            if bytes[index] != b'\'' {
                index += 1;
                continue;
            }
            let start = index + 1;
            let Some(rel_end) = src[start..].find('\'') else {
                break;
            };
            let literal = &src[start..start + rel_end];
            if let Some((method, urn_path)) = split_urn(literal) {
                urns.insert((method, urn_path));
            }
            index = start + rel_end + 1;
        }
    }
    urns
}

/// 新种子迁移：只校验这里新增的 URN，历史 URN 允许保留
fn new_seed_urns() -> BTreeSet<(String, String)> {
    let src = fs::read_to_string(
        migrations_dir().join("20261108130000_perm_seed_coverage.sql"),
    )
    .expect("读取权限种子迁移");

    let mut urns = BTreeSet::new();
    let bytes = src.as_bytes();
    let mut index = 0usize;
    while index < bytes.len() {
        if bytes[index] != b'\'' {
            index += 1;
            continue;
        }
        let start = index + 1;
        let Some(rel_end) = src[start..].find('\'') else {
            break;
        };
        let literal = &src[start..start + rel_end];
        if let Some((method, urn_path)) = split_urn(literal) {
            urns.insert((method, urn_path));
        }
        index = start + rel_end + 1;
    }
    urns
}

/// URN 是否覆盖某条路由（同方法 + 路径相等或为其前缀）
fn covered(route: &Route, urn: &(String, String)) -> bool {
    route.method == urn.0
        && (route.path == urn.1
            || route
                .path
                .strip_prefix(&urn.1)
                .is_some_and(|rest| rest.starts_with('/')))
}

#[test]
fn every_route_has_permission_point() {
    let (routes, auth_routes) = collect_routes();
    let urns = collect_urns();

    // 认证路由豁免，且不多不少正好 6 条
    assert_eq!(
        auth_routes.len(),
        6,
        "认证路由应为 6 条豁免，实际：{auth_routes:?}"
    );
    for route in &auth_routes {
        assert!(
            route.path.starts_with("/adm/auth/"),
            "豁免只允许 /adm/auth/*，发现：{route:?}"
        );
    }

    let mut missing = Vec::new();
    for route in &routes {
        if !urns.iter().any(|urn| covered(route, urn)) {
            missing.push(format!("{}:{}", route.method, route.path));
        }
    }

    assert!(
        missing.is_empty(),
        "以下接口没有权限点（方法 + 资源根路径）：\n{}",
        missing.join("\n")
    );
}

#[test]
fn new_seed_urns_match_real_routes() {
    let (routes, _auth) = collect_routes();
    let new_urns = new_seed_urns();

    let mut unknown = Vec::new();
    for urn in &new_urns {
        let matched = routes.iter().any(|route| {
            route.method == urn.0
                && route.path == urn.1
        });
        if !matched {
            unknown.push(format!("{}:{}", urn.0, urn.1));
        }
    }

    // 允许「权限点比路由更宽」的写法：例如 POST:/adm/user 覆盖 /adm/user/sync。
    // 但只要新 URN 的路径不是任何真实路由的前缀，就一定是写错了。
    let mut wrong = Vec::new();
    for urn in unknown {
        let (method, path) = urn.split_once(':').unwrap();
        let related = routes.iter().any(|route| {
            route.method == method
                && (route.path == path
                    || route
                        .path
                        .strip_prefix(path)
                        .is_some_and(|rest| rest.starts_with('/')))
        });
        if !related {
            wrong.push(urn);
        }
    }

    assert!(
        wrong.is_empty(),
        "种子迁移里的 URN 对不上任何真实路由：\n{}",
        wrong.join("\n")
    );
}

#[test]
fn perm_type_is_not_null_and_constrained() {
    let src = fs::read_to_string(
        migrations_dir().join("20261108130000_perm_seed_coverage.sql"),
    )
    .expect("读取权限种子迁移");

    assert!(
        src.contains("alter column op_type_code set not null"),
        "op_type_code 必须升级为 NOT NULL"
    );
    assert!(
        src.contains("CK_ADM_PERM_OP_TYPE"),
        "op_type_code 必须有取值 CHECK 约束"
    );
    for code in ["query", "add", "modify", "del", "reorder", "sync", "reset_password"] {
        assert!(
            src.contains(&format!("'{code}'")),
            "CHECK 约束应包含类型 {code}"
        );
    }
}

#[test]
fn logs_are_read_only() {
    let log_prefixes = ["/adm/login-log", "/adm/op-log", "/adm/lock-log"];
    let urns = collect_urns();
    for (method, path) in &urns {
        if log_prefixes.contains(&path.as_str()) && method != "GET" {
            panic!("日志 {path} 不应存在写权限点 {method}");
        }
    }

    let (routes, _auth) = collect_routes();
    for route in &routes {
        if log_prefixes.contains(&route.path.as_str()) && route.method != "GET" {
            panic!("日志 {} 只应有 GET 路由，发现 {}", route.path, route.method);
        }
    }
}
