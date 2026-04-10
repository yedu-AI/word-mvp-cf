import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["student", "teacher", "admin"] }).notNull().default("student"),
  className: text("class_name"),
  createdAt: integer("created_at").notNull()
});

export const words = sqliteTable("words", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  word: text("word").notNull(),
  phonetic: text("phonetic"),
  cnMeaning: text("cn_meaning").notNull(),
  example: text("example"),
  level: text("level"),
  unit: text("unit")
});

export const learningRecords = sqliteTable(
  "learning_records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    wordId: integer("word_id").notNull(),
    firstLearnedAt: integer("first_learned_at").notNull(),
    lastReviewedAt: integer("last_reviewed_at").notNull(),
    reviewStage: integer("review_stage").notNull().default(0),
    lastResult: text("last_result", { enum: ["know", "vague", "unknown"] }).notNull(),
    nextReviewAt: integer("next_review_at").notNull()
  },
  (table) => ({
    userWordUnique: uniqueIndex("idx_learning_user_word_unique").on(table.userId, table.wordId),
    userNextReviewIdx: index("idx_learning_records_user_next_review").on(table.userId, table.nextReviewAt)
  })
);

export const dailyTasks = sqliteTable(
  "daily_tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    date: text("date").notNull(),
    reviewWordsCount: integer("review_words_count").notNull().default(0),
    newWordsCount: integer("new_words_count").notNull().default(20),
    readingStatus: text("reading_status", { enum: ["pending", "done"] }).notNull().default("pending")
  },
  (table) => ({
    userDateUnique: uniqueIndex("idx_daily_tasks_user_date").on(table.userId, table.date)
  })
);

export const readingTasks = sqliteTable(
  "reading_tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    date: text("date").notNull(),
    targetWordsJson: text("target_words_json").notNull(),
    readingText: text("reading_text").notNull(),
    coverageRate: real("coverage_rate").notNull(),
    questionsJson: text("questions_json").notNull(),
    answersJson: text("answers_json"),
    score: integer("score"),
    createdAt: integer("created_at").notNull()
  },
  (table) => ({
    userDateIdx: index("idx_reading_tasks_user_date").on(table.userId, table.date)
  })
);
