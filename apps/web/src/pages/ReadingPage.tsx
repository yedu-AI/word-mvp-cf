import { useEffect, useMemo, useRef, useState } from "react";
import { fetchReadingTask, generateReadingTask, submitQuiz } from "../lib/api";
import { buildFallbackReading, gradeFallbackQuiz } from "../lib/reading-fallback";
import type { QuizResult, ReadingTask, TodayTask } from "../types";

type ReadingPageProps = {
  token: string;
  task: TodayTask | null;
};

export default function ReadingPage(props: ReadingPageProps) {
  const [loading, setLoading] = useState(false);
  const [reading, setReading] = useState<ReadingTask | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [message, setMessage] = useState("点击生成今日阅读");
  const [regenerating, setRegenerating] = useState(false);
  const [regenProgress, setRegenProgress] = useState(0);
  const regenTimerRef = useRef<number | null>(null);

  const seedWords = useMemo(() => {
    if (!props.task) return [];
    return [...props.task.reviewQueue, ...props.task.newQueue];
  }, [props.task]);

  function clearProgressTimer() {
    if (regenTimerRef.current !== null) {
      window.clearInterval(regenTimerRef.current);
      regenTimerRef.current = null;
    }
  }

  function startProgress() {
    clearProgressTimer();
    setRegenerating(true);
    setRegenProgress(6);
    regenTimerRef.current = window.setInterval(() => {
      setRegenProgress((prev) => {
        if (prev >= 92) return prev;
        const next = prev + (prev < 40 ? 9 : prev < 75 ? 5 : 2);
        return Math.min(next, 92);
      });
    }, 240);
  }

  async function finishProgressAndReload() {
    clearProgressTimer();
    setRegenProgress(100);
    setMessage("重新生成完成，页面刷新中...");
    await new Promise((resolve) => window.setTimeout(resolve, 420));
    window.location.reload();
  }

  async function loadReading(forceGenerate: boolean) {
    setLoading(true);
    setResult(null);
    setAnswers({});
    if (forceGenerate) {
      startProgress();
    }

    try {
      let nextTask = !forceGenerate ? await fetchReadingTask(props.token) : null;
      if (!nextTask) {
        nextTask = await generateReadingTask(props.token, forceGenerate);
      }
      if (!nextTask) {
        nextTask = buildFallbackReading(seedWords, props.task?.date);
        setMessage("已使用本地兜底阅读内容（后端阅读接口未就绪）");
      } else {
        setMessage(nextTask.source === "api" ? "阅读内容来自后端接口" : "阅读内容来自本地兜底");
      }
      setReading(nextTask);

      if (forceGenerate) {
        await finishProgressAndReload();
        return;
      }
    } catch (error) {
      const fallback = buildFallbackReading(seedWords, props.task?.date);
      setReading(fallback);
      setMessage(error instanceof Error ? `接口失败，已切换兜底：${error.message}` : "接口失败，已切换兜底阅读");
      clearProgressTimer();
      setRegenerating(false);
      setRegenProgress(0);
    } finally {
      setLoading(false);
      if (!forceGenerate) {
        clearProgressTimer();
        setRegenerating(false);
        setRegenProgress(0);
      }
    }
  }

  useEffect(() => {
    if (!props.task) return;
    void loadReading(false);
    return () => clearProgressTimer();
  }, [props.task?.date]);

  async function handleSubmit() {
    if (!reading) return;
    const payload = reading.questions.map((q) => ({
      questionId: q.id,
      selectedIndex: answers[q.id] ?? -1
    }));
    if (payload.some((item) => item.selectedIndex < 0)) {
      setMessage("请先完成全部 5 题");
      return;
    }

    if (reading.source === "api" && reading.id) {
      try {
        const apiResult = await submitQuiz(props.token, {
          readingTaskId: reading.id,
          answers: payload
        });
        if (apiResult) {
          setResult(apiResult);
          setMessage(`提交成功，得分 ${apiResult.score}`);
          return;
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "测验提交失败");
      }
    }

    const fallbackResult = gradeFallbackQuiz(reading, answers);
    setResult(fallbackResult);
    setMessage(`本地评分完成，得分 ${fallbackResult.score}`);
  }

  if (!props.task) {
    return (
      <section className="panel">
        <h2>阅读测验</h2>
        <p className="empty">请先回到背词页，刷新今日任务后再进入阅读。</p>
      </section>
    );
  }

  return (
    <section className="reading-screen">
      <header className="reading-head">
        <h2>今日阅读测验</h2>
        <button className="ghost-btn" onClick={() => void loadReading(true)} disabled={loading || regenerating}>
          {regenerating ? "生成中..." : "重新生成"}
        </button>
      </header>
      <p className="subtle">{message}</p>

      {regenerating && (
        <section className="generate-progress" aria-live="polite">
          <div className="generate-progress-track">
            <span className="generate-progress-fill" style={{ width: `${regenProgress}%` }} />
          </div>
          <p className="generate-progress-label">生成进度 {regenProgress}%</p>
        </section>
      )}

      {reading && (
        <>
          <article className="reading-card">
            <p>{reading.readingText}</p>
            <div className="reading-meta">
              <span>词汇覆盖率：{reading.coveragePercent.toFixed(1)}%</span>
              <span>目标词：{reading.targetWords.map((w) => w.word).join(", ") || "暂无"}</span>
            </div>
          </article>

          <section className="quiz-list">
            {reading.questions.slice(0, 5).map((question, idx) => (
              <article key={question.id} className="quiz-item">
                <h3>
                  {idx + 1}. {question.prompt}
                </h3>
                <div className="option-grid">
                  {question.options.map((option, optionIndex) => (
                    <button
                      key={option}
                      className={`option-btn ${answers[question.id] === optionIndex ? "is-selected" : ""}`}
                      onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: optionIndex }))}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </section>

          <div className="reading-actions">
            <button className="primary-btn" onClick={() => void handleSubmit()}>
              提交 5 题答案
            </button>
            {result && (
              <p className="result-text">
                分数 {result.score}（{result.correctCount}/{result.totalCount}）
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
