import { Hono } from "hono";
import { DAILY_NEW_WORDS } from "../services/review-engine";
import { getTodayReviewPlan } from "../services/review-records";
import type { Bindings, Variables } from "../types";

const tasksRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

type TaskWord = {
  id: number;
  word: string;
  phonetic: string | null;
  cnMeaning: string;
  example: string | null;
};

function formatDate(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function mapTaskWord(item: {
  id: number;
  word: string;
  phonetic: string | null;
  cn_meaning: string;
  example: string | null;
}): TaskWord {
  return {
    id: item.id,
    word: item.word,
    phonetic: item.phonetic,
    cnMeaning: item.cn_meaning,
    example: item.example
  };
}

tasksRoutes.get("/today", async (c) => {
  const userId = c.get("userId");
  const now = Date.now();
  const today = formatDate();

  const reviewPlan = await getTodayReviewPlan(c.env.DB, userId, now);

  const task = await c.env.DB.prepare("SELECT reading_status FROM daily_tasks WHERE user_id = ? AND date = ? LIMIT 1")
    .bind(userId, today)
    .first<{ reading_status: "pending" | "done" }>();

  const reviewQueue: TaskWord[] = [];
  if (reviewPlan.reviewWordIds.length > 0) {
    const placeholders = reviewPlan.reviewWordIds.map(() => "?").join(", ");
    const reviewRows = await c.env.DB
      .prepare(
        `SELECT id, word, phonetic, cn_meaning, example
         FROM words
         WHERE id IN (${placeholders})`
      )
      .bind(...reviewPlan.reviewWordIds)
      .all<{ id: number; word: string; phonetic: string | null; cn_meaning: string; example: string | null }>();

    const byId = new Map((reviewRows.results ?? []).map((item) => [item.id, mapTaskWord(item)]));
    for (const wordId of reviewPlan.reviewWordIds) {
      const word = byId.get(wordId);
      if (word) {
        reviewQueue.push(word);
      }
    }
  }

  const newQueueRows = await c.env.DB
    .prepare(
      `SELECT id, word, phonetic, cn_meaning, example
       FROM words
       WHERE id NOT IN (
         SELECT word_id FROM learning_records WHERE user_id = ?
       )
       ORDER BY id ASC
       LIMIT ?`
    )
    .bind(userId, DAILY_NEW_WORDS)
    .all<{ id: number; word: string; phonetic: string | null; cn_meaning: string; example: string | null }>();

  const newQueue = (newQueueRows.results ?? []).map(mapTaskWord);

  return c.json({
    date: today,
    reviewWords: reviewPlan.reviewWords,
    newWords: DAILY_NEW_WORDS,
    dueReviewTotal: reviewPlan.dueReviewTotal,
    readingStatus: task?.reading_status ?? "pending",
    flow: ["review", "newWords", "reading", "quiz"],
    reviewQueue,
    newQueue,
    newWordsAvailable: newQueue.length
  });
});

export default tasksRoutes;
