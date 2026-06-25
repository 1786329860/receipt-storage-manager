import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'receipt_manager',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
});

// 测试数据库连接
export async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('[DB] MySQL 连接成功');
    conn.release();
    return true;
  } catch (err) {
    console.error('[DB] MySQL 连接失败:', err.message);
    return false;
  }
}

export default pool;
