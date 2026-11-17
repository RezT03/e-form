const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function initDatabase() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const databaseName = process.env.DB_NAME || 'event_booking_db';

  console.log(`[DB INIT] Connecting to MySQL at ${host}:${port} as ${user}...`);

  let connection;
  try {
    // 1. Connect without database selected to ensure database exists
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true
    });

    console.log(`[DB INIT] Connected. Creating database '${databaseName}' if not exists...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.query(`USE \`${databaseName}\`;`);

    // 2. Read schema.sql
    const schemaPath = path.join(__dirname, '..', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log(`[DB INIT] Executing schema.sql...`);
    await connection.query(schemaSql);

    console.log(`[DB INIT] Database and tables successfully initialized!`);
  } catch (err) {
    console.error(`[DB INIT ERROR] Failed to initialize database:`, err.message);
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

initDatabase();
