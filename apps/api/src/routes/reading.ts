import { Hono } from "hono";
import { z } from "zod";
import { generateReadingTask, getTodayReadingTask } from "../services/reading";
import type { Bindings, Variables } from "../types";

const readingRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const generateSchema = z.object({
  forceRegenerate: z.boolean().optional(),
  strictAi: z.boolean().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
});

readingRoutes.get("/today", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ ok: false, error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  }
  const task = await getTodayReadingTask(c.env, userId);
  return c.json({
    ok: true,
    exists: Boolean(task),
    task
  });
});

readingRoutes.post("/generate", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ ok: false, error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  }
  const body = await c.req.json().catch(() => ({}));
  const parsed = generateSchema.safeParse(body);
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
    const generated = await generateReadingTask({
      env: c.env,
      userId,
      forceRegenerate: parsed.data.forceRegenerate,
      strictAi: parsed.data.strictAi,
      date: parsed.data.date
    });
    return c.json({
      ok: true,
      task: generated.task,
      meta: {
        reused: generated.reused,
        source: generated.source,
        warning: generated.warning ?? null
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "NO_DAILY_WORDS") {
      return c.json(
        {
          ok: false,
          error: "No vocabulary found for today. Please finish word learning first.",
          code: "NO_DAILY_WORDS"
        },
        400
      );
    }

    if (error instanceof Error && error.message === "AI_GENERATION_FAILED") {
      const detail = (error as Error & { cause?: { code?: string; message?: string; detail?: string } }).cause;
      return c.json(
        {
          ok: false,
          error: "AI generation failed.",
          code: detail?.code ?? "AI_GENERATION_FAILED",
          detail: detail?.detail ?? detail?.message ?? "AI returned invalid response."
        },
        502
      );
    }

    return c.json(
      {
        ok: false,
        error: "Failed to generate reading task.",
        code: "READING_GENERATE_FAILED",
        detail: error instanceof Error ? error.message : String(error)
      },
      500
    );
  }
});

export default readingRoutes;
