// طبقة قاعدة البيانات (SQLite) - إنشاء الجداول الأساسية عند أول تشغيل
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// لو معرّف متغير بيئة DATA_DIR (مسار قرص دائم على الاستضافة) بنستخدمه، وإلا بنستخدم مجلد data المحلي
const DATA_DIR = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'data')
  : path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'quiz.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  config TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plays (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  player_name TEXT,
  layout TEXT NOT NULL,
  current_index INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  outcome TEXT,
  percent INTEGER,
  started_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_plays_campaign ON plays(campaign_id);
CREATE INDEX IF NOT EXISTS idx_plays_created ON plays(started_at);
`);

// إنشاء حساب أدمن افتراضي عند أول تشغيل فقط
const adminCount = db.prepare('SELECT COUNT(*) AS c FROM admins').get().c;
if (adminCount === 0) {
  const defaultUser = process.env.ADMIN_USERNAME || 'admin';
  const defaultPass = process.env.ADMIN_PASSWORD || 'admin123';
  const hash = bcrypt.hashSync(defaultPass, 10);
  db.prepare(
    'INSERT INTO admins (id, username, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(uuidv4(), defaultUser, hash, 'Admin', new Date().toISOString());
  console.log('──────────────────────────────────────────────');
  console.log(`تم إنشاء حساب أدمن افتراضي:`);
  console.log(`  اسم المستخدم: ${defaultUser}`);
  console.log(`  كلمة المرور:  ${defaultPass}`);
  console.log('برجاء تغييرها فورًا من لوحة التحكم بعد أول دخول.');
  console.log('──────────────────────────────────────────────');
}

module.exports = db;
