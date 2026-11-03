//! # 统一排序服务
//!
//! 排序值只由服务端维护：
//! - 平铺实体使用 `sort_order`，按「分组列」隔离（如 `adm_app.realm_id`、`adm_role.group_id`）；
//! - 树形实体使用 `tree_code`，按「外层隔离列 + 父编码」分组（如菜单的 `app_id`）。
//!
//! 新增：同组内 `max(sort_order) + 1`；树形实体沿用 `next_tree_code`。
//! 重排：提交同组完整 id 顺序，事务内整体重算为 `1..n`，不留空洞、不重复。
//! 并发：同一分组使用 PostgreSQL 事务级 advisory lock 串行化；树形实体按表串行化，
//! 因为重排期间要用临时编码先把兄弟子树挪走。
//!
//! 调用入口：
//! - Service 层钩子：`next_sort_order`（新增）；
//! - Controller：`reorder_flat` / `reorder_tree`。

use anyhow::anyhow;
use robotech::dao::{begin_transaction, commit_transaction, next_tree_code, DaoError};
use robotech::db::get_db_conn;
use robotech::svc::SvcError;
use sea_orm::{ConnectionTrait, DatabaseBackend, DbErr, QueryResult, Statement, Value};
use std::collections::{HashMap, HashSet};
use wheel_rs::time_utils::now_ms;
use wheel_rs::tree_utils;

/// `sort_order` 列允许的最大值（与 DTO `@range 0..=9999` 对齐）
pub const SORT_ORDER_MAX: i32 = 9999;

fn to_svc_error(error: DbErr) -> SvcError {
    SvcError::from(DaoError::parse_db_err(error))
}

fn invalid(message: impl Into<String>) -> SvcError {
    SvcError::Runtime(anyhow!(message.into()))
}


fn group_key(table: &str, group_col: Option<&str>, group_value: Option<i64>) -> String {
    match (group_col, group_value) {
        (None, _) => format!("{table}:*"),
        (Some(col), Some(value)) => format!("{table}:{col}={value}"),
        (Some(col), None) => format!("{table}:{col}=null"),
    }
}

/// 生成「组条件」SQL 与参数；`start` 是下一个可用占位符序号。
fn group_clause(
    group_col: Option<&str>,
    group_value: Option<i64>,
    start: usize,
) -> (String, Vec<Value>) {
    match group_col {
        None => ("TRUE".to_string(), Vec::new()),
        Some(col) => match group_value {
            Some(_) => (format!("{col} = ${start}"), vec![Value::BigInt(group_value)]),
            None => (format!("{col} IS NULL"), Vec::new()),
        },
    }
}

async fn query_all<C>(
    db: &C,
    sql: &str,
    values: Vec<Value>,
) -> Result<Vec<QueryResult>, SvcError>
where
    C: ConnectionTrait,
{
    db.query_all_raw(Statement::from_sql_and_values(
        DatabaseBackend::Postgres,
        sql,
        values,
    ))
    .await
    .map_err(to_svc_error)
}

async fn execute<C>(db: &C, sql: &str, values: Vec<Value>) -> Result<u64, SvcError>
where
    C: ConnectionTrait,
{
    db.execute_raw(Statement::from_sql_and_values(
        DatabaseBackend::Postgres,
        sql,
        values,
    ))
    .await
    .map(|result| result.rows_affected())
    .map_err(to_svc_error)
}

/// 事务级 advisory lock：同一 key 的并发事务在这里排队。
async fn lock_key<C>(db: &C, key: &str) -> Result<(), SvcError>
where
    C: ConnectionTrait,
{
    execute(
        db,
        "SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",
        vec![Value::String(Some(format!("adm_sort:{key}")))],
    )
    .await?;
    Ok(())
}

/// # 取同组下一个排序值
///
/// 在调用方事务内先锁分组，再取 `max(sort_order)`；空组从 1 开始。
/// 返回 `0` 时表示该组排序值已用尽（调用方应返回错误）。
pub async fn next_sort_order<C>(
    db: &C,
    table: &str,
    group_col: Option<&str>,
    group_value: Option<i64>,
) -> Result<i32, SvcError>
where
    C: ConnectionTrait + Sync,
{
    lock_key(db, &group_key(table, group_col, group_value)).await?;

    let (clause, mut values) = group_clause(group_col, group_value, 1);
    values.shrink_to_fit();
    let sql = format!(
        "SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM {table} WHERE {clause}"
    );
    let rows = query_all(db, &sql, values).await?;
    let max = rows
        .first()
        .ok_or_else(|| invalid("读取排序最大值失败"))?
        .try_get::<i32>("", "max_sort")
        .map_err(to_svc_error)?;
    let next = max.saturating_add(1);
    if next > SORT_ORDER_MAX {
        return Err(invalid(format!(
            "该分组排序值已达上限 {SORT_ORDER_MAX}，请使用重排接口整理"
        )));
    }
    Ok(next)
}

fn validate_ids(ids: &[u64]) -> Result<(), SvcError> {
    if ids.is_empty() {
        return Err(invalid("排序列表不能为空"));
    }
    let unique = ids.iter().copied().collect::<HashSet<_>>();
    if unique.len() != ids.len() {
        return Err(invalid("排序列表存在重复 ID"));
    }
    Ok(())
}

fn ids_clause(ids: &[u64]) -> (String, Vec<Value>) {
    let placeholders = ids
        .iter()
        .enumerate()
        .map(|(index, _)| format!("${}", index + 1))
        .collect::<Vec<_>>()
        .join(",");
    let values = ids
        .iter()
        .map(|id| Value::BigInt(Some(*id as i64)))
        .collect();
    (placeholders, values)
}

/// # 平铺实体重排
///
/// `group_col` 为分组列；`None` 表示全表一组。
/// 提交的 id 必须恰好覆盖同组全部记录，服务端按提交顺序写回 `1..n`。
pub async fn reorder_flat(
    table: &str,
    group_col: Option<&str>,
    ids: Vec<u64>,
    operator_id: u64,
) -> Result<u64, SvcError> {
    validate_ids(&ids)?;
    let db = get_db_conn()?;
    let tx = begin_transaction(db.as_ref()).await?;

    let affected = reorder_flat_in_tx(&tx, table, group_col, &ids, Some(operator_id)).await?;
    commit_transaction(tx).await?;
    Ok(affected)
}

async fn reorder_flat_in_tx<C>(
    db: &C,
    table: &str,
    group_col: Option<&str>,
    ids: &[u64],
    operator_id: Option<u64>,
) -> Result<u64, SvcError>
where
    C: ConnectionTrait,
{
    let (placeholders, id_values) = ids_clause(ids);
    let select_sql = match group_col {
        Some(col) => format!(
            "SELECT id, sort_order, {col} AS group_value FROM {table} WHERE id IN ({placeholders})"
        ),
        None => format!(
            "SELECT id, sort_order, NULL::bigint AS group_value FROM {table} WHERE id IN ({placeholders})"
        ),
    };
    let rows = query_all(db, &select_sql, id_values).await?;
    if rows.len() != ids.len() {
        return Err(invalid("排序列表包含不存在或不属于该实体的记录"));
    }

    let group_value = rows
        .first()
        .ok_or_else(|| invalid("排序列表不能为空"))?
        .try_get::<Option<i64>>("", "group_value")
        .map_err(to_svc_error)?;
    for row in &rows {
        let current = row
            .try_get::<Option<i64>>("", "group_value")
            .map_err(to_svc_error)?;
        if current != group_value {
            return Err(invalid("排序列表跨越了多个分组，请按同组记录提交"));
        }
    }

    lock_key(db, &group_key(table, group_col, group_value)).await?;

    let (clause, mut values) = group_clause(group_col, group_value, 1);
    values.shrink_to_fit();
    let lock_sql = format!(
        "SELECT id FROM {table} WHERE {clause} ORDER BY sort_order, id FOR UPDATE"
    );
    let locked = query_all(db, &lock_sql, values).await?;
    let existing = locked
        .iter()
        .map(|row| row.try_get::<i64>("", "id").map(|id| id as u64))
        .collect::<Result<HashSet<_>, DbErr>>()
        .map_err(to_svc_error)?;
    if existing.len() != ids.len() || !ids.iter().all(|id| existing.contains(id)) {
        return Err(invalid(
            "排序列表必须恰好覆盖同一分组的全部记录（有并发新增或删除时请刷新后重试）",
        ));
    }

    let update_ms = now_ms();
    let mut affected = 0u64;
    for (index, id) in ids.iter().enumerate() {
        match operator_id {
            Some(operator_id) => {
                affected += execute(
                    db,
                    &format!(
                        "UPDATE {table} SET sort_order = $1, updater_id = $2, update_ms = $3 WHERE id = $4"
                    ),
                    vec![
                        Value::Int(Some(index as i32 + 1)),
                        Value::BigInt(Some(operator_id as i64)),
                        Value::BigInt(Some(update_ms as i64)),
                        Value::BigInt(Some(*id as i64)),
                    ],
                )
                .await?;
            }
            None => {
                affected += execute(
                    db,
                    &format!(
                        "UPDATE {table} SET sort_order = $1, update_ms = $2 WHERE id = $3"
                    ),
                    vec![
                        Value::Int(Some(index as i32 + 1)),
                        Value::BigInt(Some(update_ms as i64)),
                        Value::BigInt(Some(*id as i64)),
                    ],
                )
                .await?;
            }
        }
    }
    Ok(affected)
}

fn tree_parent(code: &str) -> Option<&str> {
    if code.len() < 3 || code.len() % 3 != 0 || !code.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    Some(&code[..code.len() - 3])
}

fn base36_pair(index: usize) -> String {
    const ALPHABET: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    let high = ALPHABET[(index / 36) % 36] as char;
    let low = ALPHABET[index % 36] as char;
    format!("~{high}{low}")
}

/// # 树形实体重排（按 `tree_code`）
///
/// `scope_col` 是外层隔离列（菜单 `app_id`、角色/权限分组 `realm_id`）；
/// `None` 表示全局一棵树（如组织）。
///
/// 算法：
/// 1. 校验提交的 id 必须同属一个父节点、一个外层隔离域；
/// 2. 锁住同父全部兄弟后，按提交顺序生成连续子段 `001..n`；
/// 3. 先把每个兄弟子树挪到临时编码，再落到最终编码，避免唯一键冲突；
/// 4. 整棵树（含后代）在同一事务内级联更新。
pub async fn reorder_tree(
    table: &str,
    scope_col: Option<&str>,
    ids: Vec<u64>,
    operator_id: u64,
) -> Result<u64, SvcError> {
    validate_ids(&ids)?;
    let db = get_db_conn()?;
    let tx = begin_transaction(db.as_ref()).await?;

    let affected = reorder_tree_in_tx(&tx, table, scope_col, &ids, Some(operator_id)).await?;
    commit_transaction(tx).await?;
    Ok(affected)
}

async fn reorder_tree_in_tx<C>(
    db: &C,
    table: &str,
    scope_col: Option<&str>,
    ids: &[u64],
    operator_id: Option<u64>,
) -> Result<u64, SvcError>
where
    C: ConnectionTrait,
{
    let (placeholders, id_values) = ids_clause(ids);
    let select_sql = match scope_col {
        Some(col) => format!(
            "SELECT id, tree_code, {col} AS scope_value FROM {table} WHERE id IN ({placeholders})"
        ),
        None => format!(
            "SELECT id, tree_code, NULL::bigint AS scope_value FROM {table} WHERE id IN ({placeholders})"
        ),
    };
    let rows = query_all(db, &select_sql, id_values).await?;
    if rows.len() != ids.len() {
        return Err(invalid("排序列表包含不存在或不属于该实体的记录"));
    }

    let scope_value = rows
        .first()
        .ok_or_else(|| invalid("排序列表不能为空"))?
        .try_get::<Option<i64>>("", "scope_value")
        .map_err(to_svc_error)?;
    let first_code = rows
        .first()
        .ok_or_else(|| invalid("排序列表不能为空"))?
        .try_get::<String>("", "tree_code")
        .map_err(to_svc_error)?;
    let parent = tree_parent(&first_code)
        .ok_or_else(|| invalid(format!("非法的 tree_code：{first_code}")))?
        .to_string();
    let sibling_len = parent.len() + 3;

    let mut submitted = HashMap::new();
    for row in &rows {
        let current_scope = row
            .try_get::<Option<i64>>("", "scope_value")
            .map_err(to_svc_error)?;
        let code = row
            .try_get::<String>("", "tree_code")
            .map_err(to_svc_error)?;
        if current_scope != scope_value {
            return Err(invalid("排序列表跨越了多个隔离域，请按同一外层范围提交"));
        }
        if tree_parent(&code) != Some(parent.as_str()) {
            return Err(invalid("排序列表只能包含同一父节点的兄弟记录"));
        }
        let id = row.try_get::<i64>("", "id").map_err(to_svc_error)? as u64;
        submitted.insert(id, code);
    }

    // 树形重排会使用临时编码，按表串行化，避免不同父节点并发时临时编码互相干扰。
    lock_key(db, &format!("tree:{table}")).await?;

    let (scope_clause, values) = match (scope_col, scope_value) {
        (None, _) => ("TRUE".to_string(), Vec::new()),
        (Some(col), Some(_)) => (
            format!("{col} = $1"),
            vec![Value::BigInt(scope_value)],
        ),
        (Some(col), None) => (format!("{col} IS NULL"), Vec::new()),
    };
    let parent_placeholder = if values.is_empty() { "$1" } else { "$2" };
    let len_placeholder = if values.is_empty() { "$2" } else { "$3" };
    let mut lock_sql = format!(
        "SELECT id, tree_code FROM {table} WHERE {scope_clause} AND length(tree_code) = {len_placeholder}"
    );
    let mut lock_values = values;
    if parent.is_empty() {
        lock_values.push(Value::Int(Some(sibling_len as i32)));
    } else {
        lock_sql.push_str(&format!(" AND tree_code LIKE {parent_placeholder} || '%'"));
        lock_values.push(Value::String(Some(parent.clone())));
        lock_values.push(Value::Int(Some(sibling_len as i32)));
    }
    lock_sql.push_str(" ORDER BY tree_code FOR UPDATE");
    let locked = query_all(db, &lock_sql, lock_values).await?;

    if locked.len() != ids.len() {
        return Err(invalid(
            "排序列表必须恰好覆盖同一父节点的全部兄弟记录（有并发新增或删除时请刷新后重试）",
        ));
    }
    for row in &locked {
        let id = row.try_get::<i64>("", "id").map_err(to_svc_error)? as u64;
        let code = row
            .try_get::<String>("", "tree_code")
            .map_err(to_svc_error)?;
        if submitted.get(&id) != Some(&code) {
            return Err(invalid("排序列表与当前树结构不一致，请刷新后重试"));
        }
    }
    if ids.len() > 999 {
        return Err(invalid("同一父节点的兄弟记录超过 999 条，无法生成三位子段"));
    }

    let codes = ids
        .iter()
        .map(|id| {
            submitted
                .get(id)
                .cloned()
                .ok_or_else(|| invalid("排序列表与当前树结构不一致，请刷新后重试"))
        })
        .collect::<Result<Vec<_>, SvcError>>()?;
    rewrite_siblings(db, table, scope_col, scope_value, &parent, &codes, operator_id).await
}

/// # 把一组兄弟按给定顺序改写成连续子段
///
/// `codes` 是**当前**编码、按目标顺序排列；`parent` 是它们的父编码前缀。
///
/// 分两段写：
/// 1. 每个兄弟（含整棵子树）先挪到临时编码 `~xx`，避开 `tree_code` 唯一约束
///    （直接相邻互换时两个编码会同时占用对方的位置）；
/// 2. 再按 `parent + 001..n` 落位，后代用 `substr` 保留相对段。
///
/// 调用方需先持有表级 advisory lock（`tree:{table}`）——临时编码只在事务内可见，
/// 但仍要避免同表不同父节点的两次重排互相踩到对方的临时编码。
async fn rewrite_siblings<C>(
    db: &C,
    table: &str,
    scope_col: Option<&str>,
    scope_value: Option<i64>,
    parent: &str,
    codes: &[String],
    operator_id: Option<u64>,
) -> Result<u64, SvcError>
where
    C: ConnectionTrait,
{
    if codes.len() > 999 {
        return Err(invalid("同一父节点的兄弟记录超过 999 条，无法生成三位子段"));
    }

    let update_ms = now_ms();
    let mut affected = 0u64;

    // 第一段：按目标顺序把每个兄弟子树挪到临时编码（`~` 开头，不会与合法 tree_code 冲突）
    for (index, code) in codes.iter().enumerate() {
        let temp = base36_pair(index);
        let (sql, values) = match operator_id {
            Some(operator_id) => {
                let (scope_clause, scope_values) = match (scope_col, scope_value) {
                    (None, _) => ("TRUE".to_string(), Vec::new()),
                    (Some(col), Some(_)) => (
                        format!("{col} = $7"),
                        vec![Value::BigInt(scope_value)],
                    ),
                    (Some(col), None) => (format!("{col} IS NULL"), Vec::new()),
                };
                let mut values = vec![
                    Value::String(Some(temp)),
                    Value::Int(Some((parent.len() + 3) as i32)),
                    Value::Int(Some((parent.len() + 4) as i32)),
                    Value::BigInt(Some(operator_id as i64)),
                    Value::BigInt(Some(update_ms as i64)),
                    Value::String(Some(code.clone())),
                ];
                values.extend(scope_values);
                (
                    format!(
                        "UPDATE {table}
                         SET tree_code = $1 || CASE WHEN length(tree_code) > $2 THEN substr(tree_code, $3) ELSE '' END,
                             updater_id = $4, update_ms = $5
                         WHERE tree_code LIKE $6 || '%' AND {scope_clause}"
                    ),
                    values,
                )
            }
            None => {
                let (scope_clause, scope_values) = match (scope_col, scope_value) {
                    (None, _) => ("TRUE".to_string(), Vec::new()),
                    (Some(col), Some(_)) => (
                        format!("{col} = $6"),
                        vec![Value::BigInt(scope_value)],
                    ),
                    (Some(col), None) => (format!("{col} IS NULL"), Vec::new()),
                };
                let mut values = vec![
                    Value::String(Some(temp)),
                    Value::Int(Some((parent.len() + 3) as i32)),
                    Value::Int(Some((parent.len() + 4) as i32)),
                    Value::BigInt(Some(update_ms as i64)),
                    Value::String(Some(code.clone())),
                ];
                values.extend(scope_values);
                (
                    format!(
                        "UPDATE {table}
                         SET tree_code = $1 || CASE WHEN length(tree_code) > $2 THEN substr(tree_code, $3) ELSE '' END,
                             update_ms = $4
                         WHERE tree_code LIKE $5 || '%' AND {scope_clause}"
                    ),
                    values,
                )
            }
        };
        affected += execute(db, &sql, values).await?;
    }

    // 第二段：按目标顺序落到最终编码（补零到 3 位，1..n 连续）
    for index in 0..codes.len() {
        let final_code = format!("{parent}{:03}", index + 1);
        if final_code.len() > 30 {
            return Err(invalid("tree_code 超过 30 位，无法重排"));
        }
        let temp = base36_pair(index);
        let (sql, values) = match operator_id {
            Some(operator_id) => {
                let scope_values = match (scope_col, scope_value) {
                    (Some(_), Some(_)) => vec![Value::BigInt(scope_value)],
                    _ => Vec::new(),
                };
                let sql = match (scope_col, scope_value) {
                    (Some(col), Some(_)) => format!(
                        "UPDATE {table}
                         SET tree_code = $1 || substr(tree_code, 4), updater_id = $2, update_ms = $3
                         WHERE tree_code LIKE $4 || '%' AND {col} = $5"
                    ),
                    (Some(col), None) => format!(
                        "UPDATE {table}
                         SET tree_code = $1 || substr(tree_code, 4), updater_id = $2, update_ms = $3
                         WHERE tree_code LIKE $4 || '%' AND {col} IS NULL"
                    ),
                    (None, _) => format!(
                        "UPDATE {table}
                         SET tree_code = $1 || substr(tree_code, 4), updater_id = $2, update_ms = $3
                         WHERE tree_code LIKE $4 || '%'"
                    ),
                };
                let mut values = vec![
                    Value::String(Some(final_code)),
                    Value::BigInt(Some(operator_id as i64)),
                    Value::BigInt(Some(update_ms as i64)),
                    Value::String(Some(temp)),
                ];
                values.extend(scope_values);
                (sql, values)
            }
            None => {
                let scope_values = match (scope_col, scope_value) {
                    (Some(_), Some(_)) => vec![Value::BigInt(scope_value)],
                    _ => Vec::new(),
                };
                let sql = match (scope_col, scope_value) {
                    (Some(col), Some(_)) => format!(
                        "UPDATE {table}
                         SET tree_code = $1 || substr(tree_code, 4), update_ms = $2
                         WHERE tree_code LIKE $3 || '%' AND {col} = $4"
                    ),
                    (Some(col), None) => format!(
                        "UPDATE {table}
                         SET tree_code = $1 || substr(tree_code, 4), update_ms = $2
                         WHERE tree_code LIKE $3 || '%' AND {col} IS NULL"
                    ),
                    (None, _) => format!(
                        "UPDATE {table}
                         SET tree_code = $1 || substr(tree_code, 4), update_ms = $2
                         WHERE tree_code LIKE $3 || '%'"
                    ),
                };
                let values = {
                    let mut values = vec![
                        Value::String(Some(final_code)),
                        Value::BigInt(Some(update_ms as i64)),
                        Value::String(Some(temp)),
                    ];
                    values.extend(scope_values);
                    values
                };
                (sql, values)
            }
        };
        affected += execute(db, &sql, values).await?;
    }

    Ok(affected)
}

/// # 外层隔离条件 SQL
///
/// `start` 是下一个可用占位符序号，返回 `(子句, 参数)`；`TRUE` 表示不做隔离。
fn tree_scope_clause(
    scope_col: Option<&str>,
    scope_value: Option<i64>,
    start: usize,
) -> (String, Vec<Value>) {
    match (scope_col, scope_value) {
        (None, _) => ("TRUE".to_string(), Vec::new()),
        (Some(col), Some(_)) => (
            format!("{col} = ${start}"),
            vec![Value::BigInt(scope_value)],
        ),
        (Some(col), None) => (format!("{col} IS NULL"), Vec::new()),
    }
}

/// # 树表级 advisory lock
///
/// 树形实体的写操作统一按表串行化：临时编码、子树前缀级联都要求同一时刻
/// 只有一个人在改这张表的树结构。
pub async fn tree_lock<C>(db: &C, table: &str) -> Result<(), SvcError>
where
    C: ConnectionTrait,
{
    lock_key(db, &format!("tree:{table}")).await
}

/// # 删除单条后压缩同组序号
///
/// 同一分组内 `sort_order > removed_sort_order` 的记录整体 −1，后面的序号前移，
/// 不留空洞。与重排一致：先拿分组 advisory lock，再 `FOR UPDATE` 锁住受影响的
/// 记录，最后一次性前移；都在调用方事务里，失败整体回滚。
pub async fn compact_flat_after_delete<C>(
    db: &C,
    table: &str,
    group_col: Option<&str>,
    group_value: Option<i64>,
    removed_sort_order: i32,
    operator_id: Option<u64>,
) -> Result<u64, SvcError>
where
    C: ConnectionTrait,
{
    lock_key(db, &group_key(table, group_col, group_value)).await?;

    let (clause, mut values) = group_clause(group_col, group_value, 1);
    let removed_idx = values.len() + 1;
    values.push(Value::Int(Some(removed_sort_order)));

    let lock_sql = format!(
        "SELECT id FROM {table} WHERE {clause} AND sort_order > ${removed_idx} ORDER BY sort_order, id FOR UPDATE"
    );
    query_all(db, &lock_sql, values.clone()).await?;

    let now_idx = values.len() + 1;
    values.push(Value::BigInt(Some(now_ms() as i64)));
    let mut sets = format!("sort_order = sort_order - 1, update_ms = ${now_idx}");
    if let Some(operator_id) = operator_id {
        let op_idx = values.len() + 1;
        values.push(Value::BigInt(Some(operator_id as i64)));
        sets.push_str(&format!(", updater_id = ${op_idx}"));
    }
    execute(
        db,
        &format!("UPDATE {table} SET {sets} WHERE {clause} AND sort_order > ${removed_idx}"),
        values,
    )
    .await
}

/// # 整组重算连续序号（`1..n`）
///
/// 批量删除后调用：只对出现空洞的组做一次整组重算，不逐条压缩。
/// 组内按 `(sort_order, id)` 排序，写回 `1..n`。
async fn compact_flat_group_in_tx<C>(
    db: &C,
    table: &str,
    group_col: Option<&str>,
    group_value: Option<i64>,
    operator_id: Option<u64>,
) -> Result<u64, SvcError>
where
    C: ConnectionTrait,
{
    let (clause, values) = group_clause(group_col, group_value, 1);
    let sql =
        format!("SELECT id, sort_order FROM {table} WHERE {clause} ORDER BY sort_order, id FOR UPDATE");
    let rows = query_all(db, &sql, values).await?;

    let update_ms = now_ms();
    let mut affected = 0u64;
    for (index, row) in rows.iter().enumerate() {
        let id = row.try_get::<i64>("", "id").map_err(to_svc_error)?;
        let current = row.try_get::<i32>("", "sort_order").map_err(to_svc_error)?;
        let target = index as i32 + 1;
        if current == target {
            continue;
        }
        affected += match operator_id {
            Some(operator_id) => {
                execute(
                    db,
                    &format!(
                        "UPDATE {table} SET sort_order = $1, updater_id = $2, update_ms = $3 WHERE id = $4"
                    ),
                    vec![
                        Value::Int(Some(target)),
                        Value::BigInt(Some(operator_id as i64)),
                        Value::BigInt(Some(update_ms as i64)),
                        Value::BigInt(Some(id)),
                    ],
                )
                .await?
            }
            None => {
                execute(
                    db,
                    &format!("UPDATE {table} SET sort_order = $1, update_ms = $2 WHERE id = $3"),
                    vec![
                        Value::Int(Some(target)),
                        Value::BigInt(Some(update_ms as i64)),
                        Value::BigInt(Some(id)),
                    ],
                )
                .await?
            }
        };
    }
    Ok(affected)
}

/// # 批量删除后压缩平铺实体
///
/// 扫描全表所有分组，只对「最大值不等于条数」或「序号有重复」的组整组重算，
/// 每组重算一次；组之间按 key 字符串排序加锁，避免并发批量删除互相等待。
pub async fn compact_flat_gaps<C>(
    db: &C,
    table: &str,
    group_col: Option<&str>,
) -> Result<u64, SvcError>
where
    C: ConnectionTrait,
{
    let sql = match group_col {
        Some(col) => format!(
            "SELECT {col} AS group_value, MAX(sort_order) AS max_sort, COUNT(*) AS cnt,
                    COUNT(DISTINCT sort_order) AS distinct_cnt
             FROM {table}
             GROUP BY {col}
             HAVING MAX(sort_order) <> COUNT(*) OR COUNT(DISTINCT sort_order) <> COUNT(*)"
        ),
        None => format!(
            "SELECT NULL::bigint AS group_value, MAX(sort_order) AS max_sort, COUNT(*) AS cnt,
                    COUNT(DISTINCT sort_order) AS distinct_cnt
             FROM {table}
             HAVING MAX(sort_order) <> COUNT(*) OR COUNT(DISTINCT sort_order) <> COUNT(*)"
        ),
    };
    let rows = query_all(db, &sql, Vec::new()).await?;
    let mut groups = rows
        .iter()
        .map(|row| {
            row.try_get::<Option<i64>>("", "group_value")
                .map_err(to_svc_error)
        })
        .collect::<Result<Vec<_>, SvcError>>()?;
    groups.sort_by_key(|value| group_key(table, group_col, *value));

    let mut affected = 0u64;
    for group in groups {
        lock_key(db, &group_key(table, group_col, group)).await?;
        affected += compact_flat_group_in_tx(db, table, group_col, group, None).await?;
    }
    Ok(affected)
}

/// # 校验平铺分组内无同号冲突
///
/// `exclude_id` 用于「改分组」场景：此时被移动的记录还在旧分组里，且旧分组
/// 后续记录已经前移，两者会短暂同号；把它排除后校验的才是移动完成后的状态。
async fn assert_flat_group_unique<C>(
    db: &C,
    table: &str,
    group_col: Option<&str>,
    group_value: Option<i64>,
    exclude_id: Option<u64>,
) -> Result<(), SvcError>
where
    C: ConnectionTrait,
{
    let (mut clause, mut values) = group_clause(group_col, group_value, 1);
    if let Some(id) = exclude_id {
        values.push(Value::BigInt(Some(id as i64)));
        clause.push_str(&format!(" AND id <> ${}", values.len()));
    }
    let sql = format!(
        "SELECT COUNT(*) AS cnt, COUNT(DISTINCT sort_order) AS distinct_cnt FROM {table} WHERE {clause}"
    );
    let rows = query_all(db, &sql, values).await?;
    let row = rows
        .first()
        .ok_or_else(|| invalid("校验排序结果失败"))?;
    let cnt = row.try_get::<i64>("", "cnt").map_err(to_svc_error)?;
    let distinct = row
        .try_get::<i64>("", "distinct_cnt")
        .map_err(to_svc_error)?;
    if cnt != distinct {
        return Err(invalid("分组内存在重复排序值，请刷新后重试"));
    }
    Ok(())
}

/// # 平铺实体改分组
///
/// 分组列变化时，新分组排到末尾（`max+1`），旧分组里排在它后面的记录整体前移 −1；
/// 两组在同一事务内完成。返回新排序值（`None` 表示分组没变，排序值保持不动）。
///
/// 加锁顺序：先按组 key 字符串排序拿 advisory lock，再把受影响的记录
/// `FOR UPDATE` 锁住——A→B 与 B→A 并发时不会互相等待。
pub async fn flat_move_group<C>(
    db: &C,
    table: &str,
    group_col: &str,
    id: u64,
    new_group: Option<i64>,
    operator_id: Option<u64>,
) -> Result<Option<i32>, SvcError>
where
    C: ConnectionTrait,
{
    // 先无锁读分组、按 key 排序拿两把分组锁，最后才锁行。
    // 反过来「先锁行、再等分组锁」会与并发压缩形成行锁 ↔ 分组锁的环形等待：
    // 对方持有分组锁正在前移它后面的记录，恰好包含我们锁住的那一行。
    let rows = query_all(
        db,
        &format!("SELECT {group_col} AS group_value FROM {table} WHERE id = $1"),
        vec![Value::BigInt(Some(id as i64))],
    )
    .await?;
    let Some(row) = rows.first() else {
        // 记录不存在：交给框架的 update 去报 NotFound
        return Ok(None);
    };
    let old_group = row
        .try_get::<Option<i64>>("", "group_value")
        .map_err(to_svc_error)?;
    if old_group == new_group {
        return Ok(None);
    }

    let old_key = group_key(table, Some(group_col), old_group);
    let new_key = group_key(table, Some(group_col), new_group);
    if old_key <= new_key {
        lock_key(db, &old_key).await?;
        lock_key(db, &new_key).await?;
    } else {
        lock_key(db, &new_key).await?;
        lock_key(db, &old_key).await?;
    }

    // 拿到分组锁后重读：分组若已被并发改走，本次请求基于旧分组算出的前移
    // 已经没有意义，直接要求刷新，避免在错误的组上压缩。
    let rows = query_all(
        db,
        &format!(
            "SELECT id, sort_order, {group_col} AS group_value FROM {table} WHERE id = $1 FOR UPDATE"
        ),
        vec![Value::BigInt(Some(id as i64))],
    )
    .await?;
    let Some(row) = rows.first() else {
        return Ok(None);
    };
    let current_group = row
        .try_get::<Option<i64>>("", "group_value")
        .map_err(to_svc_error)?;
    if current_group != old_group {
        return Err(invalid("记录的分组已被并发修改，请刷新后重试"));
    }
    let old_sort = row.try_get::<i32>("", "sort_order").map_err(to_svc_error)?;

    // 新分组末尾
    let next = next_sort_order(db, table, Some(group_col), new_group).await?;
    // 旧分组后续前移
    compact_flat_after_delete(
        db,
        table,
        Some(group_col),
        old_group,
        old_sort,
        operator_id,
    )
    .await?;

    assert_flat_group_unique(db, table, Some(group_col), old_group, Some(id)).await?;
    assert_flat_group_unique(db, table, Some(group_col), new_group, None).await?;
    Ok(Some(next))
}

/// # 删除单条后压缩树形兄弟组
///
/// 被删节点所在父节点下、排在它后面的兄弟整体前移一位（含各自子树）。
/// 被删节点若仍有后代（路径枚举允许留下孤儿），跳过压缩，避免复用旧编码
/// 把孤儿挂到新的兄弟节点下。
pub async fn compact_tree_after_delete<C>(
    db: &C,
    table: &str,
    scope_col: Option<&str>,
    scope_value: Option<i64>,
    tree_code: &str,
    operator_id: Option<u64>,
) -> Result<u64, SvcError>
where
    C: ConnectionTrait,
{
    let parent = tree_parent(tree_code)
        .ok_or_else(|| invalid(format!("非法的 tree_code：{tree_code}")))?
        .to_string();
    compact_tree_group_in_tx(db, table, scope_col, scope_value, &parent, operator_id).await
}

/// # 把某个父节点下的兄弟重排成连续段
///
/// 已经连续时直接返回，不做写入；检测到「新槽位下面还有孤儿后代」时也跳过。
async fn compact_tree_group_in_tx<C>(
    db: &C,
    table: &str,
    scope_col: Option<&str>,
    scope_value: Option<i64>,
    parent: &str,
    operator_id: Option<u64>,
) -> Result<u64, SvcError>
where
    C: ConnectionTrait,
{
    tree_lock(db, table).await?;

    let (clause, mut values) = tree_scope_clause(scope_col, scope_value, 1);
    let len_idx = values.len() + 1;
    values.push(Value::Int(Some((parent.len() + 3) as i32)));
    let mut sql = format!(
        "SELECT id, tree_code FROM {table} WHERE {clause} AND length(tree_code) = ${len_idx}"
    );
    if !parent.is_empty() {
        let parent_idx = values.len() + 1;
        sql.push_str(&format!(" AND tree_code LIKE ${parent_idx} || '%'"));
        values.push(Value::String(Some(parent.to_string())));
    }
    sql.push_str(" ORDER BY tree_code, id FOR UPDATE");
    let rows = query_all(db, &sql, values).await?;

    let existing = rows
        .iter()
        .map(|row| row.try_get::<String>("", "tree_code"))
        .collect::<Result<Vec<_>, DbErr>>()
        .map_err(to_svc_error)?;
    if existing.is_empty() {
        return Ok(0);
    }
    let contiguous = existing
        .iter()
        .enumerate()
        .all(|(index, code)| code == &format!("{parent}{:03}", index + 1));
    if contiguous {
        return Ok(0);
    }

    // 新编码若还压着「已删除节点的后代」（旧编码作为子树根），前移会把它挂到
    // 新的兄弟节点下。这种组保留空洞，不压缩。
    let existing_set: HashSet<&str> = existing.iter().map(|code| code.as_str()).collect();
    let mut orphan_values = vec![Value::Int(Some((parent.len() + 3) as i32))];
    let (orphan_clause, orphan_scope_values) = tree_scope_clause(scope_col, scope_value, 2);
    let mut orphan_sql = format!(
        "SELECT substr(tree_code, 1, $1) AS root FROM {table}
         WHERE length(tree_code) > $1 AND {orphan_clause}"
    );
    orphan_values.extend(orphan_scope_values);
    if !parent.is_empty() {
        let parent_idx = orphan_values.len() + 1;
        orphan_sql.push_str(&format!(" AND tree_code LIKE ${parent_idx} || '%'"));
        orphan_values.push(Value::String(Some(parent.to_string())));
    }
    orphan_sql.push_str(" GROUP BY 1");
    for row in query_all(db, &orphan_sql, orphan_values).await? {
        let root = row.try_get::<String>("", "root").map_err(to_svc_error)?;
        if !existing_set.contains(root.as_str()) {
            return Ok(0);
        }
    }

    rewrite_siblings(db, table, scope_col, scope_value, parent, &existing, operator_id).await
}

/// # 批量删除后压缩树形实体
///
/// 扫描所有「外层范围 + 父节点」分组，只对子段不连续的组各做一次整组重算。
/// 树表整体按 `tree:{table}` 串行化，组之间不需要再单独排序加锁。
pub async fn compact_tree_gaps<C>(
    db: &C,
    table: &str,
    scope_col: Option<&str>,
) -> Result<u64, SvcError>
where
    C: ConnectionTrait,
{
    tree_lock(db, table).await?;

    let sql = match scope_col {
        Some(col) => format!(
            "SELECT {col} AS scope_value, substr(tree_code, 1, length(tree_code) - 3) AS parent
             FROM {table}
             GROUP BY {col}, 2
             HAVING MAX(substr(tree_code, length(tree_code) - 2))::int <> COUNT(*)
                 OR COUNT(DISTINCT substr(tree_code, length(tree_code) - 2)) <> COUNT(*)"
        ),
        None => format!(
            "SELECT NULL::bigint AS scope_value, substr(tree_code, 1, length(tree_code) - 3) AS parent
             FROM {table}
             GROUP BY 2
             HAVING MAX(substr(tree_code, length(tree_code) - 2))::int <> COUNT(*)
                 OR COUNT(DISTINCT substr(tree_code, length(tree_code) - 2)) <> COUNT(*)"
        ),
    };
    let rows = query_all(db, &sql, Vec::new()).await?;
    let mut groups = Vec::new();
    for row in &rows {
        let scope = row
            .try_get::<Option<i64>>("", "scope_value")
            .map_err(to_svc_error)?;
        let parent = row
            .try_get::<String>("", "parent")
            .map_err(to_svc_error)?;
        groups.push((scope, parent));
    }
    groups.sort_by(|left, right| {
        format!("{table}:{:?}:{}", left.0, left.1).cmp(&format!("{table}:{:?}:{}", right.0, right.1))
    });

    let mut affected = 0u64;
    for (scope, parent) in groups {
        affected +=
            compact_tree_group_in_tx(db, table, scope_col, scope, &parent, None).await?;
    }
    Ok(affected)
}

/// # 校验树形兄弟组内无同号冲突
async fn assert_tree_group_unique<C>(
    db: &C,
    table: &str,
    scope_col: Option<&str>,
    scope_value: Option<i64>,
    parent: &str,
) -> Result<(), SvcError>
where
    C: ConnectionTrait,
{
    let (clause, mut values) = tree_scope_clause(scope_col, scope_value, 1);
    let len_idx = values.len() + 1;
    values.push(Value::Int(Some((parent.len() + 3) as i32)));
    let mut sql = format!(
        "SELECT COUNT(*) AS cnt, COUNT(DISTINCT tree_code) AS distinct_cnt
         FROM {table} WHERE {clause} AND length(tree_code) = ${len_idx}"
    );
    if !parent.is_empty() {
        let parent_idx = values.len() + 1;
        sql.push_str(&format!(" AND tree_code LIKE ${parent_idx} || '%'"));
        values.push(Value::String(Some(parent.to_string())));
    }
    let rows = query_all(db, &sql, values).await?;
    let row = rows
        .first()
        .ok_or_else(|| invalid("校验排序结果失败"))?;
    let cnt = row.try_get::<i64>("", "cnt").map_err(to_svc_error)?;
    let distinct = row
        .try_get::<i64>("", "distinct_cnt")
        .map_err(to_svc_error)?;
    if cnt != distinct {
        return Err(invalid("兄弟节点存在重复 tree_code，请刷新后重试"));
    }
    Ok(())
}

/// # 树形节点移动参数
pub struct TreeMoveArgs<'a> {
    /// 表名（代码常量）
    pub table: &'a str,
    /// 外层隔离列（菜单 `app_id`、分组 `realm_id`）；`None` 表示全局一棵树
    pub scope_col: Option<&'a str>,
    /// 节点 ID
    pub id: u64,
    /// `None` 表示不改外层范围；`Some(v)` 表示改到 `v`
    pub new_scope: Option<i64>,
    /// `None` 表示不改父节点；`Some("")` 表示移到根
    pub new_parent: Option<String>,
    /// 操作人（写 `updater_id`），删除钩子场景可为 `None`
    pub operator_id: Option<u64>,
}

/// # 树形节点改父节点 / 改外层范围
///
/// 与 `flat_move_group` 等价，只是「分组」换成了「(外层范围, 父编码)」：
/// 新父下追加末位（`next_tree_code` 即 `max+1`），旧父下排在它后面的兄弟前移 −1，
/// 两组在同一事务内完成，节点整棵子树级联改编码。
///
/// 返回 `true` 表示确实移动了；`false` 表示坐标没变或记录不存在（交给框架报 NotFound）。
pub async fn tree_move_node<C>(db: &C, args: TreeMoveArgs<'_>) -> Result<bool, SvcError>
where
    C: ConnectionTrait,
{
    if args.new_scope.is_none() && args.new_parent.is_none() {
        return Ok(false);
    }

    let table = args.table;
    tree_lock(db, table).await?;

    let select_sql = match args.scope_col {
        Some(col) => {
            format!("SELECT tree_code, {col} AS scope_value FROM {table} WHERE id = $1 FOR UPDATE")
        }
        None => format!(
            "SELECT tree_code, NULL::bigint AS scope_value FROM {table} WHERE id = $1 FOR UPDATE"
        ),
    };
    let rows = query_all(db, &select_sql, vec![Value::BigInt(Some(args.id as i64))]).await?;
    let Some(row) = rows.first() else {
        return Ok(false);
    };
    let old_code = row
        .try_get::<String>("", "tree_code")
        .map_err(to_svc_error)?;
    let old_scope = row
        .try_get::<Option<i64>>("", "scope_value")
        .map_err(to_svc_error)?;
    let old_parent = tree_parent(&old_code)
        .ok_or_else(|| invalid(format!("非法的 tree_code：{old_code}")))?
        .to_string();

    let target_scope = args.new_scope.or(old_scope);
    let scope_changed = args.new_scope.is_some() && target_scope != old_scope;
    let target_parent = args
        .new_parent
        .clone()
        .unwrap_or_else(|| old_parent.clone());
    let parent_changed = target_parent != old_parent;
    if !scope_changed && !parent_changed {
        return Ok(false);
    }

    if !target_parent.is_empty() {
        if target_parent.starts_with(&old_code) {
            return Err(invalid("不能把节点移动到它自己的子树下"));
        }
        let mut values = vec![Value::String(Some(target_parent.clone()))];
        let mut sql = format!("SELECT 1 AS found FROM {table} WHERE tree_code = $1");
        match (args.scope_col, target_scope) {
            (Some(col), Some(value)) => {
                values.push(Value::BigInt(Some(value)));
                sql.push_str(&format!(" AND {col} = ${}", values.len()));
            }
            (Some(col), None) => sql.push_str(&format!(" AND {col} IS NULL")),
            (None, _) => {}
        }
        if query_all(db, &sql, values).await?.is_empty() {
            return Err(invalid("目标父节点不存在"));
        }
    }

    // 新父下的下一个可用编码（max+1）
    let mut scope_values: Vec<(&str, Value)> = Vec::new();
    if let (Some(col), Some(value)) = (args.scope_col, target_scope) {
        scope_values.push((col, Value::BigInt(Some(value))));
    }
    let new_code = next_tree_code(
        db,
        table,
        "tree_code",
        &target_parent,
        &scope_values,
        tree_utils::DEFAULT_STEP,
    )
    .await?;

    // 节点整棵子树级联改前缀（目标父编码 + 原相对段）；改外层范围时一并写回
    let mut values: Vec<Value> = vec![
        Value::String(Some(new_code.clone())),
        Value::Int(Some((old_code.len() + 1) as i32)),
    ];
    let mut sets = vec!["tree_code = $1 || substr(tree_code, $2)".to_string()];
    if let Some(col) = args.scope_col {
        match target_scope {
            Some(value) => {
                values.push(Value::BigInt(Some(value)));
                sets.push(format!("{col} = ${}", values.len()));
            }
            None => sets.push(format!("{col} = NULL")),
        }
    }
    values.push(Value::BigInt(Some(now_ms() as i64)));
    sets.push(format!("update_ms = ${}", values.len()));
    if let Some(operator_id) = args.operator_id {
        values.push(Value::BigInt(Some(operator_id as i64)));
        sets.push(format!("updater_id = ${}", values.len()));
    }
    values.push(Value::String(Some(old_code.clone())));
    let code_idx = values.len();
    let mut where_clause = format!("tree_code LIKE ${code_idx} || '%'");
    match (args.scope_col, old_scope) {
        (Some(col), Some(value)) => {
            values.push(Value::BigInt(Some(value)));
            where_clause.push_str(&format!(" AND {col} = ${}", values.len()));
        }
        (Some(col), None) => where_clause.push_str(&format!(" AND {col} IS NULL")),
        (None, _) => {}
    }
    execute(
        db,
        &format!("UPDATE {table} SET {} WHERE {where_clause}", sets.join(", ")),
        values,
    )
    .await?;

    // 旧父下后续兄弟前移（节点已移走，不会误伤它的子树）
    compact_tree_group_in_tx(db, table, args.scope_col, old_scope, &old_parent, args.operator_id)
        .await?;

    assert_tree_group_unique(db, table, args.scope_col, target_scope, &target_parent).await?;
    assert_tree_group_unique(db, table, args.scope_col, old_scope, &old_parent).await?;
    Ok(true)
}

/// # 平铺实体排序钩子
///
/// 为 `#[svc]` 生成 4 个模块内钩子：
/// - `sort_hooks_add`：新增取同组末尾 `max+1`；
/// - `sort_hooks_modify`：忽略客户端排序值；分组列变化时新旧两组重算；
/// - `sort_hooks_after_del_by_id`：删除后同组后续记录前移 −1；
/// - `sort_hooks_after_del_by_query_dto`：批量删除后只对出现空洞的组整组重算。
///
/// 参数依次是：表名、分组列（`None` 表示全表一组）、AddDto、ModifyDto、
/// QueryDto、Vo，以及三个取分组值的闭包（Add、Modify、Vo）。
#[macro_export]
macro_rules! flat_sort_hooks {
    ($table:literal, $group_col:expr, $add_dto:ty, $modify_dto:ty, $query_dto:ty, $vo:ty,
     $add_group:expr, $modify_group:expr, $vo_group:expr) => {
        #[allow(clippy::result_large_err)]
        async fn sort_hooks_add<C>(
            mut dto: $add_dto,
            db: &C,
        ) -> Result<$add_dto, ::robotech::svc::SvcError>
        where
            C: ::sea_orm::ConnectionTrait + Sync,
        {
            let group: Option<i64> = ($add_group)(&dto);
            dto.sort_order =
                Some($crate::svc::next_sort_order(db, $table, $group_col, group).await?);
            Ok(dto)
        }

        #[allow(clippy::result_large_err)]
        async fn sort_hooks_modify<C>(
            mut dto: $modify_dto,
            db: &C,
        ) -> Result<$modify_dto, ::robotech::svc::SvcError>
        where
            C: ::sea_orm::ConnectionTrait + Sync,
        {
            // 排序值一律由服务端接管
            dto.sort_order = None;
            let new_group: Option<Option<i64>> = ($modify_group)(&dto);
            if let (Some(new_group), Some(id)) = (new_group, dto.id) {
                if let Some(group_col) = $group_col {
                    let operator = {
                        let value = dto._current_user_id.value();
                        if value == 0 {
                            None
                        } else {
                            Some(value)
                        }
                    };
                    if let Some(next) = $crate::svc::flat_move_group(
                        db,
                        $table,
                        group_col,
                        id.value(),
                        new_group,
                        operator,
                    )
                    .await?
                    {
                        dto.sort_order = Some(next);
                    }
                }
            }
            Ok(dto)
        }

        #[allow(clippy::result_large_err)]
        async fn sort_hooks_after_del_by_id<C>(
            _id: ::robotech::api::U64,
            one: $vo,
            db: &C,
        ) -> Result<$vo, ::robotech::svc::SvcError>
        where
            C: ::sea_orm::ConnectionTrait + Sync,
        {
            let group: Option<i64> = ($vo_group)(&one);
            $crate::svc::compact_flat_after_delete(
                db,
                $table,
                $group_col,
                group,
                one.sort_order,
                None,
            )
            .await?;
            Ok(one)
        }

        #[allow(clippy::result_large_err)]
        async fn sort_hooks_after_del_by_query_dto<C>(
            _dto: $query_dto,
            rows_affected: u64,
            db: &C,
        ) -> Result<u64, ::robotech::svc::SvcError>
        where
            C: ::sea_orm::ConnectionTrait + Sync,
        {
            $crate::svc::compact_flat_gaps(db, $table, $group_col).await?;
            Ok(rows_affected)
        }
    };
}

/// # 树形实体排序钩子
///
/// 为 `#[svc]` 生成 4 个模块内钩子：
/// - `sort_hooks_add`：按父节点追加末位（生成前先拿表级锁）；
/// - `sort_hooks_modify`：忽略客户端树编码；父节点 / 外层范围变化时新旧两组重算；
/// - `sort_hooks_after_del_by_id`：删除后同父后续兄弟前移；
/// - `sort_hooks_after_del_by_query_dto`：批量删除后只对不连续的兄弟组整组重算。
///
/// 参数依次是：表名、外层隔离列（`None` 表示全局一棵树）、AddDto、ModifyDto、
/// QueryDto、Vo，以及四个取值闭包（Add 范围、Modify 范围、Modify 父编码、Vo 范围）。
#[macro_export]
macro_rules! tree_sort_hooks {
    ($table:literal, $scope_col:expr, $add_dto:ty, $modify_dto:ty, $query_dto:ty, $vo:ty,
     $add_scope:expr, $modify_scope:expr, $modify_parent:expr, $vo_scope:expr) => {
        #[allow(clippy::result_large_err)]
        async fn sort_hooks_add<C>(
            mut dto: $add_dto,
            db: &C,
        ) -> Result<$add_dto, ::robotech::svc::SvcError>
        where
            C: ::sea_orm::ConnectionTrait + Sync,
        {
            let scope: Option<i64> = ($add_scope)(&dto);
            // 外层范围是必填时，缺了就不生成，让校验层去报「必填」
            if Option::<&str>::is_some(&$scope_col) && scope.is_none() {
                return Ok(dto);
            }
            $crate::svc::tree_lock(db, $table).await?;
            let parent = dto.parent_code.clone().flatten().unwrap_or_default();
            let mut scope_values: Vec<(&str, ::sea_orm::Value)> = Vec::new();
            if let (Some(col), Some(value)) = ($scope_col, scope) {
                scope_values.push((col, ::sea_orm::Value::BigInt(Some(value))));
            }
            let code = ::robotech::dao::next_tree_code(
                db,
                $table,
                "tree_code",
                &parent,
                &scope_values,
                ::wheel_rs::tree_utils::DEFAULT_STEP,
            )
            .await?;
            dto.tree_code = Some(code);
            Ok(dto)
        }

        #[allow(clippy::result_large_err)]
        async fn sort_hooks_modify<C>(
            mut dto: $modify_dto,
            db: &C,
        ) -> Result<$modify_dto, ::robotech::svc::SvcError>
        where
            C: ::sea_orm::ConnectionTrait + Sync,
        {
            // 树编码代表位置，客户端传值一律忽略
            dto.tree_code = None;
            let Some(id) = dto.id else {
                return Ok(dto);
            };
            let new_scope: Option<i64> = ($modify_scope)(&dto);
            let new_parent: Option<String> = ($modify_parent)(&dto);
            if new_scope.is_none() && new_parent.is_none() {
                return Ok(dto);
            }
            let operator = {
                let value = dto._current_user_id.value();
                if value == 0 {
                    None
                } else {
                    Some(value)
                }
            };
            $crate::svc::tree_move_node(
                db,
                $crate::svc::TreeMoveArgs {
                    table: $table,
                    scope_col: $scope_col,
                    id: id.value(),
                    new_scope,
                    new_parent,
                    operator_id: operator,
                },
            )
            .await?;
            Ok(dto)
        }

        #[allow(clippy::result_large_err)]
        async fn sort_hooks_after_del_by_id<C>(
            _id: ::robotech::api::U64,
            one: $vo,
            db: &C,
        ) -> Result<$vo, ::robotech::svc::SvcError>
        where
            C: ::sea_orm::ConnectionTrait + Sync,
        {
            let scope: Option<i64> = ($vo_scope)(&one);
            $crate::svc::compact_tree_after_delete(
                db,
                $table,
                $scope_col,
                scope,
                &one.tree_code,
                None,
            )
            .await?;
            Ok(one)
        }

        #[allow(clippy::result_large_err)]
        async fn sort_hooks_after_del_by_query_dto<C>(
            _dto: $query_dto,
            rows_affected: u64,
            db: &C,
        ) -> Result<u64, ::robotech::svc::SvcError>
        where
            C: ::sea_orm::ConnectionTrait + Sync,
        {
            $crate::svc::compact_tree_gaps(db, $table, $scope_col).await?;
            Ok(rows_affected)
        }
    };
}
