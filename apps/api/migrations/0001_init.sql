CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
  class_name TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word TEXT NOT NULL,
  phonetic TEXT,
  cn_meaning TEXT NOT NULL,
  example TEXT,
  level TEXT,
  unit TEXT
);

CREATE TABLE IF NOT EXISTS learning_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  word_id INTEGER NOT NULL,
  first_learned_at INTEGER NOT NULL,
  last_reviewed_at INTEGER NOT NULL,
  review_stage INTEGER NOT NULL DEFAULT 0,
  last_result TEXT NOT NULL CHECK (last_result IN ('know', 'vague', 'unknown')),
  next_review_at INTEGER NOT NULL,
  UNIQUE(user_id, word_id),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(word_id) REFERENCES words(id)
);

CREATE INDEX IF NOT EXISTS idx_learning_records_user_next_review
ON learning_records(user_id, next_review_at);

CREATE TABLE IF NOT EXISTS daily_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  review_words_count INTEGER NOT NULL DEFAULT 0,
  new_words_count INTEGER NOT NULL DEFAULT 20,
  reading_status TEXT NOT NULL DEFAULT 'pending' CHECK (reading_status IN ('pending', 'done')),
  UNIQUE(user_id, date),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS reading_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  target_words_json TEXT NOT NULL,
  reading_text TEXT NOT NULL,
  coverage_rate REAL NOT NULL,
  questions_json TEXT NOT NULL,
  answers_json TEXT,
  score INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_reading_tasks_user_date
ON reading_tasks(user_id, date);
