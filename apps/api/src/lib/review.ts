const REVIEW_DAYS = [0, 1, 2, 4, 7, 15] as const;

export type FeedbackResult = "know" | "vague" | "unknown";

export function nextStage(currentStage: number, result: FeedbackResult): number {
  if (result === "know") return Math.min(currentStage + 1, REVIEW_DAYS.length - 1);
  if (result === "unknown") return Math.max(currentStage - 1, 0);
  return currentStage;
}

export function nextReviewAt(stage: number, nowMs: number): number {
  const days = REVIEW_DAYS[Math.max(0, Math.min(stage, REVIEW_DAYS.length - 1))];
  return nowMs + days * 24 * 60 * 60 * 1000;
}
