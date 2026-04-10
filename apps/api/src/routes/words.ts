import { Hono } from "hono";
import { z } from "zod";
import type { FeedbackResult } from "../services/review-engine";
import { submitWordFeedback } from "../services/review-records";
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
  const submitted = await submitWordFeedback(c.env.DB, {
    userId,
    wordId,
    result,
    nowMs: now
  });

  return c.json({
    ok: true,
    deduped: submitted.deduped,
    reviewStage: submitted.reviewStage,
    nextReviewAt: submitted.nextReviewAt
  });
});

export default wordsRoutes;
