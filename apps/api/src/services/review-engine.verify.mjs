import assert from "node:assert/strict";
import {
  DAILY_NEW_WORDS,
  MAX_DAILY_REVIEW_WORDS,
  MAX_REVIEW_STAGE,
  MIN_REVIEW_STAGE,
  buildTodayReviewPlan,
  evaluateFeedbackTransition,
  resolveNextReviewAt,
  resolveNextStage
} from "./review-engine.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const nowMs = Date.UTC(2026, 3, 10, 0, 0, 0);

function testStageRules() {
  assert.equal(resolveNextStage(MAX_REVIEW_STAGE, "know"), MAX_REVIEW_STAGE, "know should cap on max stage");
  assert.equal(resolveNextStage(MIN_REVIEW_STAGE, "unknown"), MIN_REVIEW_STAGE, "unknown should not go below min");
  assert.equal(resolveNextStage(3, "unknown"), 2, "unknown should fallback at least one stage");
  assert.equal(resolveNextStage(2, "vague"), 2, "vague should stay at current stage");
}

function testNextReviewAtRules() {
  assert.equal(resolveNextReviewAt(0, nowMs), nowMs, "stage 0 should schedule same-day review");
  assert.equal(resolveNextReviewAt(5, nowMs), nowMs + 15 * DAY_MS, "stage 5 should schedule after 15 days");
}

function testTodayPlanRules() {
  const plan = buildTodayReviewPlan({
    dueReviewTotal: 25,
    dueReviewItems: Array.from({ length: 25 }, (_, idx) => ({
      wordId: idx + 1,
      reviewStage: 1,
      nextReviewAt: nowMs + idx,
      lastResult: idx === 12 ? "vague" : "know"
    }))
  });

  assert.equal(plan.reviewWords, MAX_DAILY_REVIEW_WORDS, "daily review words should be capped at 20");
  assert.equal(plan.newWords, DAILY_NEW_WORDS, "daily new words should default to 20");
  assert.equal(plan.reviewWordIds.length, MAX_DAILY_REVIEW_WORDS, "review queue should be capped at 20");
  assert.equal(plan.reviewWordIds[0], 13, "vague words should be prioritized to the front");
}

function testEmptyPlan() {
  const plan = buildTodayReviewPlan({ dueReviewItems: [] });
  assert.equal(plan.reviewWords, 0, "review words should be zero for empty data");
  assert.equal(plan.reviewWordIds.length, 0, "review queue should be empty for empty data");
}

function testDuplicateSubmissionRule() {
  const deduped = evaluateFeedbackTransition({
    existing: {
      firstLearnedAt: nowMs - DAY_MS,
      lastReviewedAt: nowMs - 1000,
      lastResult: "know",
      nextReviewAt: nowMs + 3600_000,
      reviewStage: 2
    },
    result: "know",
    nowMs
  });

  assert.equal(deduped.action, "duplicate_not_due", "feedback should be ignored when word is not due");

  const accepted = evaluateFeedbackTransition({
    existing: {
      firstLearnedAt: nowMs - DAY_MS,
      lastReviewedAt: nowMs - DAY_MS,
      lastResult: "vague",
      nextReviewAt: nowMs - 1,
      reviewStage: 2
    },
    result: "know",
    nowMs
  });

  assert.equal(accepted.action, "updated", "feedback should be accepted when word is due");
}

testStageRules();
testNextReviewAtRules();
testTodayPlanRules();
testEmptyPlan();
testDuplicateSubmissionRule();

console.log("review-engine verify passed");
