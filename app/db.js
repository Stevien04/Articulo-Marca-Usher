// db.js - Inicialización de base de datos SQLite
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH
  ? path.resolve(__dirname, process.env.DB_PATH)
  : path.join(__dirname, 'data', 'users.db');

let db;
let ready;

function getDb() {
  if (!db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new sqlite3.Database(DB_PATH);
  }
  return db;
}

function initDb() {
  if (ready) return ready;
  const d = getDb();
  const run = (sql, params = []) => new Promise((resolve, reject) => {
    d.run(sql, params, (err) => err ? reject(err) : resolve());
  });
  ready = (async () => {
    await run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT,
      role TEXT DEFAULT 'user'
    )`);
    // Seed demo users
    await run(
      `INSERT OR IGNORE INTO users (username, password, email, role) VALUES (?, ?, ?, ?)`,
      ['admin', 'admin123', 'admin@demo.com', 'admin']
    );
    await run(
      `INSERT OR IGNORE INTO users (username, password, email, role) VALUES (?, ?, ?, ?)`,
      ['alice', 'password1', 'alice@demo.com', 'user']
    );
  })();
  return ready;
}

module.exports = { getDb, initDb };
