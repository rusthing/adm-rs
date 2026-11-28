//! # 权限点覆盖率硬门禁
//!
//! 校验目标：种子里每个 `adm_perm.urn` 与后端真实接口**严格一一对应** ——
//! 既不能漏一个接口，也不能出现一条不存在的 URN。路由表由
//! [`macro_route_templates`] 从 `src/lib.rs` 的宏定义里现场解析，再叠加
//! `src/web/router` 的手写路由；框架宏增删路由、新增资源忘记补种子、
//! URN 写错一个字符，都会让 `cargo test` 直接失败。
//!
//! 另外还校验：权限分组树形状、接口归属的分组、`op_type_code` 取值、
//! `(group_id, name)` 与 `urn` 的唯一性、日志只读、角色绑定自洽。
//! 测试只读仓库文件（路由源码 + SQL 迁移），不连数据库。

use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};

/// 一条接口：`(HTTP 方法, 完整路径)`
type Route = (String, String);

/// 一条权限点
#[derive(Debug, Clone, PartialEq, Eq)]
struct Perm {
    id: i64,
    group_id: i64,
    subject_code: String,
    op_type_code: String,
    name: String,
    urn: String,
    sort_order: i32,
}

/// 一条权限分组
#[derive(Debug, Clone, PartialEq, Eq)]
struct PermGroup {
    id: i64,
    tree_code: String,
    name: String,
}

fn svr_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).to_path_buf()
}

fn migrations_dir() -> PathBuf {
    svr_dir().join("migrations/pgsql")
}

fn read_migration(name: &str) -> String {
    fs::read_to_string(migrations_dir().join(name))
        .unwrap_or_else(|error| panic!("读取迁移 {name}: {error}"))
}

fn seed_sql() -> String {
    // 种子分散在基线与后续增量迁移里：按文件名顺序拼接全部 pgsql 迁移，
    // 新增资源的权限点不用再回改基线文件（基线已执行过，改它会破坏 checksum）。
    let mut files: Vec<PathBuf> = fs::read_dir(migrations_dir())
        .expect("读取 migrations/pgsql 目录")
        .filter_map(|entry| {
            let path = entry.ok()?.path();
            (path.extension().and_then(|ext| ext.to_str()) == Some("sql")).then_some(path)
        })
        .collect();
    files.sort();
    files
        .into_iter()
        .map(|path| {
            fs::read_to_string(&path)
                .unwrap_or_else(|error| panic!("读取迁移 {}: {error}", path.display()))
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// 建表基线（`create-table.sql` 是 PowerDesigner 导出脚本的副本）与
/// PD 表达不了的补充对象（`create-index.sql`，含 CHECK 约束）合起来才是完整 DDL。
fn table_sql() -> String {
    let ddl = read_migration("20261109000000_create-table.sql");
    let idx = read_migration("20261109000001_create-index.sql");
    format!("{ddl}\n{idx}")
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

/// 解析以 `"` 开头的字符串字面量，返回内容和消耗后的剩余部分
fn parse_quoted(text: &str) -> Option<(String, &str)> {
    let text = text.trim_start();
    let body = text.strip_prefix('"')?;
    let end = body.find('"')?;
    Some((body[..end].to_string(), &body[end + 1..]))
}

/// 从源码里找 `adm_crud_router!("前缀", ...)` / `adm_readonly_router!(...)`
fn macro_prefix(src: &str, macro_name: &str) -> Option<String> {
    let at = src.find(macro_name)?;
    let rest = &src[at + macro_name.len()..];
    let open = rest.find('(')?;
    parse_quoted(&rest[open + 1..]).map(|(path, _)| path)
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
            out.insert((method.to_uppercase(), path));
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
            out.insert((method.to_uppercase(), path));
        }
        cursor = start;
    }
}

/// 从 `src/lib.rs` 的 `macro_rules!` 里解析路由模板。
///
/// 返回 `(方法, 相对前缀的子路径)`，例如 `("GET", "/list")`；
/// `.route($prefix, post(add))` 解析成 `("POST", "")`。
/// 这样框架宏增删路由时，本测试自动跟着变，不需要手工同步清单。
fn macro_route_templates(macro_name: &str) -> Vec<(String, String)> {
    let src = fs::read_to_string(svr_dir().join("src/lib.rs")).expect("读取 adm-svr/src/lib.rs");
    let marker = format!("macro_rules! {macro_name}");
    let at = src
        .find(&marker)
        .unwrap_or_else(|| panic!("lib.rs 找不到 {marker}"));
    let brace = at + src[at..].find('{').expect("宏体起始大括号");
    let mut depth = 0usize;
    let mut end = brace;
    for (offset, ch) in src[brace..].char_indices() {
        match ch {
            '{' => depth += 1,
            '}' => {
                depth -= 1;
                if depth == 0 {
                    end = brace + offset;
                    break;
                }
            }
            _ => {}
        }
    }
    let body = &src[brace + 1..end];

    let mut out = Vec::new();
    for line in body.lines() {
        let line = line.trim();
        let Some(rest) = line.strip_prefix(".route(") else {
            continue;
        };
        let (sub, after) = if let Some(tail) = rest.strip_prefix("concat!($prefix,") {
            let tail = tail.trim_start();
            let Some(quoted) = tail.strip_prefix('"') else {
                continue;
            };
            let Some(close) = quoted.find('"') else {
                continue;
            };
            let sub = quoted[..close].to_string();
            let after = &quoted[close + 1..];
            let Some(comma) = after.find(',') else {
                continue;
            };
            (sub, after[comma + 1..].trim_start())
        } else {
            let Some(tail) = rest.strip_prefix("$prefix,") else {
                continue;
            };
            (String::new(), tail.trim_start())
        };
        let method: String = after
            .chars()
            .take_while(|c| c.is_ascii_alphabetic())
            .collect();
        assert!(
            matches!(method.as_str(), "get" | "post" | "put" | "delete"),
            "{macro_name} 里出现无法识别的路由方法行：{line}"
        );
        out.push((method.to_uppercase(), sub));
    }
    out
}

/// 收集全部真实接口：返回 `(需鉴权接口, 认证豁免接口)`
fn collect_routes() -> (BTreeSet<Route>, BTreeSet<Route>) {
    let crud_templates = macro_route_templates("adm_crud_router");
    let readonly_templates = macro_route_templates("adm_readonly_router");
    assert_eq!(
        crud_templates.len(),
        25,
        "adm_crud_router 宏的路由数量变了，种子与测试都要跟着核"
    );
    assert_eq!(
        readonly_templates.len(),
        16,
        "adm_readonly_router 宏的路由数量变了，种子与测试都要跟着核"
    );

    let mut all = BTreeSet::new();
    for entry in fs::read_dir(svr_dir().join("src/web/router")).expect("读取 router 目录") {
        let entry = entry.expect("读取 router 条目");
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("rs") {
            continue;
        }
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or_default();
        if name == "mod.rs" {
            continue;
        }
        let src = fs::read_to_string(&path).expect("读取路由源码");

        if let Some(prefix) = macro_prefix(&src, "adm_crud_router!") {
            for (method, sub) in &crud_templates {
                all.insert((method.clone(), format!("{prefix}{sub}")));
            }
            continue;
        }
        if let Some(prefix) = macro_prefix(&src, "adm_readonly_router!") {
            for (method, sub) in &readonly_templates {
                all.insert((method.clone(), format!("{prefix}{sub}")));
            }
            continue;
        }
        parse_axum_routes(&src, &mut all);
        parse_macro_routes(&src, &mut all);
    }

    let auth: BTreeSet<Route> = all
        .iter()
        .filter(|(_, path)| path.starts_with("/adm/auth/"))
        .cloned()
        .collect();
    let guarded = all.difference(&auth).cloned().collect();
    (guarded, auth)
}

/// 按顶层逗号切分 `VALUES (...)` 内容，支持单引号字符串与 `''` 转义
fn split_values(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut current = String::new();
    let mut in_quote = false;
    let mut chars = text.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '\'' {
            if in_quote && chars.peek() == Some(&'\'') {
                current.push('\'');
                chars.next();
                continue;
            }
            in_quote = !in_quote;
            current.push(ch);
        } else if ch == ',' && !in_quote {
            out.push(current.trim().to_string());
            current.clear();
        } else {
            current.push(ch);
        }
    }
    out.push(current.trim().to_string());
    out
}

/// 去掉字段值的单引号
fn unquote(value: &str) -> String {
    value
        .strip_prefix('\'')
        .and_then(|v| v.strip_suffix('\''))
        .unwrap_or(value)
        .to_string()
}

/// 取出某张表的 INSERT 行，返回每行 `VALUES (...)` 的字段列表
fn seed_rows(table: &str) -> Vec<Vec<String>> {
    let head = format!("INSERT INTO public.{table} (");
    seed_sql()
        .lines()
        .filter(|line| line.starts_with(&head))
        .map(|line| {
            let body = line
                .split_once("VALUES (")
                .unwrap_or_else(|| panic!("{table} 种子行缺少 VALUES: {line}"))
                .1;
            let body = body.trim_end().trim_end_matches(';').trim_end_matches(')');
            split_values(body)
        })
        .collect()
}

fn perm_groups() -> Vec<PermGroup> {
    let mut groups: Vec<PermGroup> = seed_rows("adm_perm_group")
        .iter()
        .map(|v| PermGroup {
            id: v[0].parse().expect("分组 id"),
            tree_code: unquote(&v[1]),
            name: unquote(&v[2]),
        })
        .collect();
    apply_perm_group_updates(&mut groups);
    groups
}

/// 把迁移里的 `UPDATE public.adm_perm_group SET tree_code = ...` 应用到种子快照。
///
/// 分组迁移靠改 tree_code 表达（父子关系是编码前缀），只解析 INSERT 会把迁移
/// 之后的形状当成迁移之前的，白名单断言就失去意义。这里只支持实际用到的两种
/// 写法：按 id 改单行、以及 `replace(tree_code, '旧前缀', '新前缀')` 批量改子树。
fn apply_perm_group_updates(groups: &mut [PermGroup]) {
    for line in seed_sql().lines() {
        let line = line.trim();
        let Some(rest) = line.strip_prefix("UPDATE public.adm_perm_group SET tree_code = ") else {
            continue;
        };
        if let Some(tail) = rest.strip_prefix("replace(tree_code, '") {
            let Some((old, tail)) = tail.split_once("', '") else {
                continue;
            };
            let Some((new, _)) = tail.split_once("')") else {
                continue;
            };
            for group in groups.iter_mut().filter(|g| g.tree_code.starts_with(old)) {
                group.tree_code = format!("{new}{}", &group.tree_code[old.len()..]);
            }
        } else if let Some(tail) = rest.strip_prefix('\'') {
            let Some((new, tail)) = tail.split_once('\'') else {
                continue;
            };
            let Some((_, id_text)) = tail.split_once("WHERE id = ") else {
                continue;
            };
            let id: i64 = id_text
                .trim_end_matches(';')
                .trim()
                .parse()
                .expect("UPDATE 的 id");
            if let Some(group) = groups.iter_mut().find(|g| g.id == id) {
                group.tree_code = new.to_string();
            }
        }
    }
}

fn perms() -> Vec<Perm> {
    seed_rows("adm_perm")
        .iter()
        .map(|v| Perm {
            id: v[0].parse().expect("权限 id"),
            group_id: v[1].parse().expect("分组 id"),
            subject_code: unquote(&v[2]),
            op_type_code: unquote(&v[3]),
            name: unquote(&v[4]),
            urn: unquote(&v[5]),
            sort_order: v[6].parse().expect("排序值"),
        })
        .collect()
}

/// 资源根路径 -> `(subject_code, 主体分组名)`。
///
/// 权限点必须挂在「主体 → 操作类型」的四级分组下：三级是主体（与 `subject_code`
/// 一一对应），四级是操作类型。这里独立给出「路径 → 主体」的映射，避免直接用
/// 种子里的 `group_id` 反推导致测试变成同义反复。
fn expected_subject(path: &str) -> (&'static str, &'static str) {
    let mut subjects: Vec<(&str, &'static str, &'static str)> = vec![
        ("/adm/person-code-type", "person_code_type", "人员编码类型"),
        ("/adm/person-tag-type", "person_tag_type", "人员标签类型"),
        ("/adm/person-type", "person_type", "人员类型"),
        ("/adm/menu-perm", "menu_perm", "菜单绑定"),
        ("/adm/perm-group", "perm_group", "权限分组"),
        ("/adm/role-group", "role_group", "角色分组"),
        ("/adm/role-menu", "role_menu", "角色菜单"),
        ("/adm/role-perm", "role_perm", "角色权限"),
        ("/adm/role-user", "role_user", "角色用户"),
        ("/adm/org-type", "org_type", "组织类型"),
        ("/adm/org-user", "org_user", "组织成员"),
        ("/adm/realm-user", "realm_user", "领域成员"),
        ("/adm/realm-org", "realm_org", "领域组织"),
        ("/adm/op-type", "op_type", "操作类型"),
        ("/adm/widget-data", "widget_data", "widget 数据"),
        ("/adm/dashboard", "dashboard", "首页配置"),
        ("/adm/login-log", "login_log", "登录日志"),
        ("/adm/lock-log", "lock_log", "锁定日志"),
        ("/adm/op-log", "op_log", "操作日志"),
        ("/adm/person", "person", "人员"),
        ("/adm/realm", "realm", "领域"),
        ("/adm/option", "option", "选项"),
        ("/adm/role", "role", "角色"),
        ("/adm/menu", "menu", "菜单"),
        ("/adm/perm", "perm", "权限"),
        ("/adm/user", "user", "用户"),
        ("/adm/org", "org", "组织"),
        ("/adm/app", "app", "应用"),
    ];
    // 长前缀优先，避免 /adm/org-user 被 /adm/org 抢走
    subjects.sort_by_key(|(prefix, _, _)| std::cmp::Reverse(prefix.len()));
    for (prefix, subject, name) in subjects {
        if path == prefix || path.starts_with(&format!("{prefix}/")) {
            return (subject, name);
        }
    }
    panic!("接口 {path} 没有归属主体，请同步种子与本映射表");
}

/// # 接口与权限点严格双向相等
///
/// 不再允许「资源根 URN 前缀兜底」：每个权限点的 URN 必须精确等于一条真实
/// 接口，每条需鉴权接口必须有且仅有一个权限点。
#[test]
fn every_route_has_exact_permission_point() {
    let (routes, auth_routes) = collect_routes();
    let seed_perms = perms();

    assert_eq!(
        auth_routes.len(),
        6,
        "认证豁免应正好 6 条，实际：{auth_routes:?}"
    );
    for (_, path) in &auth_routes {
        assert!(
            path.starts_with("/adm/auth/"),
            "豁免只允许 /adm/auth/*，发现：{path}"
        );
    }

    let urn_routes: BTreeSet<Route> = seed_perms
        .iter()
        .map(|perm| {
            split_urn(&perm.urn)
                .unwrap_or_else(|| panic!("权限点 {} 的 URN 格式非法：{}", perm.id, perm.urn))
        })
        .collect();
    assert_eq!(
        urn_routes.len(),
        seed_perms.len(),
        "存在重复的 URN 或非法 URN"
    );

    let missing: Vec<String> = routes
        .difference(&urn_routes)
        .map(|(m, p)| format!("{m}:{p}"))
        .collect();
    assert!(
        missing.is_empty(),
        "以下接口缺少精确的种子权限点：\n{}",
        missing.join("\n")
    );

    let phantom: Vec<String> = urn_routes
        .difference(&routes)
        .map(|(m, p)| format!("{m}:{p}"))
        .collect();
    assert!(
        phantom.is_empty(),
        "以下种子权限点不是真实接口（含认证豁免）：\n{}",
        phantom.join("\n")
    );
}

/// # 权限分组树形状
///
/// 四层结构：根（平台管理）→ 菜单一级 → 主体 → 操作类型。
/// 只校验结构与命名约定，不固化每个操作类型分组的 id，避免新增接口时重复维护快照。
#[test]
fn permission_group_tree_is_expected() {
    let groups = perm_groups();

    let ids: BTreeSet<i64> = groups.iter().map(|g| g.id).collect();
    assert_eq!(ids.len(), groups.len(), "分组 id 必须唯一");
    let codes: BTreeSet<&str> = groups.iter().map(|g| g.tree_code.as_str()).collect();
    assert_eq!(codes.len(), groups.len(), "tree_code 必须唯一");

    for group in &groups {
        assert_eq!(
            group.tree_code.len() % 3,
            0,
            "tree_code 必须按 3 位分层：{}",
            group.tree_code
        );
        let level = group.tree_code.len() / 3;
        assert!((1..=4).contains(&level), "只允许四层：{}", group.tree_code);
        if level > 1 {
            let parent = &group.tree_code[..group.tree_code.len() - 3];
            assert!(
                codes.contains(parent),
                "{} 的父节点 {parent} 不存在",
                group.tree_code
            );
        }
    }

    let roots: Vec<&PermGroup> = groups.iter().filter(|g| g.tree_code.len() == 3).collect();
    assert_eq!(roots.len(), 1, "根分组必须唯一");
    assert_eq!(roots[0].tree_code, "001");
    assert_eq!(roots[0].name, "平台管理");

    // 二级是菜单一级：五个名字一个都不能错（基础字典与菜单 006 同步新增）
    let second: BTreeSet<&str> = groups
        .iter()
        .filter(|g| g.tree_code.len() == 6)
        .map(|g| g.name.as_str())
        .collect();
    assert_eq!(
        second,
        BTreeSet::from([
            "组织与人员",
            "角色与授权",
            "系统配置",
            "审计日志",
            "基础字典",
        ]),
        "五个二级分组名称不符"
    );

    // 三级是主体，四级是操作类型：主体下必须有操作分组，操作分组必须挂在主体下
    for subject in groups.iter().filter(|g| g.tree_code.len() == 9) {
        assert!(
            groups.iter().any(|g| {
                g.tree_code.len() == 12 && g.tree_code.starts_with(&subject.tree_code)
            }),
            "三级分组 {}（{}）没有四级子分组",
            subject.tree_code,
            subject.name
        );
    }
    for op in groups.iter().filter(|g| g.tree_code.len() == 12) {
        let parent = &op.tree_code[..9];
        assert!(
            groups.iter().any(|g| g.tree_code == parent),
            "四级分组 {} 的主体 {parent} 不存在",
            op.tree_code
        );
    }
}

/// # 权限点字段契约与分组归属
#[test]
fn permission_rows_follow_contract() {
    let groups = perm_groups();
    let seed_perms = perms();
    let allowed_ops = BTreeSet::from([
        "query",
        "add",
        "modify",
        "del",
        "reorder",
        "sync",
        "reset_password",
        "unlock",
    ]);

    let mut names = BTreeSet::new();
    let mut perm_ids = BTreeSet::new();
    for perm in &seed_perms {
        let group = groups
            .iter()
            .find(|g| g.id == perm.group_id)
            .unwrap_or_else(|| panic!("权限点 {} 挂在不存在的分组 {} 上", perm.id, perm.group_id));
        assert_eq!(
            group.tree_code.len(),
            12,
            "权限点 {} 必须挂在四级「操作类型」分组，实际 {}",
            perm.id,
            group.tree_code
        );
        assert!(
            allowed_ops.contains(perm.op_type_code.as_str()),
            "权限点 {} 的 op_type_code 不在 CHECK 约束里：{}",
            perm.id,
            perm.op_type_code
        );
        assert!(perm_ids.insert(perm.id), "权限点 id 重复：{}", perm.id);
        assert!(
            names.insert((perm.group_id, perm.name.clone())),
            "同一分组内权限点名称重复：{} / {}",
            perm.group_id,
            perm.name
        );
        assert!(perm.name.chars().count() <= 50, "name 超长：{}", perm.name);
        assert!(perm.urn.chars().count() <= 100, "urn 超长：{}", perm.urn);
        assert!(
            (0..=9999).contains(&perm.sort_order),
            "sort_order 越界：{}",
            perm.sort_order
        );

        let (_, path) = split_urn(&perm.urn).expect("URN 格式");
        let (subject, subject_name) = expected_subject(&path);
        assert_eq!(
            perm.subject_code, subject,
            "接口 {path} 的 subject_code 应为 {subject}，实际 {}",
            perm.subject_code
        );
        let subject_group_code = &group.tree_code[..9];
        let subject_group = groups
            .iter()
            .find(|g| g.tree_code == subject_group_code)
            .unwrap_or_else(|| panic!("主体分组 {subject_group_code} 不存在"));
        assert_eq!(
            subject_group.name, subject_name,
            "接口 {path} 挂错主体：应在「{subject_name}」，实际「{}」",
            subject_group.name
        );
    }

    // 每个操作类型分组都必须至少挂一个权限点；权限点只能挂四级分组
    let perm_group_ids: BTreeSet<i64> = seed_perms.iter().map(|p| p.group_id).collect();
    for group in groups.iter().filter(|g| g.tree_code.len() == 12) {
        assert!(
            perm_group_ids.contains(&group.id),
            "四级分组 {}（{}）没有挂任何权限点",
            group.tree_code,
            group.name
        );
    }
}

/// # 日志只读
#[test]
fn logs_are_read_only() {
    let log_prefixes = ["/adm/login-log", "/adm/op-log", "/adm/lock-log"];
    let (routes, _) = collect_routes();
    for (method, path) in &routes {
        if log_prefixes.iter().any(|prefix| path.starts_with(prefix)) {
            assert_eq!(method, "GET", "日志接口只允许 GET，发现 {method}:{path}");
        }
    }
    for perm in perms() {
        let (method, path) = split_urn(&perm.urn).expect("URN 格式");
        if log_prefixes.contains(&path.as_str())
            || log_prefixes.iter().any(|prefix| path.starts_with(prefix))
        {
            assert_eq!(method, "GET", "日志不应出现写权限点：{}", perm.urn);
        }
    }
}

/// # 角色绑定自洽
#[test]
fn role_perm_seed_is_consistent() {
    let perm_ids: BTreeSet<i64> = perms().iter().map(|p| p.id).collect();
    let rows = seed_rows("adm_role_perm");
    let mut by_role: BTreeMap<i64, BTreeSet<i64>> = BTreeMap::new();
    let mut pairs = BTreeSet::new();
    for row in &rows {
        let id: i64 = row[0].parse().expect("role_perm id");
        let role_id: i64 = row[1].parse().expect("role_id");
        let perm_id: i64 = row[2].parse().expect("perm_id");
        assert!(
            perm_ids.contains(&perm_id),
            "role_perm {id} 引用了不存在的权限点 {perm_id}"
        );
        assert!(
            pairs.insert((role_id, perm_id)),
            "角色 {role_id} 重复绑定权限点 {perm_id}"
        );
        by_role.entry(role_id).or_default().insert(perm_id);
    }

    // 平台管理员与系统组拥有全部权限点
    for role_id in [1, 5] {
        assert_eq!(
            by_role.get(&role_id),
            Some(&perm_ids),
            "角色 {role_id} 应绑定全部权限点"
        );
    }
    // 管理员角色保持「全量 ≥ 系统管理员 ≥ 组织管理员 ≥ 审计员」的语义
    let sizes: Vec<(i64, usize)> = by_role.iter().map(|(id, set)| (*id, set.len())).collect();
    let size_of = |id: i64| {
        sizes
            .iter()
            .find(|(r, _)| *r == id)
            .map(|(_, n)| *n)
            .unwrap()
    };
    assert!(size_of(1) > size_of(2), "系统管理员权限应少于平台管理员");
    assert!(size_of(2) > size_of(3), "组织管理员权限应少于系统管理员");
    assert!(size_of(3) > size_of(4), "审计员权限应少于组织管理员");
}

/// # widget 门禁声明的 URN 必须真实存在
///
/// `adm_widget_type.default_perm_urn` 与 `adm_dashboard_widget.perm_urn`
/// 是前端展示层的门禁前缀；写错一个字符对应组件就永远不显示。
#[test]
fn widget_perm_urns_exist_in_seed() {
    let known: BTreeSet<String> = perms().iter().map(|perm| perm.urn.clone()).collect();
    let mut refs = Vec::new();
    for line in seed_sql().lines() {
        if !line.starts_with("INSERT INTO public.adm_widget_type ")
            && !line.starts_with("INSERT INTO public.adm_dashboard_widget ")
        {
            continue;
        }
        let body = line
            .split_once("VALUES (")
            .unwrap_or_else(|| panic!("widget 种子行缺少 VALUES: {line}"))
            .1;
        let body = body.trim_end().trim_end_matches(';').trim_end_matches(')');
        for value in split_values(body) {
            let value = unquote(&value);
            if let Some((method, path)) = split_urn(&value) {
                refs.push(format!("{method}:{path}"));
            }
        }
    }
    assert!(!refs.is_empty(), "widget 表里应有权限 URN 门禁声明");
    let missing: Vec<&String> = refs.iter().filter(|urn| !known.contains(*urn)).collect();
    assert!(
        missing.is_empty(),
        "widget 门禁引用了不存在的权限点：\n{}",
        missing
            .iter()
            .map(|urn| urn.as_str())
            .collect::<Vec<_>>()
            .join("\n")
    );
}

/// # 建表侧的操作类型约束
#[test]
fn perm_type_is_not_null_and_constrained() {
    let src = table_sql();
    assert!(
        src.to_ascii_lowercase()
            .contains("constraint ck_adm_perm_op_type check"),
        "op_type_code 必须有取值 CHECK 约束"
    );
    for code in [
        "query",
        "add",
        "modify",
        "del",
        "reorder",
        "sync",
        "reset_password",
        "unlock",
    ] {
        assert!(
            src.contains(&format!("'{code}'")),
            "CHECK 约束应包含类型 {code}"
        );
    }
}
