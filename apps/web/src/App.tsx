import { useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8787";

type FeedbackResult = "know" | "vague" | "unknown";

type TaskWord = {
  id: number;
  word: string;
  phonetic: string | null;
  cnMeaning: string;
  example: string | null;
};

type TodayTask = {
  date: string;
  reviewWords: number;
  newWords: number;
  readingStatus: "pending" | "done";
  reviewQueue: TaskWord[];
  newQueue: TaskWord[];
};

type ApiError = {
  error?: string;
};

function normalizeTaskWord(input: unknown): TaskWord | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const row = input as {
    id?: unknown;
    word?: unknown;
    phonetic?: unknown;
    cnMeaning?: unknown;
    cn_meaning?: unknown;
    example?: unknown;
  };

  const id = typeof row.id === "number" ? row.id : Number(row.id);
  const word = typeof row.word === "string" ? row.word : "";
  const cnMeaningRaw = row.cnMeaning ?? row.cn_meaning;
  const cnMeaning = typeof cnMeaningRaw === "string" ? cnMeaningRaw : "";

  if (!Number.isFinite(id) || id <= 0 || !word || !cnMeaning) {
    return null;
  }

  return {
    id,
    word,
    phonetic: typeof row.phonetic === "string" ? row.phonetic : null,
    cnMeaning,
    example: typeof row.example === "string" ? row.example : null
  };
}

function normalizeTask(input: unknown): TodayTask | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const payload = input as {
    date?: unknown;
    reviewWords?: unknown;
    newWords?: unknown;
    readingStatus?: unknown;
    reviewQueue?: unknown;
    newQueue?: unknown;
  };

  if (typeof payload.date !== "string") {
    return null;
  }

  const reviewWords = Number(payload.reviewWords ?? 0);
  const newWords = Number(payload.newWords ?? 0);
  const readingStatus = payload.readingStatus === "done" ? "done" : "pending";

  const reviewQueue = Array.isArray(payload.reviewQueue)
    ? payload.reviewQueue.map(normalizeTaskWord).filter((item): item is TaskWord => item !== null)
    : [];
  const newQueue = Array.isArray(payload.newQueue)
    ? payload.newQueue.map(normalizeTaskWord).filter((item): item is TaskWord => item !== null)
    : [];

  return {
    date: payload.date,
    reviewWords: Number.isFinite(reviewWords) ? reviewWords : reviewQueue.length,
    newWords: Number.isFinite(newWords) ? newWords : newQueue.length,
    readingStatus,
    reviewQueue,
    newQueue
  };
}

async function parseApiError(res: Response): Promise<string> {
  const fallback = `请求失败(${res.status})`;
  const body = (await res.json().catch(() => null)) as ApiError | null;
  return body?.error ?? fallback;
}

export default function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("请先登录");
  const [task, setTask] = useState<TodayTask | null>(null);
  const [loadingTask, setLoadingTask] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [studyMode, setStudyMode] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const cardQueue = useMemo(() => {
    if (!task) {
      return [] as Array<TaskWord & { phase: "review" | "new" }>;
    }

    return [
      ...task.reviewQueue.map((word) => ({ ...word, phase: "review" as const })),
      ...task.newQueue.map((word) => ({ ...word, phase: "new" as const }))
    ];
  }, [task]);

  const currentCard = cardQueue[currentIndex] ?? null;
  const inReviewPhase = currentIndex < (task?.reviewQueue.length ?? 0);

  async function loadTodayTask(authToken = token): Promise<void> {
    if (!authToken) {
      setMessage("请先登录后再拉取任务");
      return;
    }

    setLoadingTask(true);
    try {
      const res = await fetch(`${API_BASE}/api/tasks/today`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (!res.ok) {
        setMessage(await parseApiError(res));
        return;
      }

      const data = await res.json();
      const normalized = normalizeTask(data);
      if (!normalized) {
        setMessage("任务数据格式不正确");
        return;
      }

      setTask(normalized);
      setStudyMode(false);
      setCurrentIndex(0);
      setFlipped(false);
      setMessage("今日任务已更新");
    } catch {
      setMessage("获取任务失败，请检查网络或 API 地址");
    } finally {
      setLoadingTask(false);
    }
  }

  async function login(): Promise<void> {
    if (!username || !password) {
      setMessage("请输入账号和密码");
      return;
    }

    setLoggingIn(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        setMessage(await parseApiError(res));
        return;
      }

      const data = (await res.json()) as {
        token?: string;
        user?: { role?: string };
      };

      if (!data.token) {
        setMessage("登录返回缺少 token");
        return;
      }

      setToken(data.token);
      setMessage(`登录成功，角色: ${data.user?.role ?? "unknown"}`);
      await loadTodayTask(data.token);
    } catch {
      setMessage("登录失败，请检查网络或 API 地址");
    } finally {
      setLoggingIn(false);
    }
  }

  async function submitFeedback(result: FeedbackResult): Promise<void> {
    if (!token || !currentCard || submitting) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/words/${currentCard.id}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ result })
      });

      if (!res.ok) {
        setMessage(await parseApiError(res));
        return;
      }

      setMessage(`反馈已提交：${feedbackLabel(result)}`);
      setCurrentIndex((prev) => prev + 1);
      setFlipped(false);
    } catch {
      setMessage("反馈提交失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  function startStudy(): void {
    if (!task) {
      setMessage("请先拉取今日任务");
      return;
    }
    setStudyMode(true);
    setCurrentIndex(0);
    setFlipped(false);
    setMessage("已进入学习流程：先复习后新词");
  }

  const reviewCount = task?.reviewWords ?? 0;
  const newCount = task?.newWords ?? 0;
  const readingStatusLabel = task?.readingStatus === "done" ? "已完成" : "未完成";

  return (
    <main className="container">
      <h1>学员学习流程</h1>
      <p className="message">{message}</p>

      <section className="panel">
        <h2>登录</h2>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="username"
          autoComplete="username"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password"
          type="password"
          autoComplete="current-password"
        />
        <div className="actions">
          <button onClick={login} disabled={loggingIn}>
            {loggingIn ? "登录中..." : "登录"}
          </button>
          <button onClick={() => loadTodayTask()} disabled={!token || loadingTask}>
            {loadingTask ? "加载中..." : "刷新今日任务"}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>今日任务概览</h2>
        <div className="summary-grid">
          <div className="summary-item">
            <span className="label">复习</span>
            <strong>{reviewCount}</strong>
          </div>
          <div className="summary-item">
            <span className="label">新词</span>
            <strong>{newCount}</strong>
          </div>
          <div className="summary-item">
            <span className="label">阅读</span>
            <strong>{readingStatusLabel}</strong>
          </div>
        </div>
        <p className="hint">学习顺序固定：先复习，再新词。</p>
        <div className="actions single">
          <button onClick={startStudy} disabled={!task || cardQueue.length === 0}>
            进入卡片学习
          </button>
        </div>
      </section>

      {studyMode && (
        <section className="panel">
          <h2>卡片学习</h2>
          {currentCard ? (
            <>
              <div className="study-meta">
                <span>
                  阶段：{inReviewPhase ? "复习" : "新词"}（第 {currentIndex + 1}/{cardQueue.length} 张）
                </span>
                <button className="link-btn" onClick={() => setStudyMode(false)}>
                  返回概览
                </button>
              </div>

              <button className={`card ${flipped ? "is-flipped" : ""}`} onClick={() => setFlipped((v) => !v)}>
                <div className="card-face card-front">
                  <div className="word">{currentCard.word}</div>
                  <div className="phonetic">{currentCard.phonetic ?? ""}</div>
                  <div className="tap-tip">点击翻转查看释义</div>
                </div>
                <div className="card-face card-back">
                  <div className="meaning">{currentCard.cnMeaning}</div>
                  <div className="example">{currentCard.example ?? "暂无例句"}</div>
                  <div className="tap-tip">再次点击可翻回</div>
                </div>
              </button>

              <div className="feedback-actions">
                <button disabled={submitting} onClick={() => submitFeedback("know")}>
                  认识
                </button>
                <button disabled={submitting} onClick={() => submitFeedback("vague")}>
                  模糊
                </button>
                <button disabled={submitting} onClick={() => submitFeedback("unknown")}>
                  不认识
                </button>
              </div>
            </>
          ) : (
            <div className="done-block">
              <p>今日词卡已完成，已严格按“先复习后新词”执行。</p>
              <button onClick={() => setStudyMode(false)}>返回任务概览</button>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function feedbackLabel(result: FeedbackResult): string {
  if (result === "know") return "认识";
  if (result === "vague") return "模糊";
  return "不认识";
}
