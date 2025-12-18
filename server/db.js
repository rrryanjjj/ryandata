/**
 * 数据库模块 - 使用 sql.js (SQLite WebAssembly)
 * Requirements: 7.1
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'sales.db');

let db = null;

/**
 * 初始化数据库连接
 */
async function initDatabase() {
  if (db) return db;

  const SQL = await initSqlJs();
  
  // 确保数据目录存在
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // 如果数据库文件存在，加载它；否则创建新数据库
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // 创建表结构
  createTables();
  
  return db;
}

/**
 * 创建数据库表
 */
function createTables() {
  // 用户表
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 销售数据表
  db.run(`
    CREATE TABLE IF NOT EXISTS sales_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      month_id TEXT NOT NULL,
      month_name TEXT NOT NULL,
      color TEXT NOT NULL,
      config TEXT NOT NULL,
      grouped_data TEXT NOT NULL,
      raw_data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 创建索引
  db.run(`CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales_data(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sales_month_id ON sales_data(month_id)`);
}

/**
 * 保存数据库到文件
 */
function saveDatabase() {
  if (!db) return;
  
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

/**
 * 获取数据库实例
 */
function getDatabase() {
  if (!db) {
    throw new Error('数据库未初始化，请先调用 initDatabase()');
  }
  return db;
}

/**
 * 关闭数据库连接
 */
function closeDatabase() {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
  }
}

/**
 * 执行查询并返回结果数组
 */
function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

/**
 * 执行单条查询并返回第一行
 */
function queryOne(sql, params = []) {
  const results = query(sql, params);
  return results.length > 0 ? results[0] : null;
}

/**
 * 执行插入/更新/删除操作
 */
function run(sql, params = []) {
  db.run(sql, params);
  saveDatabase();
  return {
    lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0],
    changes: db.getRowsModified()
  };
}

module.exports = {
  initDatabase,
  getDatabase,
  closeDatabase,
  saveDatabase,
  query,
  queryOne,
  run
};
