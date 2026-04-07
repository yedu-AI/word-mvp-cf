import { Hono } from "hono";
import type { Bindings, Variables } from "../types";

const tasksRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

function formatDate(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

tasksRoutes.get("/today", async (c) => {
  const userId = c.get("userId");
  const now = Date.now();
  const today = formatDate();

  const due = await c.env.DB.prepare(
    "SELECT COUNT(1) as count FROM learning_records WHERE user_id = ? AND next_review_at <= ?"
  )
    .bind(userId, now)
    .first<{ count: number }>();

  const task = await c.env.DB.prepare(
    "SELECT reading_status FROM daily_tasks WHERE user_id = ? AND date = ? LIMIT 1"
  )
    .bind(userId, today)
    .first<{ reading_status: "pending" | "done" }>();

  const reviewWords = Math.min(Number(due?.count ?? 0), 20);
  return c.json({
    date: today,
    reviewWords,
    newWords: 20,
    readingStatus: task?.reading_status ?? "pending",
    flow: ["review", "newWords", "reading", "quiz"]
  });
});

export default tasksRoutes;
