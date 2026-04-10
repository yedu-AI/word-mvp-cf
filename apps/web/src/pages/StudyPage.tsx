import { useEffect, useMemo, useState } from "react";
import type { FeedbackResult, TaskWord, TodayTask } from "../types";

type StudyPageProps = {
  task: TodayTask | null;
  message: string;
  onFeedback: (wordId: number, result: FeedbackResult) => Promise<void>;
};

function feedbackLabel(result: FeedbackResult): string {
  if (result === "know") return "已掌握";
  if (result === "vague") return "模糊";
  return "不认识";
}

export default function StudyPage(props: StudyPageProps) {
  const queue = useMemo<Array<TaskWord & { phase: "review" | "new" }>>(() => {
    if (!props.task) return [];
    return [
      ...props.task.reviewQueue.map((item) => ({ ...item, phase: "review" as const })),
      ...props.task.newQueue.map((item) => ({ ...item, phase: "new" as const }))
    ];
  }, [props.task]);

  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [feedbackMap, setFeedbackMap] = useState<Record<number, FeedbackResult>>({});
  const [submitting, setSubmitting] = useState(false);
  const card = queue[index] ?? null;

  useEffect(() => {
    setIndex(0);
    setFlipped(false);
    setFeedbackMap({});
  }, [props.task?.date]);

  async function handleFeedback(result: FeedbackResult) {
    if (!card || submitting) return;
    setSubmitting(true);
    try {
      await props.onFeedback(card.id, result);
      setFeedbackMap((prev) => ({ ...prev, [card.id]: result }));
      setFlipped(false);
      setIndex((prev) => Math.min(prev + 1, Math.max(queue.length - 1, 0)));
    } finally {
      setSubmitting(false);
    }
  }

  const total = queue.length;
  const current = total === 0 ? 0 : index + 1;
  const progress = total === 0 ? 0 : Math.round((current / total) * 100);
  const reviewed = Object.keys(feedbackMap).length;
  const mastered = Object.values(feedbackMap).filter((v) => v === "know").length;
  const remaining = Math.max(total - reviewed, 0);

  if (!props.task) {
    return (
      <section className="panel">
        <h2>背单词</h2>
        <p className="empty">先点击顶部“刷新任务”，再进入卡片学习。</p>
      </section>
    );
  }

  if (total === 0) {
    return (
      <section className="panel">
        <h2>背单词</h2>
        <p className="empty">今日没有可学习词卡。{props.message}</p>
      </section>
    );
  }

  return (
    <section className="study-screen">
      <div className="progress-track">
        <span className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <p className="progress-label">
        {current} / {total}
      </p>

      <div className="word-card-wrap">
        <article className={`word-card ${flipped ? "is-flipped" : ""}`} onClick={() => setFlipped((v) => !v)}>
          <div className="card-side card-front">
            <p className="phase-badge">{card?.phase === "review" ? "复习词" : "新词"}</p>
            <h2>{card?.word}</h2>
            <p className="phonetic">{card?.phonetic ?? " "}</p>
            <p className="tap-hint">点击翻转查看释义</p>
          </div>
          <div className="card-side card-back">
            <h2 className="meaning">{card?.cnMeaning}</h2>
            <p className="example-line">{card?.example ?? "No example available."}</p>
            <p className="tap-hint">点击翻回单词</p>
          </div>
        </article>
      </div>

      <div className="study-controls">
        <button onClick={() => setIndex((v) => Math.max(v - 1, 0))} disabled={index === 0}>
          上一个
        </button>
        <button className="primary-btn" onClick={() => setFlipped((v) => !v)}>
          翻转
        </button>
        <button onClick={() => setIndex((v) => Math.min(v + 1, total - 1))} disabled={index >= total - 1}>
          下一个
        </button>
      </div>

      <div className="feedback-row">
        {(["unknown", "vague", "know"] as const).map((result) => (
          <button key={result} className="feedback-btn" disabled={submitting} onClick={() => void handleFeedback(result)}>
            {feedbackLabel(result)}
          </button>
        ))}
      </div>

      <div className="stat-grid">
        <article className="stat-card">
          <strong>{remaining}</strong>
          <span>剩余</span>
        </article>
        <article className="stat-card">
          <strong>{reviewed}</strong>
          <span>已复习</span>
        </article>
        <article className="stat-card">
          <strong>{mastered}</strong>
          <span>已掌握</span>
        </article>
      </div>
    </section>
  );
}
