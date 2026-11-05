/**
 * 实现功能：只读 MySQL 连接池
 * 职责：连接 legacy 库（默认 deepseek），暴露 query/execute 并强制只读纪律。
 *       账号本身有 ALL PRIVILEGES（HANDOFF §3.6 已定案），因此只读由本层纪律保证：
 *       对外只导出 select* 系列，写操作在代码层面不存在入口。
 * 接口/函数清单：
 *   - createDb(config)：建立连接池
 *   - select(pool, sql, params)：执行一次 SELECT（预编译）
 *   - pingDb(pool)：健康检查
 */
import mysql from 'mysql2/promise';

const FORBIDDEN = /\b(insert|update|delete|replace|drop|truncate|alter|create|grant|revoke|call|set|lock|unlock|load)\b/i;

/** 兜底纪律检查：只允许单条 SELECT/WITH 语句 */
const assertReadOnlySelect = (sql) => {
  const text = String(sql || '').trim();
  if (!/^(select|with)\b/i.test(text)) {
    throw new Error('shim 只允许 SELECT 语句');
  }
  if (FORBIDDEN.test(text)) {
    throw new Error('shim 拒绝对包含写操作关键字的语句');
  }
  if (text.includes(';') && !/;\s*$/.test(text)) {
    throw new Error('shim 只允许单条语句');
  }
  return text.replace(/;\s*$/, '');
};

export const createDb = (config) => {
  const pool = mysql.createPool({
    host: config.DB_HOST,
    port: config.DB_PORT,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: config.DB_NAME,
    charset: 'utf8mb4_unicode_ci',
    waitForConnections: true,
    connectionLimit: 8,
    maxIdle: 8,
    idleTimeout: 60000,
    queueLimit: 0,
    enableKeepAlive: true,
    dateStrings: true,
  });
  return pool;
};

export const select = async (pool, sql, params = []) => {
  const statement = assertReadOnlySelect(sql);
  const [rows] = await pool.execute(statement, params);
  return rows;
};

export const pingDb = async (pool) => {
  const rows = await select(pool, 'SELECT 1 AS ok');
  return Array.isArray(rows) && rows.length === 1 && Number(rows[0].ok) === 1;
};
