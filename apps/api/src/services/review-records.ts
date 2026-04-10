import {
  MAX_DAILY_REVIEW_WORDS,
  buildTodayReviewPlan,
  evaluateFeedbackTransition,
  type FeedbackResult
} from "./review-engine";

type DueCountRow = { count: number };

type DueReviewRow = {
  word_id: number;
  next_review_at: number;
  review_stage: number;
  last_result: FeedbackResult;
};

type ExistingLearningRecordRow = {
  first_learned_at: number;
  last_reviewed_at: number;
  last_result: FeedbackResult;
  next_review_at: number;
  review_stage: number;
};

export type SubmitFeedbackInput = {
  userId: string;
  wordId: number;
  result: FeedbackResult;
  nowMs: number;
};

export type SubmitFeedbackResult = {
  applied: boolean;
  deduped: boolean;
  reviewStage: number;
  nextReviewAt: number;
};

export async function getTodayReviewPlan(db: D1Database, userId: string, nowMs: number) {
  const dueCount = await db
    .prepare("SELECT COUNT(1) as count FROM learning_records WHERE user_id = ? AND next_review_at <= ?")
    .bind(userId, nowMs)
    .first<DueCountRow>();

  const dueRowsResp = await db
    .prepare(
      `SELECT word_id, review_stage, next_review_at, last_result
       FROM learning_records
       WHERE user_id = ? AND next_review_at <= ?
       ORDER BY CASE WHEN last_result = 'vague' THEN 0 ELSE 1 END, next_review_at ASC, review_stage ASC, word_id ASC
       LIMIT ?`
    )
    .bind(userId, nowMs, MAX_DAILY_REVIEW_WORDS)
    .all<DueReviewRow>();

  const dueReviewItems = (dueRowsResp.results ?? []).map((row) => ({
    wordId: row.word_id,
    reviewStage: row.review_stage,
    nextReviewAt: row.next_review_at,
    lastResult: row.last_result
  }));

  return buildTodayReviewPlan({
    dueReviewItems,
    dueReviewTotal: Number(dueCount?.count ?? 0)
  });
}

export async function submitWordFeedback(db: D1Database, input: SubmitFeedbackInput): Promise<SubmitFeedbackResult> {
  const existing = await db
    .prepare(
      `SELECT first_learned_at, last_reviewed_at, review_stage, last_result, next_review_at
       FROM learning_records
       WHERE user_id = ? AND word_id = ?
       LIMIT 1`
    )
    .bind(input.userId, input.wordId)
    .first<ExistingLearningRecordRow>();

  const transition = evaluateFeedbackTransition({
    existing: existing
      ? {
          firstLearnedAt: existing.first_learned_at,
          lastReviewedAt: existing.last_reviewed_at,
          reviewStage: existing.review_stage,
          lastResult: existing.last_result,
          nextReviewAt: existing.next_review_at
        }
      : null,
    nowMs: input.nowMs,
    result: input.result
  });

  if (transition.action === "updated") {
    await db
      .prepare(
        `INSERT INTO learning_records (user_id, word_id, first_learned_at, last_reviewed_at, review_stage, last_result, next_review_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, word_id) DO UPDATE SET
           last_reviewed_at = excluded.last_reviewed_at,
           review_stage = excluded.review_stage,
           last_result = excluded.last_result,
           next_review_at = excluded.next_review_at`
      )
      .bind(
        input.userId,
        input.wordId,
        transition.firstLearnedAt,
        transition.lastReviewedAt,
        transition.reviewStage,
        transition.lastResult,
        transition.nextReviewAt
      )
      .run();
  }

  return {
    applied: transition.action === "updated",
    deduped: transition.action === "duplicate_not_due",
    reviewStage: transition.reviewStage,
    nextReviewAt: transition.nextReviewAt
  };
}
