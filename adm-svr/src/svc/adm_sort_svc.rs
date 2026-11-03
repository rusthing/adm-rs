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
use robotech::dao::{begin_transaction, commit_transaction, DaoError};
use robotech::db::get_db_conn;
use robotech::svc::SvcError;
use sea_orm::{ConnectionTrait, DatabaseBackend, DbErr, QueryResult, Statement, Value};
use std::collections::{HashMap, HashSet};
use wheel_rs::time_utils::now_ms;

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

    let affected = reorder_flat_in_tx(&tx, table, group_col, &ids, operator_id).await?;
    commit_transaction(tx).await?;
    Ok(affected)
}

async fn reorder_flat_in_tx<C>(
    db: &C,
    table: &str,
    group_col: Option<&str>,
    ids: &[u64],
    operator_id: u64,
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

    let affected = reorder_tree_in_tx(&tx, table, scope_col, &ids, operator_id).await?;
    commit_transaction(tx).await?;
    Ok(affected)
}

async fn reorder_tree_in_tx<C>(
    db: &C,
    table: &str,
    scope_col: Option<&str>,
    ids: &[u64],
    operator_id: u64,
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

    let update_ms = now_ms();
    let mut affected = 0u64;

    // 第一段：按「提交顺序」把每个兄弟子树挪到临时编码（`~` 开头，不会与合法 tree_code 冲突）
    for (index, id) in ids.iter().enumerate() {
        let code = submitted
            .get(id)
            .ok_or_else(|| invalid("排序列表与当前树结构不一致，请刷新后重试"))?;
        let temp = base36_pair(index);
        let (scope_clause, scope_values) = match (scope_col, scope_value) {
            (None, _) => ("TRUE".to_string(), Vec::new()),
            (Some(col), Some(_)) => (
                format!("{col} = $7"),
                vec![Value::BigInt(scope_value)],
            ),
            (Some(col), None) => (format!("{col} IS NULL"), Vec::new()),
        };
        let sql = format!(
            "UPDATE {table}
             SET tree_code = $1 || CASE WHEN length(tree_code) > $2 THEN substr(tree_code, $3) ELSE '' END,
                 updater_id = $4, update_ms = $5
             WHERE tree_code LIKE $6 || '%' AND {scope_clause}"
        );
        let mut values = vec![
            Value::String(Some(temp)),
            Value::Int(Some((parent.len() + 3) as i32)),
            Value::Int(Some((parent.len() + 4) as i32)),
            Value::BigInt(Some(operator_id as i64)),
            Value::BigInt(Some(update_ms as i64)),
            Value::String(Some(code.clone())),
        ];
        values.extend(scope_values);
        affected += execute(db, &sql, values).await?;
    }

    // 第二段：按提交顺序落到最终编码（补零到 3 位，1..n 连续）
    for (index, _id) in ids.iter().enumerate() {
        let final_code = format!("{parent}{:03}", index + 1);
        if final_code.len() > 30 {
            return Err(invalid("tree_code 超过 30 位，无法重排"));
        }
        let temp = base36_pair(index);
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
        affected += execute(db, &sql, values).await?;
    }

    Ok(affected)
}
