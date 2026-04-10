import { Hono } from "hono";
import { z } from "zod";
import { submitQuiz } from "../services/reading";
import type { Bindings, Variables } from "../types";

const answerSchema = z.object({
  questionId: z.string().min(1),
  selectedIndex: z.number().int().min(0).max(3)
});

const submitSchema = z.object({
  readingTaskId: z.number().int().positive().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  answers: z.array(answerSchema).min(1)
});

const quizRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

quizRoutes.post("/submit", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ ok: false, error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  }
  const body = await c.req.json().catch(() => null);
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: "Invalid payload",
        code: "INVALID_PAYLOAD"
      },
      400
    );
  }

  try {
    const result = await submitQuiz({
      env: c.env,
      userId,
      readingTaskId: parsed.data.readingTaskId,
      date: parsed.data.date,
      answers: parsed.data.answers
    });

    return c.json({
      ok: true,
      readingTaskId: result.readingTaskId,
      date: result.date,
      score: result.score,
      correctCount: result.correctCount,
      totalCount: result.totalCount,
      results: result.results
    });
  } catch (error) {
    if (error instanceof Error && error.message === "READING_TASK_NOT_FOUND") {
      return c.json(
        {
          ok: false,
          error: "Reading task not found.",
          code: "READING_TASK_NOT_FOUND"
        },
        404
      );
    }

    if (error instanceof Error && error.message === "QUIZ_NOT_FOUND") {
      return c.json(
        {
          ok: false,
          error: "Quiz not found in reading task.",
          code: "QUIZ_NOT_FOUND"
        },
        400
      );
    }

    return c.json(
      {
        ok: false,
        error: "Failed to submit quiz.",
        code: "QUIZ_SUBMIT_FAILED",
        detail: error instanceof Error ? error.message : String(error)
      },
      500
    );
  }
});

export default quizRoutes;
