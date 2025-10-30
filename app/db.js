const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'data', 'app.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  resident_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  postcode TEXT,
  landlord_name TEXT,
  landlord_email TEXT,
  category TEXT,
  severity TEXT,
  description TEXT NOT NULL,
  immediate_danger INTEGER DEFAULT 0,
  vulnerable_persons INTEGER DEFAULT 0,
  consent_to_share INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  deadline_investigate TEXT,
  deadline_start_repairs TEXT,
  deadline_emergency TEXT
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  author TEXT,
  content TEXT NOT NULL,
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS report_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  stored_name TEXT NOT NULL,
  original_name TEXT,
  mime_type TEXT,
  file_size INTEGER,
  url_path TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);
`);

module.exports = db;
