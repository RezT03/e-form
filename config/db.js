const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'event_booking_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true // return dates as strings to avoid timezone shift in EJS
};

const pool = mysql.createPool(dbConfig);

// Helper to test database connectivity
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err.message,
      code: err.code
    };
  }
}

module.exports = {
  pool,
  testConnection,
  query: (sql, params) => pool.query(sql, params),
  execute: (sql, params) => pool.execute(sql, params)
};
