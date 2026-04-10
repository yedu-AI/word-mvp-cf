const DAY_MS = 24 * 60 * 60 * 1000;

export const REVIEW_STAGE_INTERVAL_DAYS = [0, 1, 2, 4, 7, 15] as const;
export const MIN_REVIEW_STAGE = 0;
export const MAX_REVIEW_STAGE = REVIEW_STAGE_INTERVAL_DAYS.length - 1;
export const MAX_DAILY_REVIEW_WORDS = 20;
export const DAILY_NEW_WORDS = 20;

export type FeedbackResult = "know" | "vague" | "unknown";

export type LearningRecordSnapshot = {
  firstLearnedAt: number;
  lastReviewedAt: number;
  lastResult: FeedbackResult;
  nextReviewAt: number;
  reviewStage: number;
};

export type DueReviewItem = {
  wordId: number;
  nextReviewAt: number;
  reviewStage: number;
  lastResult: FeedbackResult;
};

type FeedbackTransitionInput = {
  existing: LearningRecordSnapshot | null;
  result: FeedbackResult;
  nowMs: number;
};

export type FeedbackTransition =
  | {
      action: "updated";
      firstLearnedAt: number;
      lastReviewedAt: number;
      lastResult: FeedbackResult;
      nextReviewAt: number;
      reviewStage: number;
    }
  | {
      action: "duplicate_not_due";
      firstLearnedAt: number;
      lastReviewedAt: number;
      lastResult: FeedbackResult;
      nextReviewAt: number;
      reviewStage: number;
    };

export type TodayReviewPlan = {
  reviewWords: number;
  newWords: number;
  dueReviewTotal: number;
  reviewWordIds: number[];
};

export function clampReviewStage(stage: number): number {
  if (!Number.isFinite(stage)) {
    return MIN_REVIEW_STAGE;
  }
  const integerStage = Math.trunc(stage);
  return Math.min(Math.max(integerStage, MIN_REVIEW_STAGE), MAX_REVIEW_STAGE);
}

export function resolveNextStage(currentStage: number, result: FeedbackResult): number {
  const safeStage = clampReviewStage(currentStage);
  if (result === "know") {
    return clampReviewStage(safeStage + 1);
  }
  if (result === "unknown") {
    return clampReviewStage(safeStage - 1);
  }
  return safeStage;
}

export function resolveNextReviewAt(stage: number, nowMs: number): number {
  const safeStage = clampReviewStage(stage);
  const days = REVIEW_STAGE_INTERVAL_DAYS[safeStage];
  return nowMs + days * DAY_MS;
}

export function evaluateFeedbackTransition(input: FeedbackTransitionInput): FeedbackTransition {
  const { existing, result, nowMs } = input;

  if (existing && existing.nextReviewAt > nowMs) {
    return {
      action: "duplicate_not_due",
      firstLearnedAt: existing.firstLearnedAt,
      lastReviewedAt: existing.lastReviewedAt,
      lastResult: existing.lastResult,
      nextReviewAt: existing.nextReviewAt,
      reviewStage: clampReviewStage(existing.reviewStage)
    };
  }

  const currentStage = existing?.reviewStage ?? MIN_REVIEW_STAGE;
  const reviewStage = resolveNextStage(currentStage, result);
  const nextReviewAt = resolveNextReviewAt(reviewStage, nowMs);

  return {
    action: "updated",
    firstLearnedAt: existing?.firstLearnedAt ?? nowMs,
    lastReviewedAt: nowMs,
    lastResult: result,
    nextReviewAt,
    reviewStage
  };
}

export function sortDueReviewItems(items: DueReviewItem[]): DueReviewItem[] {
  return [...items].sort((a, b) => {
    const aPriority = a.lastResult === "vague" ? 0 : 1;
    const bPriority = b.lastResult === "vague" ? 0 : 1;

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    if (a.nextReviewAt !== b.nextReviewAt) {
      return a.nextReviewAt - b.nextReviewAt;
    }
    if (a.reviewStage !== b.reviewStage) {
      return a.reviewStage - b.reviewStage;
    }
    return a.wordId - b.wordId;
  });
}

export function buildTodayReviewPlan(params: {
  dueReviewItems: DueReviewItem[];
  dueReviewTotal?: number;
  reviewLimit?: number;
  newWordsPerDay?: number;
}): TodayReviewPlan {
  const reviewLimit = Math.max(0, Math.trunc(params.reviewLimit ?? MAX_DAILY_REVIEW_WORDS));
  const newWords = Math.max(0, Math.trunc(params.newWordsPerDay ?? DAILY_NEW_WORDS));
  const sortedDueItems = sortDueReviewItems(params.dueReviewItems);
  const selectedItems = sortedDueItems.slice(0, reviewLimit);
  const rawTotal = params.dueReviewTotal ?? sortedDueItems.length;
  const dueReviewTotal = Math.max(0, Math.trunc(rawTotal));

  return {
    reviewWords: Math.min(dueReviewTotal, reviewLimit),
    newWords,
    dueReviewTotal,
    reviewWordIds: selectedItems.map((item) => item.wordId)
  };
}
