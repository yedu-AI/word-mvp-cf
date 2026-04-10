import type { FeedbackResult, QuizResult, ReadingTask, TodayTask } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8787";

type LoginResponse = {
  token: string;
  user: { role: string };
};

type ApiErrorBody = {
  error?: string;
  detail?: string;
};

function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeTaskWord(input: unknown) {
  if (!input || typeof input !== "object") return null;
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
  const cnMeaning =
    typeof row.cnMeaning === "string" ? row.cnMeaning : typeof row.cn_meaning === "string" ? row.cn_meaning : "";
  if (!Number.isFinite(id) || id <= 0 || !word || !cnMeaning) return null;

  return {
    id,
    word,
    phonetic: typeof row.phonetic === "string" ? row.phonetic : null,
    cnMeaning,
    example: typeof row.example === "string" ? row.example : null
  };
}

async function parseError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
  const core = body?.error ?? `请求失败(${res.status})`;
  return body?.detail ? `${core}: ${body.detail}` : core;
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`
  };
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  const data = (await res.json()) as Partial<LoginResponse>;
  if (!data.token || !data.user?.role) {
    throw new Error("登录返回数据不完整");
  }

  return { token: data.token, user: { role: data.user.role } };
}

export async function fetchTodayTask(token: string): Promise<TodayTask> {
  const res = await fetch(`${API_BASE}/api/tasks/today`, {
    headers: authHeaders(token)
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  const raw = (await res.json()) as {
    date?: unknown;
    reviewWords?: unknown;
    newWords?: unknown;
    readingStatus?: unknown;
    reviewQueue?: unknown;
    newQueue?: unknown;
  };

  if (typeof raw.date !== "string") {
    throw new Error("任务数据格式不正确");
  }

  const reviewQueue = ensureArray<unknown>(raw.reviewQueue)
    .map(normalizeTaskWord)
    .filter((item): item is NonNullable<ReturnType<typeof normalizeTaskWord>> => Boolean(item));

  const newQueue = ensureArray<unknown>(raw.newQueue)
    .map(normalizeTaskWord)
    .filter((item): item is NonNullable<ReturnType<typeof normalizeTaskWord>> => Boolean(item));

  return {
    date: raw.date,
    reviewWords: Number(raw.reviewWords ?? reviewQueue.length),
    newWords: Number(raw.newWords ?? newQueue.length),
    readingStatus: raw.readingStatus === "done" ? "done" : "pending",
    reviewQueue,
    newQueue
  };
}

export async function submitWordFeedback(token: string, wordId: number, result: FeedbackResult): Promise<void> {
  const res = await fetch(`${API_BASE}/api/words/${wordId}/feedback`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ result })
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }
}

function normalizeReadingTask(raw: unknown): ReadingTask | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as {
    id?: unknown;
    date?: unknown;
    readingText?: unknown;
    coveragePercent?: unknown;
    targetWords?: unknown;
    questions?: unknown;
  };

  if (typeof input.date !== "string" || typeof input.readingText !== "string") {
    return null;
  }

  const questions = ensureArray<unknown>(input.questions).flatMap((q): ReadingTask["questions"] => {
    if (!q || typeof q !== "object") return [];
    const row = q as { id?: unknown; prompt?: unknown; options?: unknown; correctIndex?: unknown };
    if (typeof row.id !== "string" || typeof row.prompt !== "string") return [];
    const options = ensureArray<unknown>(row.options).filter((v): v is string => typeof v === "string");
    if (options.length < 2) return [];
    const correctIndex = typeof row.correctIndex === "number" ? row.correctIndex : undefined;
    return [{ id: row.id, prompt: row.prompt, options, correctIndex }];
  });

  return {
    id: typeof input.id === "number" ? input.id : undefined,
    date: input.date,
    readingText: input.readingText,
    coveragePercent: Number(input.coveragePercent ?? 0),
    targetWords: ensureArray<unknown>(input.targetWords).flatMap((w) => {
      if (!w || typeof w !== "object") return [];
      const row = w as { id?: unknown; word?: unknown; cnMeaning?: unknown; cn_meaning?: unknown };
      const id = typeof row.id === "number" ? row.id : Number(row.id);
      const word = typeof row.word === "string" ? row.word : "";
      const cn = typeof row.cnMeaning === "string" ? row.cnMeaning : typeof row.cn_meaning === "string" ? row.cn_meaning : "";
      if (!Number.isFinite(id) || !word || !cn) return [];
      return [{ id, word, cnMeaning: cn }];
    }),
    questions,
    source: "api"
  };
}

export async function fetchReadingTask(token: string): Promise<ReadingTask | null> {
  const res = await fetch(`${API_BASE}/api/reading/today`, {
    headers: authHeaders(token)
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  const payload = (await res.json()) as { exists?: boolean; task?: unknown };
  if (!payload.exists || !payload.task) {
    return null;
  }

  return normalizeReadingTask(payload.task);
}

export async function generateReadingTask(token: string): Promise<ReadingTask | null> {
  const res = await fetch(`${API_BASE}/api/reading/generate`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({})
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  const payload = (await res.json()) as { task?: unknown };
  return normalizeReadingTask(payload.task ?? null);
}

export async function submitQuiz(
  token: string,
  input: {
    readingTaskId?: number;
    answers: Array<{ questionId: string; selectedIndex: number }>;
  }
): Promise<QuizResult | null> {
  const res = await fetch(`${API_BASE}/api/quiz/submit`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  const payload = (await res.json()) as {
    score?: unknown;
    correctCount?: unknown;
    totalCount?: unknown;
  };

  return {
    score: Number(payload.score ?? 0),
    correctCount: Number(payload.correctCount ?? 0),
    totalCount: Number(payload.totalCount ?? 0)
  };
}
