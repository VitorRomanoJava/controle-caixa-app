#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use chrono::{Datelike, NaiveDate, Utc};
use rusqlite::{params, params_from_iter, Connection, OptionalExtension};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

struct DbState {
  conn: Mutex<Connection>,
}

#[derive(serde::Serialize)]
struct MonthSummary {
  competency: String,
  opening_balance: i64,
  total_in: i64,
  total_out: i64,
  closing_balance: i64,
  is_closed: i64,
  by_category_in: Vec<CategoryTotal>,
  by_category_out: Vec<CategoryTotal>,
}

#[derive(serde::Serialize)]
struct MonthTotals {
  total_in: i64,
  total_out: i64,
  saldo: i64,
}

#[derive(serde::Serialize)]
struct MonthSettings {
  competency: String,
  opening_balance: i64,
  is_closed: i64,
}

#[derive(serde::Serialize)]
struct Transaction {
  id: String,
  r#type: String,
  date: String,
  competency: String,
  description: String,
  amount: i64,
  category: Option<String>,
  payment_method: Option<String>,
  notes: Option<String>,
  created_at: String,
  updated_at: String,
}

#[derive(serde::Serialize)]
struct CategoryTotal {
  category: String,
  total: i64,
}

#[derive(serde::Serialize)]
struct MonthGoals {
  goal_in: Option<i64>,
  goal_out: Option<i64>,
  goal_balance: Option<i64>,
}

#[derive(serde::Serialize)]
struct ExtraGoal {
  id: String,
  competency: String,
  title: String,
  kind: String,
  notes: Option<String>,
  done: i64,
  created_at: i64,
  updated_at: i64,
}

#[derive(serde::Serialize)]
struct Notification {
  id: String,
  created_at: i64,
  competency: Option<String>,
  kind: String,
  severity: String,
  title: String,
  message: String,
  read: i64,
  dedupe_key: String,
  action_target: Option<String>,
}

#[derive(serde::Deserialize)]
struct TransactionPayload {
  r#type: String,
  date: String,
  competency: String,
  description: String,
  amount: i64,
  category: Option<String>,
  payment_method: Option<String>,
  notes: Option<String>,
}

#[derive(serde::Deserialize)]
struct ExtraGoalPayload {
  id: Option<String>,
  competency: String,
  title: String,
  kind: String,
  notes: Option<String>,
  done: Option<i64>,
}

fn app_db_path(app: &AppHandle) -> Result<PathBuf, String> {
  let base_dir = app
    .path()
    .app_data_dir()
    .map_err(|err| format!("Failed to resolve app data dir: {err}"))?;
  fs::create_dir_all(&base_dir)
    .map_err(|err| format!("Failed to create app data dir: {err}"))?;
  Ok(base_dir.join("contacaixa.db"))
}

fn init_db(app: &AppHandle) -> Result<Connection, String> {
  let db_path = app_db_path(app)?;
  let mut conn =
    Connection::open(db_path).map_err(|err| format!("Failed to open DB: {err}"))?;

  conn
    .execute_batch(
      "CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        type TEXT CHECK(type IN ('IN','OUT')),
        date TEXT NOT NULL,
        competency TEXT NOT NULL,
        description TEXT NOT NULL,
        amount INTEGER NOT NULL,
        category TEXT NULL,
        payment_method TEXT NULL,
        notes TEXT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS month_settings (
        competency TEXT PRIMARY KEY,
        opening_balance INTEGER NOT NULL,
        is_closed INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS extra_goals (
        id TEXT PRIMARY KEY,
        competency TEXT NOT NULL,
        title TEXT NOT NULL,
        kind TEXT NOT NULL,
        notes TEXT NULL,
        done INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        competency TEXT NULL,
        kind TEXT NOT NULL,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        read INTEGER NOT NULL,
        dedupe_key TEXT NOT NULL UNIQUE,
        action_target TEXT NULL
      );",
    )
    .map_err(|err| format!("Failed to initialize DB schema: {err}"))?;

  conn
    .execute(
      "ALTER TABLE notifications ADD COLUMN action_target TEXT NULL",
      [],
    )
    .ok();

  migrate_goals_table(&mut conn)?;

  Ok(conn)
}

fn is_month_closed(conn: &Connection, competency: &str) -> Result<bool, String> {
  let value: Option<i64> = conn
    .query_row(
      "SELECT is_closed FROM month_settings WHERE competency = ?1",
      params![competency],
      |row| row.get(0),
    )
    .optional()
    .map_err(|err| format!("Failed to read month status: {err}"))?;

  Ok(value.unwrap_or(0) == 1)
}

fn get_setting_value(conn: &Connection, key: &str) -> Result<Option<String>, String> {
  conn
    .query_row(
      "SELECT value FROM settings WHERE key = ?1",
      params![key],
      |row| row.get(0),
    )
    .optional()
    .map_err(|err| format!("Failed to read setting: {err}"))
}

fn set_setting_value(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
  conn
    .execute(
      "INSERT INTO settings (key, value)
       VALUES (?1, ?2)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      params![key, value],
    )
    .map_err(|err| format!("Failed to save setting: {err}"))?;
  Ok(())
}

fn notifications_enabled(conn: &Connection) -> Result<bool, String> {
  let value = get_setting_value(conn, "notifications_enabled")?;
  Ok(value.map(|v| v == "true").unwrap_or(true))
}

fn format_cents(value: i64) -> String {
  let abs = value.abs();
  let reais = abs / 100;
  let cents = abs % 100;
  let mut chars: Vec<char> = reais.to_string().chars().collect();
  let mut formatted = String::new();
  while !chars.is_empty() {
    let chunk: String = chars
      .split_off(chars.len().saturating_sub(3))
      .into_iter()
      .collect();
    if formatted.is_empty() {
      formatted = chunk;
    } else {
      formatted = format!("{chunk}.{formatted}");
    }
  }
  format!("R$ {},{:02}", formatted, cents)
}

fn insert_notification_if_new(
  conn: &Connection,
  notification: &Notification,
) -> Result<Option<Notification>, String> {
  let exists: Option<i64> = conn
    .query_row(
      "SELECT 1 FROM notifications WHERE dedupe_key = ?1",
      params![notification.dedupe_key],
      |row| row.get(0),
    )
    .optional()
    .map_err(|err| format!("Failed to check notification: {err}"))?;

  if exists.is_some() {
    return Ok(None);
  }

  conn
    .execute(
      "INSERT INTO notifications (id, created_at, competency, kind, severity, title, message, read, dedupe_key, action_target)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
      params![
        notification.id,
        notification.created_at,
        notification.competency,
        notification.kind,
        notification.severity,
        notification.title,
        notification.message,
        notification.read,
        notification.dedupe_key,
        notification.action_target
      ],
    )
    .map_err(|err| format!("Failed to insert notification: {err}"))?;

  Ok(Some(Notification {
    id: notification.id.clone(),
    created_at: notification.created_at,
    competency: notification.competency.clone(),
    kind: notification.kind.clone(),
    severity: notification.severity.clone(),
    title: notification.title.clone(),
    message: notification.message.clone(),
    read: notification.read,
    dedupe_key: notification.dedupe_key.clone(),
    action_target: notification.action_target.clone(),
  }))
}

fn migrate_goals_table(conn: &mut Connection) -> Result<(), String> {
  let table_exists: Option<String> = conn
    .query_row(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='goals'",
      [],
      |row| row.get(0),
    )
    .optional()
    .map_err(|err| format!("Failed to check goals table: {err}"))?;

  if table_exists.is_none() {
    conn
      .execute_batch(
        "CREATE TABLE IF NOT EXISTS goals (
          id TEXT PRIMARY KEY,
          competency TEXT NOT NULL,
          goal_type TEXT NOT NULL,
          target_cents INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          UNIQUE(competency, goal_type)
        );",
      )
      .map_err(|err| format!("Failed to create goals table: {err}"))?;
    return Ok(());
  }

  let has_legacy_columns = conn
    .prepare("PRAGMA table_info(goals)")
    .and_then(|mut stmt| {
      let rows = stmt.query_map([], |row| row.get::<_, String>(1))?;
      let columns = rows.collect::<Result<Vec<_>, _>>()?;
      Ok(columns.iter().any(|name| name == "goal_note" || name == "goal_metric"))
    })
    .map_err(|err| format!("Failed to inspect goals table: {err}"))?;

  if !has_legacy_columns {
    return Ok(());
  }

  let now = Utc::now().timestamp();

  let tx = conn
    .transaction()
    .map_err(|err| format!("Failed to start migration: {err}"))?;

  tx.execute_batch(
    "CREATE TABLE IF NOT EXISTS goals_new (
      id TEXT PRIMARY KEY,
      competency TEXT NOT NULL,
      goal_type TEXT NOT NULL,
      target_cents INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(competency, goal_type)
    );",
  )
  .map_err(|err| format!("Failed to create goals_new table: {err}"))?;

  tx.execute(
    "INSERT INTO goals_new (id, competency, goal_type, target_cents, created_at, updated_at)
     SELECT id, competency, goal_type, target_cents, ?1, ?1 FROM goals",
    params![now],
  )
  .map_err(|err| format!("Failed to migrate goals data: {err}"))?;

  tx.execute("DROP TABLE goals", [])
    .map_err(|err| format!("Failed to drop old goals table: {err}"))?;
  tx.execute("ALTER TABLE goals_new RENAME TO goals", [])
    .map_err(|err| format!("Failed to rename goals table: {err}"))?;

  tx.commit()
    .map_err(|err| format!("Failed to commit goals migration: {err}"))?;

  Ok(())
}

fn validate_extra_goal_kind(kind: &str) -> Result<(), String> {
  if kind != "general" && kind != "in" && kind != "out" {
    return Err("Invalid extra goal kind. Use general, in, or out.".to_string());
  }
  Ok(())
}

fn get_summary_for(conn: &Connection, competency: &str) -> Result<MonthSummary, String> {
  let settings: Option<(i64, i64)> = conn
    .query_row(
      "SELECT opening_balance, is_closed FROM month_settings WHERE competency = ?1",
      params![competency],
      |row| Ok((row.get(0)?, row.get(1)?)),
    )
    .optional()
    .map_err(|err| format!("Failed to read month settings: {err}"))?;

  let (opening_balance, is_closed) = settings.unwrap_or((0, 0));

  let total_in: i64 = conn
    .query_row(
      "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE competency = ?1 AND type = 'IN'",
      params![competency],
      |row| row.get(0),
    )
    .map_err(|err| format!("Failed to calculate entries: {err}"))?;

  let total_out: i64 = conn
    .query_row(
      "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE competency = ?1 AND type = 'OUT'",
      params![competency],
      |row| row.get(0),
    )
    .map_err(|err| format!("Failed to calculate exits: {err}"))?;

  let closing_balance = opening_balance + total_in - total_out;

  let by_category_in = get_category_totals(conn, competency, "IN")?;
  let by_category_out = get_category_totals(conn, competency, "OUT")?;

  Ok(MonthSummary {
    competency: competency.to_string(),
    opening_balance,
    total_in,
    total_out,
    closing_balance,
    is_closed,
    by_category_in,
    by_category_out,
  })
}

fn get_month_totals_for(conn: &Connection, competency: &str) -> Result<MonthTotals, String> {
  let summary = get_summary_for(conn, competency)?;
  Ok(MonthTotals {
    total_in: summary.total_in,
    total_out: summary.total_out,
    saldo: summary.closing_balance,
  })
}

fn get_category_totals(
  conn: &Connection,
  competency: &str,
  r#type: &str,
) -> Result<Vec<CategoryTotal>, String> {
  let mut stmt = conn
    .prepare(
      "SELECT COALESCE(category, 'Sem categoria') as category, COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE competency = ?1 AND type = ?2
       GROUP BY COALESCE(category, 'Sem categoria')",
    )
    .map_err(|err| format!("Failed to prepare category totals: {err}"))?;

  let rows = stmt
    .query_map(params![competency, r#type], |row| {
      Ok(CategoryTotal {
        category: row.get(0)?,
        total: row.get(1)?,
      })
    })
    .map_err(|err| format!("Failed to read category totals: {err}"))?;

  rows
    .collect::<Result<Vec<CategoryTotal>, _>>()
    .map_err(|err| format!("Failed to parse category totals: {err}"))
}
fn next_competency(value: &str) -> Result<String, String> {
  let parts: Vec<&str> = value.split('-').collect();
  if parts.len() != 2 {
    return Err("Invalid competency format. Use YYYY-MM.".to_string());
  }
  let year: i32 = parts[0]
    .parse()
    .map_err(|_| "Invalid competency year.".to_string())?;
  let month: i32 = parts[1]
    .parse()
    .map_err(|_| "Invalid competency month.".to_string())?;

  if !(1..=12).contains(&month) {
    return Err("Invalid competency month.".to_string());
  }

  let (next_year, next_month) = if month == 12 {
    (year + 1, 1)
  } else {
    (year, month + 1)
  };

  Ok(format!("{next_year}-{:02}", next_month))
}

fn prev_competency(value: &str) -> Result<String, String> {
  let parts: Vec<&str> = value.split('-').collect();
  if parts.len() != 2 {
    return Err("Invalid competency format. Use YYYY-MM.".to_string());
  }
  let year: i32 = parts[0]
    .parse()
    .map_err(|_| "Invalid competency year.".to_string())?;
  let month: i32 = parts[1]
    .parse()
    .map_err(|_| "Invalid competency month.".to_string())?;

  if !(1..=12).contains(&month) {
    return Err("Invalid competency month.".to_string());
  }

  let (prev_year, prev_month) = if month == 1 {
    (year - 1, 12)
  } else {
    (year, month - 1)
  };

  Ok(format!("{prev_year}-{:02}", prev_month))
}

#[tauri::command]
fn list_months(state: State<DbState>) -> Result<Vec<String>, String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "Database lock poisoned.".to_string())?;

  let mut stmt = conn
    .prepare(
      "SELECT competency FROM month_settings
       UNION
       SELECT DISTINCT competency FROM transactions
       ORDER BY competency DESC",
    )
    .map_err(|err| format!("Failed to list months: {err}"))?;

  let months = stmt
    .query_map([], |row| row.get::<_, String>(0))
    .map_err(|err| format!("Failed to read months: {err}"))?
    .collect::<Result<Vec<String>, _>>()
    .map_err(|err| format!("Failed to parse months: {err}"))?;

  Ok(months)
}

#[tauri::command]
fn get_month_summary(
  state: State<DbState>,
  competency: String,
) -> Result<MonthSummary, String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "Database lock poisoned.".to_string())?;
  get_summary_for(&conn, &competency)
}

#[tauri::command]
fn list_transactions(
  state: State<DbState>,
  competency: String,
  r#type: Option<String>,
  search: Option<String>,
  from_date: Option<String>,
  to_date: Option<String>,
) -> Result<Vec<Transaction>, String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "Database lock poisoned.".to_string())?;

  let mut sql = String::from(
    "SELECT id, type, date, competency, description, amount, category, payment_method, notes, created_at, updated_at
     FROM transactions WHERE competency = ?",
  );

  let mut params_list: Vec<rusqlite::types::Value> = vec![competency.clone().into()];

  if let Some(tx_type) = r#type {
    sql.push_str(" AND type = ?");
    params_list.push(tx_type.into());
  }

  if let Some(query) = search {
    sql.push_str(" AND (description LIKE ? OR category LIKE ? OR payment_method LIKE ? OR notes LIKE ?)");
    let pattern = format!("%{}%", query);
    for _ in 0..4 {
      params_list.push(pattern.clone().into());
    }
  }

  if let Some(from) = from_date {
    sql.push_str(" AND date >= ?");
    params_list.push(from.into());
  }

  if let Some(to) = to_date {
    sql.push_str(" AND date <= ?");
    params_list.push(to.into());
  }

  sql.push_str(" ORDER BY date DESC, created_at DESC");

  let mut stmt = conn
    .prepare(&sql)
    .map_err(|err| format!("Failed to prepare transaction query: {err}"))?;

  let rows = stmt
    .query_map(params_from_iter(params_list), |row| {
      Ok(Transaction {
        id: row.get(0)?,
        r#type: row.get(1)?,
        date: row.get(2)?,
        competency: row.get(3)?,
        description: row.get(4)?,
        amount: row.get(5)?,
        category: row.get(6)?,
        payment_method: row.get(7)?,
        notes: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
      })
    })
    .map_err(|err| format!("Failed to list transactions: {err}"))?;

  let transactions = rows
    .collect::<Result<Vec<Transaction>, _>>()
    .map_err(|err| format!("Failed to parse transactions: {err}"))?;

  Ok(transactions)
}

#[tauri::command]
fn create_transaction(
  state: State<DbState>,
  payload: TransactionPayload,
) -> Result<Transaction, String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "Database lock poisoned.".to_string())?;

  if payload.r#type != "IN" && payload.r#type != "OUT" {
    return Err("Invalid transaction type. Use IN or OUT.".to_string());
  }

  if payload.amount <= 0 {
    return Err("Amount must be greater than zero.".to_string());
  }

  if is_month_closed(&conn, &payload.competency)? {
    return Err("Month is closed. Cannot add transactions.".to_string());
  }

  let now = Utc::now().to_rfc3339();
  let id = Uuid::new_v4().to_string();

  conn
    .execute(
      "INSERT INTO transactions (id, type, date, competency, description, amount, category, payment_method, notes, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
      params![
        id,
        payload.r#type,
        payload.date,
        payload.competency,
        payload.description,
        payload.amount,
        payload.category,
        payload.payment_method,
        payload.notes,
        now,
        now
      ],
    )
    .map_err(|err| format!("Failed to create transaction: {err}"))?;

  Ok(Transaction {
    id,
    r#type: payload.r#type,
    date: payload.date,
    competency: payload.competency,
    description: payload.description,
    amount: payload.amount,
    category: payload.category,
    payment_method: payload.payment_method,
    notes: payload.notes,
    created_at: now.clone(),
    updated_at: now,
  })
}

#[tauri::command]
fn update_transaction(
  state: State<DbState>,
  id: String,
  payload: TransactionPayload,
) -> Result<Transaction, String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "Database lock poisoned.".to_string())?;

  let existing: Option<(String, String)> = conn
    .query_row(
      "SELECT competency, created_at FROM transactions WHERE id = ?1",
      params![id],
      |row| Ok((row.get(0)?, row.get(1)?)),
    )
    .optional()
    .map_err(|err| format!("Failed to read transaction: {err}"))?;

  let (existing_competency, created_at) = existing
    .ok_or_else(|| "Transaction not found.".to_string())?;

  if payload.r#type != "IN" && payload.r#type != "OUT" {
    return Err("Invalid transaction type. Use IN or OUT.".to_string());
  }

  if payload.amount <= 0 {
    return Err("Amount must be greater than zero.".to_string());
  }

  if is_month_closed(&conn, &existing_competency)? || is_month_closed(&conn, &payload.competency)? {
    return Err("Month is closed. Cannot update transactions.".to_string());
  }

  let now = Utc::now().to_rfc3339();

  conn
    .execute(
      "UPDATE transactions
       SET type = ?1, date = ?2, competency = ?3, description = ?4, amount = ?5, category = ?6, payment_method = ?7, notes = ?8, updated_at = ?9
       WHERE id = ?10",
      params![
        payload.r#type,
        payload.date,
        payload.competency,
        payload.description,
        payload.amount,
        payload.category,
        payload.payment_method,
        payload.notes,
        now,
        id
      ],
    )
    .map_err(|err| format!("Failed to update transaction: {err}"))?;

  Ok(Transaction {
    id,
    r#type: payload.r#type,
    date: payload.date,
    competency: payload.competency,
    description: payload.description,
    amount: payload.amount,
    category: payload.category,
    payment_method: payload.payment_method,
    notes: payload.notes,
    created_at,
    updated_at: now,
  })
}

#[tauri::command]
fn delete_transaction(state: State<DbState>, id: String) -> Result<(), String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "Database lock poisoned.".to_string())?;

  let competency: Option<String> = conn
    .query_row(
      "SELECT competency FROM transactions WHERE id = ?1",
      params![id],
      |row| row.get(0),
    )
    .optional()
    .map_err(|err| format!("Failed to read transaction: {err}"))?;

  let competency = competency
    .ok_or_else(|| "Transaction not found.".to_string())?;

  if is_month_closed(&conn, &competency)? {
    return Err("Month is closed. Cannot delete transactions.".to_string());
  }

  conn
    .execute("DELETE FROM transactions WHERE id = ?1", params![id])
    .map_err(|err| format!("Failed to delete transaction: {err}"))?;

  Ok(())
}

#[tauri::command]
fn get_month_settings(
  state: State<DbState>,
  competency: String,
) -> Result<MonthSettings, String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "Database lock poisoned.".to_string())?;

  let settings: Option<(i64, i64)> = conn
    .query_row(
      "SELECT opening_balance, is_closed FROM month_settings WHERE competency = ?1",
      params![competency],
      |row| Ok((row.get(0)?, row.get(1)?)),
    )
    .optional()
    .map_err(|err| format!("Failed to read month settings: {err}"))?;

  let (opening_balance, is_closed) = settings.unwrap_or((0, 0));

  Ok(MonthSettings {
    competency,
    opening_balance,
    is_closed,
  })
}

#[tauri::command]
fn set_opening_balance(
  state: State<DbState>,
  competency: String,
  opening_balance: i64,
) -> Result<MonthSettings, String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "Database lock poisoned.".to_string())?;

  conn
    .execute(
      "INSERT INTO month_settings (competency, opening_balance, is_closed)
       VALUES (?1, ?2, COALESCE((SELECT is_closed FROM month_settings WHERE competency = ?1), 0))
       ON CONFLICT(competency) DO UPDATE SET opening_balance = excluded.opening_balance",
      params![competency, opening_balance],
    )
    .map_err(|err| format!("Failed to set opening balance: {err}"))?;

  let settings: Option<(i64, i64)> = conn
    .query_row(
      "SELECT opening_balance, is_closed FROM month_settings WHERE competency = ?1",
      params![competency],
      |row| Ok((row.get(0)?, row.get(1)?)),
    )
    .optional()
    .map_err(|err| format!("Failed to read month settings: {err}"))?;

  let (opening_balance, is_closed) = settings.unwrap_or((opening_balance, 0));

  Ok(MonthSettings {
    competency,
    opening_balance,
    is_closed,
  })
}

#[tauri::command]
fn close_month(state: State<DbState>, competency: String) -> Result<MonthSummary, String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "Database lock poisoned.".to_string())?;

  if is_month_closed(&conn, &competency)? {
    return Err("Month already closed.".to_string());
  }

  let mut summary = get_summary_for(&conn, &competency)?;

  conn
    .execute(
      "INSERT INTO month_settings (competency, opening_balance, is_closed)
       VALUES (?1, ?2, 1)
       ON CONFLICT(competency) DO UPDATE SET is_closed = 1",
      params![competency, summary.opening_balance],
    )
    .map_err(|err| format!("Failed to close month: {err}"))?;

  summary.is_closed = 1;

  let next_competency = next_competency(&competency)?;

  let next_is_closed = is_month_closed(&conn, &next_competency)?;
  if next_is_closed {
    return Err("Next month is already closed.".to_string());
  }

  conn
    .execute(
      "INSERT INTO month_settings (competency, opening_balance, is_closed)
       VALUES (?1, ?2, 0)
       ON CONFLICT(competency) DO UPDATE SET opening_balance = excluded.opening_balance",
      params![next_competency, summary.closing_balance],
    )
    .map_err(|err| format!("Failed to create next month settings: {err}"))?;

  Ok(summary)
}

#[tauri::command]
fn get_goals_for_month(
  state: State<DbState>,
  competency: String,
) -> Result<MonthGoals, String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "Database lock poisoned.".to_string())?;

  let mut goals = MonthGoals {
    goal_in: None,
    goal_out: None,
    goal_balance: None,
  };

  let mut stmt = conn
    .prepare(
      "SELECT goal_type, target_cents FROM goals WHERE competency = ?1",
    )
    .map_err(|err| format!("Failed to read goals: {err}"))?;

  let rows = stmt
    .query_map(params![competency], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)))
    .map_err(|err| format!("Failed to read goals: {err}"))?;

  for row in rows {
    let (goal_type, target) =
      row.map_err(|err| format!("Failed to parse goals: {err}"))?;
    match goal_type.as_str() {
      "in" => goals.goal_in = Some(target),
      "out" => goals.goal_out = Some(target),
      "balance" => goals.goal_balance = Some(target),
      _ => {}
    }
  }

  Ok(goals)
}

#[tauri::command]
fn upsert_goal(
  state: State<DbState>,
  competency: String,
  goal_type: String,
  target_cents: i64,
) -> Result<(), String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "Database lock poisoned.".to_string())?;

  if goal_type != "in" && goal_type != "out" && goal_type != "balance" {
    return Err("Invalid goal type. Use in, out, or balance.".to_string());
  }

  if target_cents <= 0 {
    return Err("Target must be greater than zero.".to_string());
  }

  let now = Utc::now().timestamp();
  let id = Uuid::new_v4().to_string();

  conn
    .execute(
      "INSERT INTO goals (id, competency, goal_type, target_cents, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT(competency, goal_type) DO UPDATE SET target_cents = excluded.target_cents, updated_at = excluded.updated_at",
      params![id, competency, goal_type, target_cents, now, now],
    )
    .map_err(|err| format!("Failed to save goal: {err}"))?;

  Ok(())
}

#[tauri::command]
fn delete_goal(
  state: State<DbState>,
  competency: String,
  goal_type: String,
) -> Result<(), String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "Database lock poisoned.".to_string())?;

  conn
    .execute(
      "DELETE FROM goals WHERE competency = ?1 AND goal_type = ?2",
      params![competency, goal_type],
    )
    .map_err(|err| format!("Failed to delete goal: {err}"))?;

  Ok(())
}

#[tauri::command]
fn delete_goals_for_month(
  state: State<DbState>,
  competency: String,
) -> Result<(), String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "Database lock poisoned.".to_string())?;

  conn
    .execute("DELETE FROM goals WHERE competency = ?1", params![competency])
    .map_err(|err| format!("Failed to delete goals: {err}"))?;

  Ok(())
}

#[tauri::command]
fn get_setting(state: State<DbState>, key: String) -> Result<Option<String>, String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "Database lock poisoned.".to_string())?;
  get_setting_value(&conn, &key)
}

#[tauri::command]
fn set_setting(state: State<DbState>, key: String, value: String) -> Result<(), String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "Database lock poisoned.".to_string())?;
  set_setting_value(&conn, &key, &value)
}

#[tauri::command]
fn list_notifications(
  state: State<DbState>,
  only_unread: Option<bool>,
  limit: Option<i64>,
) -> Result<Vec<Notification>, String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "Database lock poisoned.".to_string())?;

  let mut sql = String::from(
    "SELECT id, created_at, competency, kind, severity, title, message, read, dedupe_key, action_target
     FROM notifications",
  );

  if only_unread.unwrap_or(false) {
    sql.push_str(" WHERE read = 0");
  }

  sql.push_str(" ORDER BY created_at DESC");

  if let Some(limit_value) = limit {
    sql.push_str(" LIMIT ");
    sql.push_str(&limit_value.to_string());
  }

  let mut stmt = conn
    .prepare(&sql)
    .map_err(|err| format!("Failed to read notifications: {err}"))?;

  let items = stmt
    .query_map([], |row| {
      Ok(Notification {
        id: row.get(0)?,
        created_at: row.get(1)?,
        competency: row.get(2)?,
        kind: row.get(3)?,
        severity: row.get(4)?,
        title: row.get(5)?,
        message: row.get(6)?,
        read: row.get(7)?,
        dedupe_key: row.get(8)?,
        action_target: row.get(9)?,
      })
    })
    .map_err(|err| format!("Failed to read notifications: {err}"))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|err| format!("Failed to parse notifications: {err}"))?;

  Ok(items)
}

#[tauri::command]
fn mark_notification_read(state: State<DbState>, id: String) -> Result<(), String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "Database lock poisoned.".to_string())?;

  conn
    .execute(
      "UPDATE notifications SET read = 1 WHERE id = ?1",
      params![id],
    )
    .map_err(|err| format!("Failed to update notification: {err}"))?;

  Ok(())
}

#[tauri::command]
fn mark_all_read(state: State<DbState>) -> Result<(), String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "Database lock poisoned.".to_string())?;

  conn
    .execute("UPDATE notifications SET read = 1", [])
    .map_err(|err| format!("Failed to mark notifications: {err}"))?;

  Ok(())
}

#[tauri::command]
fn clear_notifications(state: State<DbState>) -> Result<(), String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "Database lock poisoned.".to_string())?;

  conn
    .execute("DELETE FROM notifications", [])
    .map_err(|err| format!("Failed to clear notifications: {err}"))?;

  Ok(())
}

#[tauri::command]
fn delete_notification(state: State<DbState>, id: String) -> Result<(), String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "Database lock poisoned.".to_string())?;

  conn
    .execute("DELETE FROM notifications WHERE id = ?1", params![id])
    .map_err(|err| format!("Failed to delete notification: {err}"))?;

  Ok(())
}

#[tauri::command]
fn get_unread_count(state: State<DbState>) -> Result<i64, String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "Database lock poisoned.".to_string())?;

  conn
    .query_row(
      "SELECT COUNT(*) FROM notifications WHERE read = 0",
      [],
      |row| row.get(0),
    )
    .map_err(|err| format!("Failed to count notifications: {err}"))
}

fn days_in_month(year: i32, month: u32) -> Result<i64, String> {
  let first = NaiveDate::from_ymd_opt(year, month, 1)
    .ok_or_else(|| "Invalid competency date.".to_string())?;
  let (next_year, next_month) = if month == 12 {
    (year + 1, 1)
  } else {
    (year, month + 1)
  };
  let next = NaiveDate::from_ymd_opt(next_year, next_month, 1)
    .ok_or_else(|| "Invalid competency date.".to_string())?;
  Ok((next - first).num_days())
}

fn parse_competency_date(competency: &str) -> Result<NaiveDate, String> {
  let parts: Vec<&str> = competency.split('-').collect();
  if parts.len() != 2 {
    return Err("Invalid competency format. Use YYYY-MM.".to_string());
  }
  let year: i32 = parts[0]
    .parse()
    .map_err(|_| "Invalid competency year.".to_string())?;
  let month: u32 = parts[1]
    .parse()
    .map_err(|_| "Invalid competency month.".to_string())?;
  NaiveDate::from_ymd_opt(year, month, 1)
    .ok_or_else(|| "Invalid competency date.".to_string())
}

fn read_goal_targets(conn: &Connection, competency: &str) -> Result<MonthGoals, String> {
  let mut goals = MonthGoals {
    goal_in: None,
    goal_out: None,
    goal_balance: None,
  };

  let mut stmt = conn
    .prepare("SELECT goal_type, target_cents FROM goals WHERE competency = ?1")
    .map_err(|err| format!("Failed to read goals: {err}"))?;

  let rows = stmt
    .query_map(params![competency], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)))
    .map_err(|err| format!("Failed to read goals: {err}"))?;

  for row in rows {
    let (goal_type, target) =
      row.map_err(|err| format!("Failed to parse goals: {err}"))?;
    match goal_type.as_str() {
      "in" => goals.goal_in = Some(target),
      "out" => goals.goal_out = Some(target),
      "balance" => goals.goal_balance = Some(target),
      _ => {}
    }
  }

  Ok(goals)
}

#[tauri::command]
fn run_notifications_check(
  state: State<DbState>,
  competency: String,
) -> Result<Vec<Notification>, String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "Database lock poisoned.".to_string())?;

  if !notifications_enabled(&conn)? {
    return Ok(vec![]);
  }

  let today = Utc::now().date_naive();
  let today_key = today.format("%Y-%m-%d").to_string();
  let now = Utc::now().timestamp();
  let mut created: Vec<Notification> = Vec::new();

  let base_date = parse_competency_date(&competency)?;
  let days_total = days_in_month(base_date.year(), base_date.month())?;
  let is_same_month = today.year() == base_date.year() && today.month() == base_date.month();
  let is_first_day = is_same_month && today.day() == 1;
  let is_last_day = is_same_month && today.day() as i64 == days_total;

  if is_first_day && created.len() < 3 {
    let notification = Notification {
      id: Uuid::new_v4().to_string(),
      created_at: now,
      competency: Some(competency.clone()),
      kind: "month_start".to_string(),
      severity: "info".to_string(),
      title: "Comece o mês com o pé direito".to_string(),
      message: "Que tal começar o mês definindo suas metas? Ainda dá tempo!"
        .to_string(),
      read: 0,
      dedupe_key: format!("month_start:{competency}"),
      action_target: Some("/metas".to_string()),
    };
    if let Some(item) = insert_notification_if_new(&conn, &notification)? {
      created.push(item);
    }
  }

  if is_last_day && created.len() < 3 {
    let notification = Notification {
      id: Uuid::new_v4().to_string(),
      created_at: now,
      competency: Some(competency.clone()),
      kind: "month_end".to_string(),
      severity: "info".to_string(),
      title: "Fechamento do mês".to_string(),
      message: "Veja seu relatório desse mês! Ver relatório.".to_string(),
      read: 0,
      dedupe_key: format!("month_end:{competency}"),
      action_target: Some(format!("/relatorios?mes={competency}")),
    };
    if let Some(item) = insert_notification_if_new(&conn, &notification)? {
      created.push(item);
    }
  }

  let goals = read_goal_targets(&conn, &competency)?;
  let summary = get_summary_for(&conn, &competency)?;

  if let Some(meta_in) = goals.goal_in {
    if created.len() < 3 && summary.total_in >= meta_in {
      let notification = Notification {
        id: Uuid::new_v4().to_string(),
        created_at: now,
        competency: Some(competency.clone()),
        kind: "income_hit".to_string(),
        severity: "success".to_string(),
        title: "Meta de entradas batida!".to_string(),
        message: format!(
          "Parabéns! Você chegou em {} de {}. Continue nessa pegada!",
          format_cents(summary.total_in),
          format_cents(meta_in)
        ),
        read: 0,
        dedupe_key: format!("income_hit:{competency}:{today_key}"),
        action_target: None,
      };
      if let Some(item) = insert_notification_if_new(&conn, &notification)? {
        created.push(item);
      }
    } else if created.len() < 3 && summary.total_in > 0 {
      let notification = Notification {
        id: Uuid::new_v4().to_string(),
        created_at: now,
        competency: Some(competency.clone()),
        kind: "income_progress".to_string(),
        severity: "success".to_string(),
        title: "Boa! Entradas no caminho".to_string(),
        message: "Você já começou a somar entradas. Continue assim que a meta chega!"
          .to_string(),
        read: 0,
        dedupe_key: format!("income_progress:{competency}:{today_key}"),
        action_target: None,
      };
      if let Some(item) = insert_notification_if_new(&conn, &notification)? {
        created.push(item);
      }
    }
  }

  if let Some(meta_out) = goals.goal_out {
    if created.len() < 3 && summary.total_out > meta_out {
      let notification = Notification {
        id: Uuid::new_v4().to_string(),
        created_at: now,
        competency: Some(competency.clone()),
        kind: "spend_over".to_string(),
        severity: "danger".to_string(),
        title: "Opa, passou do limite".to_string(),
        message: format!(
          "Seus gastos chegaram em {} e o limite é {}. Vamos ajustar o ritmo?",
          format_cents(summary.total_out),
          format_cents(meta_out)
        ),
        read: 0,
        dedupe_key: format!("spend_over:{competency}:{today_key}"),
        action_target: None,
      };
      if let Some(item) = insert_notification_if_new(&conn, &notification)? {
        created.push(item);
      }
    } else if created.len() < 3
      && summary.total_out >= (meta_out * 80 / 100)
      && summary.total_out <= meta_out
    {
      let percent = (summary.total_out as f64 / meta_out as f64) * 100.0;
      let notification = Notification {
        id: Uuid::new_v4().to_string(),
        created_at: now,
        competency: Some(competency.clone()),
        kind: "spend_warn".to_string(),
        severity: "warn".to_string(),
        title: "Atenção ao limite de gastos".to_string(),
        message: format!(
          "Você já usou {:.0}% do limite deste mês. Está perto, mas dá para segurar!",
          percent
        ),
        read: 0,
        dedupe_key: format!("spend_warn:{competency}:{today_key}"),
        action_target: None,
      };
      if let Some(item) = insert_notification_if_new(&conn, &notification)? {
        created.push(item);
      }
    } else if created.len() < 3 && summary.total_out > 0 {
      let notification = Notification {
        id: Uuid::new_v4().to_string(),
        created_at: now,
        competency: Some(competency.clone()),
        kind: "spend_progress".to_string(),
        severity: "info".to_string(),
        title: "Gastos sob controle".to_string(),
        message:
          "Seus gastos estão acontecendo dentro do esperado. Continue assim!".to_string(),
        read: 0,
        dedupe_key: format!("spend_progress:{competency}:{today_key}"),
        action_target: None,
      };
      if let Some(item) = insert_notification_if_new(&conn, &notification)? {
        created.push(item);
      }
    }
  }

  if let Some(meta_balance) = goals.goal_balance {
    if created.len() < 3 && summary.closing_balance >= meta_balance {
      let notification = Notification {
        id: Uuid::new_v4().to_string(),
        created_at: now,
        competency: Some(competency.clone()),
        kind: "balance_hit".to_string(),
        severity: "success".to_string(),
        title: "Saldo batendo a meta!".to_string(),
        message: "Seu saldo já chegou na meta. Excelente trabalho!".to_string(),
        read: 0,
        dedupe_key: format!("balance_hit:{competency}:{today_key}"),
        action_target: None,
      };
      if let Some(item) = insert_notification_if_new(&conn, &notification)? {
        created.push(item);
      }
    } else if created.len() < 3 && summary.closing_balance > 0 {
      let notification = Notification {
        id: Uuid::new_v4().to_string(),
        created_at: now,
        competency: Some(competency.clone()),
        kind: "balance_progress".to_string(),
        severity: "success".to_string(),
        title: "Saldo no caminho certo".to_string(),
        message:
          "Seu saldo está evoluindo bem. Continue nessa linha para bater a meta."
            .to_string(),
        read: 0,
        dedupe_key: format!("balance_progress:{competency}:{today_key}"),
        action_target: None,
      };
      if let Some(item) = insert_notification_if_new(&conn, &notification)? {
        created.push(item);
      }
    }
  }

  Ok(created)
}

#[tauri::command]
fn list_extra_goals(
  state: State<DbState>,
  competency: String,
) -> Result<Vec<ExtraGoal>, String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "Database lock poisoned.".to_string())?;

  let mut stmt = conn
    .prepare(
      "SELECT id, competency, title, kind, notes, done, created_at, updated_at
       FROM extra_goals
       WHERE competency = ?1
       ORDER BY done ASC, created_at DESC",
    )
    .map_err(|err| format!("Failed to prepare extra goals query: {err}"))?;

  let goals = stmt
    .query_map(params![competency], |row| {
      Ok(ExtraGoal {
        id: row.get(0)?,
        competency: row.get(1)?,
        title: row.get(2)?,
        kind: row.get(3)?,
        notes: row.get(4)?,
        done: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
      })
    })
    .map_err(|err| format!("Failed to read extra goals: {err}"))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|err| format!("Failed to parse extra goals: {err}"))?;

  Ok(goals)
}

#[tauri::command]
fn create_extra_goal(
  state: State<DbState>,
  payload: ExtraGoalPayload,
) -> Result<ExtraGoal, String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "Database lock poisoned.".to_string())?;

  if payload.title.trim().is_empty() {
    return Err("Title is required.".to_string());
  }
  validate_extra_goal_kind(&payload.kind)?;

  let now = Utc::now().timestamp();
  let id = payload
    .id
    .unwrap_or_else(|| Uuid::new_v4().to_string());
  let done = if payload.done.unwrap_or(0) == 1 { 1 } else { 0 };

  conn
    .execute(
      "INSERT INTO extra_goals (id, competency, title, kind, notes, done, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
      params![
        id,
        payload.competency,
        payload.title.trim(),
        payload.kind,
        payload.notes,
        done,
        now,
        now
      ],
    )
    .map_err(|err| format!("Failed to create extra goal: {err}"))?;

  Ok(ExtraGoal {
    id,
    competency: payload.competency,
    title: payload.title.trim().to_string(),
    kind: payload.kind,
    notes: payload.notes,
    done,
    created_at: now,
    updated_at: now,
  })
}

#[tauri::command]
fn update_extra_goal(
  state: State<DbState>,
  payload: ExtraGoalPayload,
) -> Result<ExtraGoal, String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "Database lock poisoned.".to_string())?;

  let id = payload
    .id
    .ok_or_else(|| "Extra goal id is required.".to_string())?;

  if payload.title.trim().is_empty() {
    return Err("Title is required.".to_string());
  }
  validate_extra_goal_kind(&payload.kind)?;

  let now = Utc::now().timestamp();
  let done = if payload.done.unwrap_or(0) == 1 { 1 } else { 0 };

  let rows = conn
    .execute(
      "UPDATE extra_goals
       SET competency = ?1, title = ?2, kind = ?3, notes = ?4, done = ?5, updated_at = ?6
       WHERE id = ?7",
      params![
        payload.competency,
        payload.title.trim(),
        payload.kind,
        payload.notes,
        done,
        now,
        id
      ],
    )
    .map_err(|err| format!("Failed to update extra goal: {err}"))?;

  if rows == 0 {
    return Err("Extra goal not found.".to_string());
  }

  let goal = conn
    .query_row(
      "SELECT id, competency, title, kind, notes, done, created_at, updated_at FROM extra_goals WHERE id = ?1",
      params![id],
      |row| {
        Ok(ExtraGoal {
          id: row.get(0)?,
          competency: row.get(1)?,
          title: row.get(2)?,
          kind: row.get(3)?,
          notes: row.get(4)?,
          done: row.get(5)?,
          created_at: row.get(6)?,
          updated_at: row.get(7)?,
        })
      },
    )
    .map_err(|err| format!("Failed to read extra goal: {err}"))?;

  Ok(goal)
}

#[tauri::command]
fn delete_extra_goal(state: State<DbState>, id: String) -> Result<(), String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "Database lock poisoned.".to_string())?;

  conn
    .execute("DELETE FROM extra_goals WHERE id = ?1", params![id])
    .map_err(|err| format!("Failed to delete extra goal: {err}"))?;

  Ok(())
}

#[tauri::command]
fn toggle_extra_goal_done(
  state: State<DbState>,
  id: String,
  done: i64,
) -> Result<ExtraGoal, String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "Database lock poisoned.".to_string())?;

  let now = Utc::now().timestamp();
  let done_value = if done == 1 { 1 } else { 0 };

  let rows = conn
    .execute(
      "UPDATE extra_goals SET done = ?1, updated_at = ?2 WHERE id = ?3",
      params![done_value, now, id],
    )
    .map_err(|err| format!("Failed to update extra goal: {err}"))?;

  if rows == 0 {
    return Err("Extra goal not found.".to_string());
  }

  let goal = conn
    .query_row(
      "SELECT id, competency, title, kind, notes, done, created_at, updated_at FROM extra_goals WHERE id = ?1",
      params![id],
      |row| {
        Ok(ExtraGoal {
          id: row.get(0)?,
          competency: row.get(1)?,
          title: row.get(2)?,
          kind: row.get(3)?,
          notes: row.get(4)?,
          done: row.get(5)?,
          created_at: row.get(6)?,
          updated_at: row.get(7)?,
        })
      },
    )
    .map_err(|err| format!("Failed to read extra goal: {err}"))?;

  Ok(goal)
}

#[tauri::command]
fn get_month_totals(state: State<DbState>, competency: String) -> Result<MonthTotals, String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "Database lock poisoned.".to_string())?;
  get_month_totals_for(&conn, &competency)
}

#[tauri::command]
fn reopen_month(
  state: State<DbState>,
  competency: String,
) -> Result<MonthSettings, String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "Database lock poisoned.".to_string())?;

  conn
    .execute(
      "INSERT INTO month_settings (competency, opening_balance, is_closed)
       VALUES (?1, COALESCE((SELECT opening_balance FROM month_settings WHERE competency = ?1), 0), 0)
       ON CONFLICT(competency) DO UPDATE SET is_closed = 0",
      params![competency],
    )
    .map_err(|err| format!("Failed to reopen month: {err}"))?;

  let settings: Option<(i64, i64)> = conn
    .query_row(
      "SELECT opening_balance, is_closed FROM month_settings WHERE competency = ?1",
      params![competency],
      |row| Ok((row.get(0)?, row.get(1)?)),
    )
    .optional()
    .map_err(|err| format!("Failed to read month settings: {err}"))?;

  let (opening_balance, is_closed) = settings.unwrap_or((0, 0));

  Ok(MonthSettings {
    competency,
    opening_balance,
    is_closed,
  })
}

fn main() {
  tauri::Builder::default()
    .setup(|app| {
      let conn = init_db(app.app_handle())?;
      app.manage(DbState {
        conn: Mutex::new(conn),
      });
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      list_months,
      get_month_summary,
      list_transactions,
      create_transaction,
      update_transaction,
      delete_transaction,
      get_month_settings,
      set_opening_balance,
      close_month,
      reopen_month,
      get_goals_for_month,
      upsert_goal,
      delete_goal,
      delete_goals_for_month,
      run_notifications_check,
      get_setting,
      set_setting,
      list_notifications,
      mark_notification_read,
      mark_all_read,
      clear_notifications,
      delete_notification,
      get_unread_count,
      list_extra_goals,
      create_extra_goal,
      update_extra_goal,
      delete_extra_goal,
      toggle_extra_goal_done,
      get_month_totals
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
