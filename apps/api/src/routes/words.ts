import { Hono } from "hono";
import { z } from "zod";
import { nextReviewAt, nextStage, type FeedbackResult } from "../lib/review";
import type { Bindings, Variables } from "../types";

const feedbackSchema = z.object({
  result: z.enum(["know", "vague", "unknown"])
});

const wordsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

wordsRoutes.post("/:wordId/feedback", async (c) => {
  const userId = c.get("userId");
  const wordId = Number(c.req.param("wordId"));
  if (!Number.isFinite(wordId) || wordId <= 0) {
    return c.json({ error: "Invalid wordId" }, 400);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const now = Date.now();
  const result = parsed.data.result as FeedbackResult;

  const existing = await c.env.DB.prepare(
    "SELECT first_learned_at, review_stage FROM learning_records WHERE user_id = ? AND word_id = ? LIMIT 1"
  )
    .bind(userId, wordId)
    .first<{ first_learned_at: number; review_stage: number }>();

  const currentStage = existing?.review_stage ?? 0;
  const updatedStage = nextStage(currentStage, result);
  const nextAt = nextReviewAt(updatedStage, now);
  const firstLearnedAt = existing?.first_learned_at ?? now;

  await c.env.DB.prepare(
    `INSERT INTO learning_records (user_id, word_id, first_learned_at, last_reviewed_at, review_stage, last_result, next_review_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, word_id) DO UPDATE SET
       last_reviewed_at = excluded.last_reviewed_at,
       review_stage = excluded.review_stage,
       last_result = excluded.last_result,
       next_review_at = excluded.next_review_at`
  )
    .bind(userId, wordId, firstLearnedAt, now, updatedStage, result, nextAt)
    .run();

  return c.json({ ok: true, reviewStage: updatedStage, nextReviewAt: nextAt });
});

export default wordsRoutes;
