//! 排序紧凑的数据库级单测
//!
//! 直接调用 svc 层的排序函数，在事务里建临时表，断言序号连续，跑完回滚。
//! 需要本机 PostgreSQL（默认 `postgresql://admrs:admrs@localhost:5432/admrs`），
//! 可用 `ADM_TEST_DB_URL` 覆盖；连不上时跳过并打印原因，不影响其它测试。
//!
//! 覆盖场景：删除中间项后序号连续、批量删除整组重算、改分组后新组末尾 / 旧组前移、
//! 跨组反方向并发（验证按 key 排序加锁不会死锁）、树形删中间项与改父节点。

use adm_svr::svc::{menu_delete_guard, tree_delete_preview_with_db, AdmMenuSvc};
use robotech::api::U64;
use robotech::dao::sort::{
    compact_flat_after_delete, compact_flat_gaps, compact_tree_after_delete, compact_tree_gaps,
    flat_move_group, tree_move_node, FlatSort, TreeMoveArgs, TreeSort,
};
use sea_orm::{
    ConnectionTrait, Database, DatabaseBackend, DatabaseConnection, DbErr, QueryResult, Statement,
    TransactionTrait,
};

/// 连接测试库；连不上返回 `None`
async fn connect() -> Option<DatabaseConnection> {
    let url = std::env::var("ADM_TEST_DB_URL")
        .or_else(|_| std::env::var("DATABASE_URL"))
        .unwrap_or_else(|_| "postgresql://admrs:admrs@localhost:5432/admrs".to_string());
    match Database::connect(&url).await {
        Ok(conn) => Some(conn),
        Err(err) => {
            eprintln!("跳过排序单测：无法连接 {url}: {err}");
            None
        }
    }
}

async fn exec<C: ConnectionTrait>(db: &C, sql: &str) -> Result<u64, DbErr> {
    db.execute_raw(Statement::from_string(
        DatabaseBackend::Postgres,
        sql.to_string(),
    ))
    .await
    .map(|result| result.rows_affected())
}

async fn query<C: ConnectionTrait>(db: &C, sql: &str) -> Result<Vec<QueryResult>, DbErr> {
    db.query_all_raw(Statement::from_string(
        DatabaseBackend::Postgres,
        sql.to_string(),
    ))
    .await
}

/// 平铺实体：建临时表
async fn create_flat_table<C: ConnectionTrait>(db: &C, table: &str) {
    exec(
        db,
        &format!(
            "CREATE TEMP TABLE {table} (
                id bigserial PRIMARY KEY,
                group_id bigint NOT NULL,
                sort_order int NOT NULL,
                updater_id bigint NOT NULL DEFAULT 0,
                update_ms bigint NOT NULL DEFAULT 0
             ) ON COMMIT DROP"
        ),
    )
    .await
    .unwrap();
}

async fn flat_sorts<C: ConnectionTrait>(db: &C, table: &str, group: i64) -> Vec<i32> {
    query(
        db,
        &format!(
            "SELECT sort_order FROM {table} WHERE group_id = {group} ORDER BY sort_order, id"
        ),
    )
    .await
    .unwrap()
    .iter()
    .map(|row| row.try_get::<i32>("", "sort_order").unwrap())
    .collect()
}

async fn tree_codes<C: ConnectionTrait>(db: &C, table: &str, scope: i64) -> Vec<String> {
    query(
        db,
        &format!(
            "SELECT tree_code FROM {table} WHERE scope_id = {scope} ORDER BY tree_code, id"
        ),
    )
    .await
    .unwrap()
    .iter()
    .map(|row| row.try_get::<String>("", "tree_code").unwrap())
    .collect()
}

/// 树形实体：建临时表（带 `(scope_id, tree_code)` 唯一约束）
async fn create_tree_table<C: ConnectionTrait>(db: &C, table: &str) {
    exec(
        db,
        &format!(
            "CREATE TEMP TABLE {table} (
                id bigserial PRIMARY KEY,
                scope_id bigint NOT NULL,
                tree_code text NOT NULL,
                updater_id bigint NOT NULL DEFAULT 0,
                update_ms bigint NOT NULL DEFAULT 0,
                CONSTRAINT {table}_code_unique UNIQUE (scope_id, tree_code)
             ) ON COMMIT DROP"
        ),
    )
    .await
    .unwrap();
}

#[tokio::test]
async fn delete_middle_row_compacts_following_rows() {
    let Some(db) = connect().await else {
        return;
    };
    let tx = db.begin().await.unwrap();
    let table = "t_probe_flat_delete";
    create_flat_table(&tx, table).await;
    exec(
        &tx,
        &format!(
            "INSERT INTO {table} (group_id, sort_order) VALUES
             (7,1),(7,2),(7,3),(7,4),(7,5)"
        ),
    )
    .await
    .unwrap();
    exec(
        &tx,
        &format!("DELETE FROM {table} WHERE group_id = 7 AND sort_order = 3"),
    )
    .await
    .unwrap();

    let affected = compact_flat_after_delete(
        &tx,
        &FlatSort::new(table).with_group("group_id"),
        Some(7),
        3,
        None,
    )
    .await
    .unwrap();

    assert_eq!(affected, 2, "只应前移被删项后面的两条");
    assert_eq!(flat_sorts(&tx, table, 7).await, vec![1, 2, 3, 4]);
    tx.rollback().await.unwrap();
}

#[tokio::test]
async fn batch_delete_renumbers_group_once() {
    let Some(db) = connect().await else {
        return;
    };
    let tx = db.begin().await.unwrap();
    let table = "t_probe_flat_batch";
    create_flat_table(&tx, table).await;
    exec(
        &tx,
        &format!(
            "INSERT INTO {table} (group_id, sort_order) VALUES
             (9,1),(9,2),(9,3),(9,4),(9,5)"
        ),
    )
    .await
    .unwrap();
    exec(
        &tx,
        &format!("DELETE FROM {table} WHERE group_id = 9 AND sort_order IN (2, 5)"),
    )
    .await
    .unwrap();

    compact_flat_gaps(&tx, &FlatSort::new(table).with_group("group_id"))
        .await
        .unwrap();

    assert_eq!(flat_sorts(&tx, table, 9).await, vec![1, 2, 3]);
    tx.rollback().await.unwrap();
}

#[tokio::test]
async fn move_to_new_group_appends_and_shifts_old_group() {
    let Some(db) = connect().await else {
        return;
    };
    let tx = db.begin().await.unwrap();
    let table = "t_probe_flat_move";
    create_flat_table(&tx, table).await;
    exec(
        &tx,
        &format!(
            "INSERT INTO {table} (group_id, sort_order) VALUES
             (7,1),(7,2),(7,3),(8,1),(8,2)"
        ),
    )
    .await
    .unwrap();
    let moved_id: i64 = query(
        &tx,
        &format!("SELECT id FROM {table} WHERE group_id = 7 AND sort_order = 2"),
    )
    .await
    .unwrap()
    .first()
    .unwrap()
    .try_get("", "id")
    .unwrap();

    let next = flat_move_group(
        &tx,
        &FlatSort::new(table).with_group("group_id"),
        moved_id as u64,
        Some(8),
        None,
    )
    .await
    .unwrap();

    assert_eq!(next, Some(3), "新分组应追加到末尾");
    exec(
        &tx,
        &format!("UPDATE {table} SET group_id = 8, sort_order = 3 WHERE id = {moved_id}"),
    )
    .await
    .unwrap();
    assert_eq!(flat_sorts(&tx, table, 7).await, vec![1, 2], "旧分组后续前移");
    assert_eq!(flat_sorts(&tx, table, 8).await, vec![1, 2, 3]);

    tx.rollback().await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn concurrent_moves_in_opposite_directions_stay_serialized() {
    let Some(db) = connect().await else {
        return;
    };
    let table = "t_probe_flat_concurrent";
    exec(&db, &format!("DROP TABLE IF EXISTS {table}"))
        .await
        .unwrap();
    exec(
        &db,
        &format!(
            "CREATE TABLE {table} (
                id bigserial PRIMARY KEY,
                group_id bigint NOT NULL,
                sort_order int NOT NULL,
                updater_id bigint NOT NULL DEFAULT 0,
                update_ms bigint NOT NULL DEFAULT 0
             )"
        ),
    )
    .await
    .unwrap();
    exec(
        &db,
        &format!(
            "INSERT INTO {table} (group_id, sort_order) VALUES
             (1,1),(1,2),(1,3),(2,1),(2,2)"
        ),
    )
    .await
    .unwrap();

    let moved_out: i64 = query(
        &db,
        &format!("SELECT id FROM {table} WHERE group_id = 1 AND sort_order = 2"),
    )
    .await
    .unwrap()[0]
        .try_get("", "id")
        .unwrap();
    let moved_in: i64 = query(
        &db,
        &format!("SELECT id FROM {table} WHERE group_id = 2 AND sort_order = 1"),
    )
    .await
    .unwrap()[0]
        .try_get("", "id")
        .unwrap();

    let db_left = db.clone();
    let db_right = db.clone();
    let left = async move {
        let tx = db_left.begin().await.unwrap();
        let next = flat_move_group(
            &tx,
            &FlatSort::new(table).with_group("group_id"),
            moved_out as u64,
            Some(2),
            None,
        )
        .await
        .unwrap()
        .unwrap();
        exec(
            &tx,
            &format!("UPDATE {table} SET group_id = 2, sort_order = {next} WHERE id = {moved_out}"),
        )
        .await
        .unwrap();
        tx.commit().await.unwrap();
    };
    let right = async move {
        let tx = db_right.begin().await.unwrap();
        let next = flat_move_group(
            &tx,
            &FlatSort::new(table).with_group("group_id"),
            moved_in as u64,
            Some(1),
            None,
        )
        .await
        .unwrap()
        .unwrap();
        exec(
            &tx,
            &format!("UPDATE {table} SET group_id = 1, sort_order = {next} WHERE id = {moved_in}"),
        )
        .await
        .unwrap();
        tx.commit().await.unwrap();
    };
    // 两个事务按不同方向移动：加锁顺序若不一致会在这里死锁
    tokio::join!(left, right);

    // 每组各移出 / 移入一条，最终的组内序号仍然连续
    assert_eq!(flat_sorts(&db, table, 1).await, vec![1, 2, 3]);
    assert_eq!(flat_sorts(&db, table, 2).await, vec![1, 2]);
    exec(&db, &format!("DROP TABLE {table}")).await.unwrap();
}

#[tokio::test]
async fn tree_delete_middle_shifts_following_siblings() {
    let Some(db) = connect().await else {
        return;
    };
    let tx = db.begin().await.unwrap();
    let table = "t_probe_tree_delete";
    create_tree_table(&tx, table).await;
    exec(
        &tx,
        &format!(
            "INSERT INTO {table} (scope_id, tree_code) VALUES
             (1,'001'),(1,'002'),(1,'003'),(1,'004'),(1,'005')"
        ),
    )
    .await
    .unwrap();
    exec(
        &tx,
        &format!("DELETE FROM {table} WHERE scope_id = 1 AND tree_code = '003'"),
    )
    .await
    .unwrap();

    compact_tree_after_delete(
        &tx,
        &TreeSort::new(table).with_scope("scope_id"),
        Some(1),
        "003",
        None,
    )
    .await
    .unwrap();

    assert_eq!(
        tree_codes(&tx, table, 1).await,
        vec!["001", "002", "003", "004"]
    );
    tx.rollback().await.unwrap();
}

#[tokio::test]
async fn tree_batch_delete_renumbers_sibling_group() {
    let Some(db) = connect().await else {
        return;
    };
    let tx = db.begin().await.unwrap();
    let table = "t_probe_tree_batch";
    create_tree_table(&tx, table).await;
    exec(
        &tx,
        &format!(
            "INSERT INTO {table} (scope_id, tree_code) VALUES
             (1,'001'),(1,'002'),(1,'003'),(1,'004'),(1,'005')"
        ),
    )
    .await
    .unwrap();
    exec(
        &tx,
        &format!("DELETE FROM {table} WHERE scope_id = 1 AND tree_code IN ('002', '004')"),
    )
    .await
    .unwrap();

    compact_tree_gaps(&tx, &TreeSort::new(table).with_scope("scope_id"))
        .await
        .unwrap();

    assert_eq!(tree_codes(&tx, table, 1).await, vec!["001", "002", "003"]);
    tx.rollback().await.unwrap();
}

#[tokio::test]
async fn tree_move_parent_appends_and_shifts_old_parent() {
    let Some(db) = connect().await else {
        return;
    };
    let tx = db.begin().await.unwrap();
    let table = "t_probe_tree_move";
    create_tree_table(&tx, table).await;
    exec(
        &tx,
        &format!(
            "INSERT INTO {table} (scope_id, tree_code) VALUES
             (1,'001'),(1,'002'),
             (1,'001001'),(1,'001002'),(1,'001003'),
             (1,'001002001'),
             (1,'002001'),(1,'002002')"
        ),
    )
    .await
    .unwrap();
    let moved_id: i64 = query(
        &tx,
        &format!("SELECT id FROM {table} WHERE scope_id = 1 AND tree_code = '001002'"),
    )
    .await
    .unwrap()[0]
        .try_get("", "id")
        .unwrap();

    tree_move_node(
        &tx,
        TreeMoveArgs {
            spec: &TreeSort::new(table).with_scope("scope_id"),
            id: moved_id as u64,
            new_scope: None,
            new_parent: Some("002".to_string()),
            operator_id: None,
        },
    )
    .await
    .unwrap();

    assert_eq!(
        tree_codes(&tx, table, 1).await,
        vec![
            "001",       // 根
            "001001",    // 旧父下剩两个，后一个前移
            "001002",
            "002",       // 根（字典序排在 001xxx 之后）
            "002001",
            "002002",
            "002003",     // 移动的节点追加到新父末尾
            "002003001",  // 子树跟着级联
        ]
    );
    tx.rollback().await.unwrap();
}

#[tokio::test]
async fn tree_move_rejects_own_descendant_as_parent() {
    let Some(db) = connect().await else {
        return;
    };
    let tx = db.begin().await.unwrap();
    let table = "t_probe_tree_cycle";
    create_tree_table(&tx, table).await;
    exec(
        &tx,
        &format!(
            "INSERT INTO {table} (scope_id, tree_code) VALUES
             (1,'001'),(1,'001001')"
        ),
    )
    .await
    .unwrap();
    let node_id: i64 = query(
        &tx,
        &format!("SELECT id FROM {table} WHERE scope_id = 1 AND tree_code = '001'"),
    )
    .await
    .unwrap()[0]
        .try_get("", "id")
        .unwrap();

    let result = tree_move_node(
        &tx,
        TreeMoveArgs {
            spec: &TreeSort::new(table).with_scope("scope_id"),
            id: node_id as u64,
            new_scope: None,
            new_parent: Some("001001".to_string()),
            operator_id: None,
        },
    )
    .await;

    assert!(result.is_err(), "不能把节点挂到自己的后代下");
    tx.rollback().await.unwrap();
}

/// 建一个应用，供菜单树测试使用；应用是全局配置，不依赖领域。
async fn seed_menu_scope<C: ConnectionTrait>(db: &C, app_id: i64, suffix: &str) {
    exec(
        db,
        &format!(
            "INSERT INTO adm_app (id, code, name, sort_order, creater_id, create_ms, updater_id, update_ms)
             VALUES ({app_id}, 'app-{suffix}', '应用{suffix}', 1, 0, 0, 0, 0)"
        ),
    )
    .await
    .unwrap();
}

#[tokio::test]
async fn menu_cascade_delete_preview_and_compaction() {
    let Some(db) = connect().await else {
        return;
    };
    let tx = db.begin().await.unwrap();
    let app_id = 910_000_000_000_000_101i64;
    let root_id = 910_000_000_000_000_111i64;
    seed_menu_scope(&tx, app_id, "cascade").await;
    exec(
        &tx,
        &format!(
            "INSERT INTO adm_menu
             (id, app_id, tree_code, code, name, path, creater_id, create_ms, updater_id, update_ms) VALUES
             ({root_id}, {app_id}, '001', 'root', '根菜单', '/root', 0, 0, 0, 0),
             ({}, {app_id}, '001001', 'child1', '子菜单一', '/root/child1', 0, 0, 0, 0),
             ({}, {app_id}, '001001001', 'grand', '孙菜单', '/root/child1/grand', 0, 0, 0, 0),
             ({}, {app_id}, '001002', 'child2', '子菜单二', '/root/child2', 0, 0, 0, 0),
             ({}, {app_id}, '002', 'sibling', '兄弟菜单', '/sibling', 0, 0, 0, 0),
             ({}, {app_id}, '002001', 'sibling-child', '兄弟子菜单', '/sibling/child', 0, 0, 0, 0)",
            root_id + 1,
            root_id + 2,
            root_id + 3,
            root_id + 4,
            root_id + 5,
        ),
    )
    .await
    .unwrap();

    let preview = tree_delete_preview_with_db(&tx, "menu", root_id as u64)
        .await
        .unwrap();
    assert_eq!(preview.count, 3, "子孙：子菜单一、孙菜单、子菜单二");
    assert_eq!(
        preview
            .items
            .iter()
            .map(|item| item.name.as_str())
            .collect::<Vec<_>>(),
        vec!["子菜单一", "孙菜单", "子菜单二"]
    );
    assert!(!preview.blocked);

    menu_delete_guard(&tx, root_id as u64).await.unwrap();
    AdmMenuSvc::del_by_id(U64(root_id as u64), Some(&tx))
        .await
        .unwrap();

    let rows = query(
        &tx,
        &format!(
            "SELECT tree_code, name FROM adm_menu WHERE app_id = {app_id} ORDER BY tree_code"
        ),
    )
    .await
    .unwrap();
    assert_eq!(rows.len(), 2, "根节点和整棵子树都已删除");
    assert_eq!(
        rows[0].try_get::<String>("", "tree_code").unwrap(),
        "001",
        "原 002 前移到 001"
    );
    assert_eq!(rows[0].try_get::<String>("", "name").unwrap(), "兄弟菜单");
    assert_eq!(
        rows[1].try_get::<String>("", "tree_code").unwrap(),
        "001001",
        "兄弟的子树跟着改码"
    );
    tx.rollback().await.unwrap();
}

#[tokio::test]
async fn menu_cascade_delete_rejects_when_descendant_is_bound() {
    let Some(db) = connect().await else {
        return;
    };
    let tx = db.begin().await.unwrap();
    let app_id = 920_000_000_000_000_101i64;
    let root_id = 920_000_000_000_000_111i64;
    let child_id = root_id + 1;
    let group_id = root_id + 10;
    let role_id = root_id + 20;
    seed_menu_scope(&tx, app_id, "guard").await;
    exec(
        &tx,
        &format!(
            "INSERT INTO adm_menu
             (id, app_id, tree_code, code, name, path, creater_id, create_ms, updater_id, update_ms) VALUES
             ({root_id}, {app_id}, '001', 'guard-root', '带绑定根', '/guard-root', 0, 0, 0, 0),
             ({child_id}, {app_id}, '001001', 'guard-child', '被绑子菜单', '/guard-root/child', 0, 0, 0, 0)"
        ),
    )
    .await
    .unwrap();
    exec(
        &tx,
        &format!(
            "INSERT INTO adm_role_group
             (id, tree_code, name, creater_id, create_ms, updater_id, update_ms)
             VALUES ({group_id}, '001', '保护测试分组', 0, 0, 0, 0)"
        ),
    )
    .await
    .unwrap();
    exec(
        &tx,
        &format!(
            "INSERT INTO adm_role
             (id, group_id, name, sort_order, creater_id, create_ms, updater_id, update_ms)
             VALUES ({role_id}, {group_id}, '保护测试角色', 1, 0, 0, 0, 0)"
        ),
    )
    .await
    .unwrap();
    exec(
        &tx,
        &format!(
            "INSERT INTO adm_role_menu
             (id, menu_id, role_id, creater_id, create_ms, updater_id, update_ms)
             VALUES ({}, {child_id}, {role_id}, 0, 0, 0, 0)",
            root_id + 30
        ),
    )
    .await
    .unwrap();

    let preview = tree_delete_preview_with_db(&tx, "menu", root_id as u64)
        .await
        .unwrap();
    assert!(preview.blocked);
    assert_eq!(preview.count, 1);
    assert!(
        preview
            .block_reason
            .as_deref()
            .unwrap_or_default()
            .contains("角色菜单绑定"),
        "预检应说明被角色菜单绑定：{:?}",
        preview.block_reason
    );

    let err = menu_delete_guard(&tx, root_id as u64)
        .await
        .expect_err("子树被角色绑定时必须拒绝");
    assert!(err.to_string().contains("角色菜单绑定"), "实际：{err}");
    let err = AdmMenuSvc::del_by_id(U64(root_id as u64), Some(&tx))
        .await
        .expect_err("删除接口也必须拒绝");
    assert!(err.to_string().contains("无法删除"), "实际：{err}");

    let remaining = query(
        &tx,
        &format!("SELECT COUNT(*) AS cnt FROM adm_menu WHERE app_id = {app_id}"),
    )
    .await
    .unwrap();
    assert_eq!(
        remaining[0].try_get::<i64>("", "cnt").unwrap(),
        2,
        "拒绝后节点和子节点都应保留"
    );
    tx.rollback().await.unwrap();
}
