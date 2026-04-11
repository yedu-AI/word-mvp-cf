import type { Bindings } from "../types";

type WordItem = {
  id: number;
  word: string;
  cnMeaning: string;
};

type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  targetWordId: number;
};

type StoredReadingTask = {
  id: number;
  date: string;
  target_words_json: string;
  reading_text: string;
  coverage_rate: number;
  questions_json: string;
  answers_json: string | null;
  score: number | null;
  created_at: number;
};

type SubmissionAnswer = {
  questionId: string;
  selectedIndex: number;
};

type GradedAnswer = {
  questionId: string;
  selectedIndex: number | null;
  correctIndex: number;
  isCorrect: boolean;
};

type AiFailure = {
  code: string;
  message: string;
  detail?: string;
};

export type ReadingTaskView = {
  id: number;
  date: string;
  readingText: string;
  coverageRate: number;
  coveragePercent: number;
  targetWords: WordItem[];
  questions: Array<Omit<QuizQuestion, "correctIndex" | "targetWordId">>;
  submitted: boolean;
  score: number | null;
  createdAt: number;
};

export type GenerateReadingParams = {
  env: Bindings;
  userId: string;
  date?: string;
  forceRegenerate?: boolean;
  strictAi?: boolean;
};

export type GenerateReadingResult = {
  task: ReadingTaskView;
  source: "ai" | "template";
  reused: boolean;
  warning?: string;
};

export type SubmitQuizParams = {
  env: Bindings;
  userId: string;
  date?: string;
  readingTaskId?: number;
  answers: SubmissionAnswer[];
};

export type SubmitQuizResult = {
  readingTaskId: number;
  date: string;
  score: number;
  correctCount: number;
  totalCount: number;
  results: GradedAnswer[];
};

const TARGET_WORD_POOL_LIMIT = 16;
const TARGET_WORD_MAX = 10;

const FALLBACK_DISTRACTORS = [
  "a weather event",
  "a type of vehicle",
  "a plant type",
  "an animal type",
  "a cooking method",
  "a building element",
  "a sport activity",
  "a geographic feature"
];

function formatDate(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function utcDayRangeMs(date: string): { start: number; end: number } {
  const start = Date.parse(`${date}T00:00:00.000Z`);
  return { start, end: start + 24 * 60 * 60 * 1000 };
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function appearsInText(textLower: string, word: string): boolean {
  const lowered = word.toLowerCase().trim();
  if (!lowered) return false;
  if (/^[a-z]+(?:[-'][a-z]+)*$/.test(lowered)) {
    const pattern = new RegExp(`\\b${escapeRegex(lowered)}\\b`, "i");
    return pattern.test(textLower);
  }
  return textLower.includes(lowered);
}

function toCoverageRate(covered: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((covered / total) * 10000) / 10000;
}

function parseJsonArray<T>(value: string, fallback: T[]): T[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function toReadingTaskView(record: StoredReadingTask): ReadingTaskView {
  const targetWords = parseJsonArray<WordItem>(record.target_words_json, []);
  const questions = parseJsonArray<QuizQuestion>(record.questions_json, []).map((q) => ({
    id: q.id,
    prompt: q.prompt,
    options: Array.isArray(q.options) ? q.options : []
  }));
  return {
    id: record.id,
    date: record.date,
    readingText: record.reading_text,
    coverageRate: record.coverage_rate,
    coveragePercent: Math.round(record.coverage_rate * 10000) / 100,
    targetWords,
    questions,
    submitted: record.score !== null,
    score: record.score,
    createdAt: record.created_at
  };
}

function pickUniqueWords(words: WordItem[]): WordItem[] {
  const seen = new Set<number>();
  const out: WordItem[] = [];
  for (const item of words) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    if (item.word.trim().length === 0) continue;
    out.push(item);
  }
  return out;
}

function templateReadingText(includedWords: string[]): string {
  const anchors = includedWords.map((word) => `${word}`).join(", ");
  return [
    "Lina prepared for an English sharing day in her class.",
    "She set a simple goal: read one short passage, write one reflection, and discuss it with a partner.",
    "At first she felt slow, but she used a timer and focused on key ideas instead of translating every line.",
    "When she met difficult parts, she marked them and moved on, then returned after finishing the full story.",
    "This strategy helped her keep confidence and notice progress in one sitting.",
    `During review, these words appeared in her notes: ${anchors}.`,
    "She used each word in a sentence, checked if the meaning matched the context, and corrected small mistakes.",
    "After twenty minutes, she could retell the passage clearly and answer questions with evidence.",
    "Her teacher said this routine works because it connects vocabulary, reading speed, and understanding in one loop.",
    "Lina decided to repeat the same method tomorrow with a new passage."
  ].join(" ");
}

async function fetchTodayWords(env: Bindings, userId: string, date: string): Promise<WordItem[]> {
  const { start, end } = utcDayRangeMs(date);
  const fromNewWords = await env.DB.prepare(
    `SELECT w.id as id, w.word as word, w.cn_meaning as cnMeaning
     FROM learning_records lr
     JOIN words w ON w.id = lr.word_id
     WHERE lr.user_id = ? AND lr.first_learned_at >= ? AND lr.first_learned_at < ?
     ORDER BY lr.first_learned_at DESC
     LIMIT ?`
  )
    .bind(userId, start, end, TARGET_WORD_POOL_LIMIT)
    .all<WordItem>();

  const candidates = pickUniqueWords(fromNewWords.results ?? []);
  if (candidates.length >= TARGET_WORD_POOL_LIMIT) return candidates;

  const fromLearning = await env.DB.prepare(
    `SELECT w.id as id, w.word as word, w.cn_meaning as cnMeaning
     FROM learning_records lr
     JOIN words w ON w.id = lr.word_id
     WHERE lr.user_id = ?
     ORDER BY lr.last_reviewed_at DESC
     LIMIT 40`
  )
    .bind(userId)
    .all<WordItem>();

  candidates.push(...pickUniqueWords(fromLearning.results ?? []));
  const uniqueAfterLearning = pickUniqueWords(candidates);
  if (uniqueAfterLearning.length >= TARGET_WORD_POOL_LIMIT) {
    return uniqueAfterLearning.slice(0, TARGET_WORD_POOL_LIMIT);
  }

  const fromGlobal = await env.DB.prepare(
    `SELECT id, word, cn_meaning as cnMeaning
     FROM words
     ORDER BY id DESC
     LIMIT 80`
  ).all<WordItem>();

  uniqueAfterLearning.push(...pickUniqueWords(fromGlobal.results ?? []));
  return pickUniqueWords(uniqueAfterLearning).slice(0, TARGET_WORD_POOL_LIMIT);
}

function splitCoveredWords(words: WordItem[], text: string): { covered: WordItem[]; uncovered: WordItem[] } {
  const textLower = text.toLowerCase();
  const covered: WordItem[] = [];
  const uncovered: WordItem[] = [];
  for (const item of words) {
    if (appearsInText(textLower, item.word)) {
      covered.push(item);
    } else {
      uncovered.push(item);
    }
  }
  return { covered, uncovered };
}

function chooseTargetWordsForCoverage(
  covered: WordItem[],
  uncovered: WordItem[]
): { targetWords: WordItem[]; coveredCount: number; coverageRate: number } {
  let best:
    | {
        words: WordItem[];
        coveredCount: number;
        coverageRate: number;
        distance: number;
      }
    | undefined;

  const maxCovered = Math.min(covered.length, TARGET_WORD_MAX);
  for (let x = maxCovered; x >= 1; x -= 1) {
    const maxUncovered = Math.min(uncovered.length, TARGET_WORD_MAX - x);
    for (let y = 0; y <= maxUncovered; y += 1) {
      const total = x + y;
      if (total === 0) continue;
      const ratio = x / total;
      if (ratio < 0.6 || ratio > 0.8) continue;
      const distance = Math.abs(ratio - 0.7) + (x >= 5 ? 0 : 1);
      const chosen = covered.slice(0, x).concat(uncovered.slice(0, y));
      if (!best || distance < best.distance) {
        best = {
          words: chosen,
          coveredCount: x,
          coverageRate: toCoverageRate(x, total),
          distance
        };
      }
    }
  }

  if (best) {
    return {
      targetWords: best.words,
      coveredCount: best.coveredCount,
      coverageRate: best.coverageRate
    };
  }

  const fallbackCoveredCount = Math.min(covered.length, TARGET_WORD_MAX);
  const fallbackWords = covered.slice(0, fallbackCoveredCount);
  return {
    targetWords: fallbackWords,
    coveredCount: fallbackCoveredCount,
    coverageRate: toCoverageRate(fallbackCoveredCount, fallbackWords.length)
  };
}

function uniqueOptions(options: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of options) {
    const val = item.trim();
    if (!val || seen.has(val)) continue;
    seen.add(val);
    out.push(val);
  }
  return out;
}

function fillOptions(correct: string, distractorPool: string[]): { options: string[]; correctIndex: number } {
  const options = uniqueOptions([correct, ...distractorPool]).slice(0, 4);
  while (options.length < 4) {
    options.push(FALLBACK_DISTRACTORS[options.length % FALLBACK_DISTRACTORS.length]);
  }
  const shift = Math.min(3, Math.abs(correct.length) % 4);
  const rotated = options.slice(shift).concat(options.slice(0, shift));
  const correctIndex = rotated.findIndex((item) => item === correct);
  return { options: rotated, correctIndex: correctIndex >= 0 ? correctIndex : 0 };
}

function buildQuizQuestions(targetWords: WordItem[], coveredWords: WordItem[]): QuizQuestion[] {
  const source = coveredWords.length > 0 ? coveredWords : targetWords;
  const questions: QuizQuestion[] = [];
  for (let i = 0; i < 5; i += 1) {
    const word = source[i % source.length];
    const distractors = targetWords
      .filter((item) => item.id !== word.id)
      .map((item) => item.cnMeaning)
      .concat(FALLBACK_DISTRACTORS);
    const { options, correctIndex } = fillOptions(word.cnMeaning, distractors);
    questions.push({
      id: `q${i + 1}`,
      prompt: `In the passage, what is the closest Chinese meaning of "${word.word}"?`,
      options,
      correctIndex,
      targetWordId: word.id
    });
  }
  return questions;
}

async function generateByAi(
  env: Bindings,
  includedWords: WordItem[],
  allTargetWords: WordItem[]
): Promise<{ text: string } | { failure: AiFailure }> {
  const dynamicEnv = env as Bindings & Record<string, unknown>;
  const apiKey =
    typeof dynamicEnv.DEEPSEEK_API_KEY === "string" && dynamicEnv.DEEPSEEK_API_KEY
      ? dynamicEnv.DEEPSEEK_API_KEY
      : typeof dynamicEnv.AI_API_KEY === "string"
        ? dynamicEnv.AI_API_KEY
        : "";
  if (!apiKey) {
    return { failure: { code: "AI_NOT_CONFIGURED", message: "DEEPSEEK_API_KEY (or AI_API_KEY) is missing." } };
  }

  const baseUrl =
    typeof dynamicEnv.DEEPSEEK_BASE_URL === "string" && dynamicEnv.DEEPSEEK_BASE_URL
      ? dynamicEnv.DEEPSEEK_BASE_URL
      : typeof dynamicEnv.AI_BASE_URL === "string" && dynamicEnv.AI_BASE_URL
        ? dynamicEnv.AI_BASE_URL
        : "https://api.deepseek.com/chat/completions";
  const model =
    typeof dynamicEnv.DEEPSEEK_MODEL === "string" && dynamicEnv.DEEPSEEK_MODEL
      ? dynamicEnv.DEEPSEEK_MODEL
      : typeof dynamicEnv.AI_MODEL === "string" && dynamicEnv.AI_MODEL
        ? dynamicEnv.AI_MODEL
        : "deepseek-chat";

  const included = includedWords.map((item) => item.word).join(", ");
  const allTargets = allTargetWords.map((item) => item.word).join(", ");
  const prompt = [
    "Generate one English reading passage with about 180 words.",
    `Must include these words naturally: ${included}.`,
    `Avoid introducing these target words unless already required: ${allTargets}.`,
    "Output JSON only: {\"readingText\":\"...\"}."
  ].join(" ");

  try {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.5,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are an assistant that returns strict JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    if (!res.ok) {
      const detail = await res.text();
      return {
        failure: {
          code: "AI_HTTP_ERROR",
          message: `AI request failed with status ${res.status}.`,
          detail: detail.slice(0, 300)
        }
      };
    }

    const payload = (await res.json().catch(() => null)) as
      | { choices?: Array<{ message?: { content?: string } }> }
      | null;
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) {
      return {
        failure: {
          code: "AI_EMPTY_RESPONSE",
          message: "AI response did not contain message content."
        }
      };
    }

    const parsed = JSON.parse(content) as { readingText?: unknown };
    if (typeof parsed.readingText !== "string" || parsed.readingText.trim().length < 60) {
      return {
        failure: {
          code: "AI_INVALID_RESPONSE",
          message: "AI response JSON does not contain valid readingText."
        }
      };
    }

    return { text: parsed.readingText.trim() };
  } catch (error) {
    return {
      failure: {
        code: "AI_REQUEST_EXCEPTION",
        message: "AI request threw an exception.",
        detail: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

async function generateReadingPayload(
  env: Bindings,
  candidates: WordItem[],
  strictAi: boolean
): Promise<{
  readingText: string;
  targetWords: WordItem[];
  questions: QuizQuestion[];
  coverageRate: number;
  source: "ai" | "template";
  warning?: string;
}> {
  const uniqueCandidates = pickUniqueWords(candidates).slice(0, TARGET_WORD_POOL_LIMIT);
  if (uniqueCandidates.length === 0) {
    throw new Error("NO_DAILY_WORDS");
  }

  const includeSeedCount = Math.max(1, Math.min(8, Math.max(4, Math.round(uniqueCandidates.length * 0.7))));
  const includeSeeds = uniqueCandidates.slice(0, includeSeedCount);

  const aiResult = await generateByAi(env, includeSeeds, uniqueCandidates);
  let source: "ai" | "template" = "template";
  let warning: string | undefined;
  let readingText = templateReadingText(includeSeeds.map((item) => item.word));

  if ("text" in aiResult) {
    source = "ai";
    readingText = aiResult.text;
  } else {
    warning = `${aiResult.failure.code}: ${aiResult.failure.message}`;
    if (strictAi) {
      const error = new Error("AI_GENERATION_FAILED");
      (error as Error & { cause?: AiFailure }).cause = aiResult.failure;
      throw error;
    }
  }

  const split = splitCoveredWords(uniqueCandidates, readingText);
  const coverageSelection = chooseTargetWordsForCoverage(split.covered, split.uncovered);
  if (coverageSelection.targetWords.length === 0 || coverageSelection.coveredCount === 0) {
    throw new Error("INSUFFICIENT_TARGET_WORD_COVERAGE");
  }

  const targetWords = coverageSelection.targetWords;
  const coveredInTarget = split.covered.filter((item) => targetWords.some((w) => w.id === item.id));
  const coverageRate = toCoverageRate(coveredInTarget.length, targetWords.length);
  const questions = buildQuizQuestions(targetWords, coveredInTarget);

  return {
    readingText,
    targetWords,
    questions,
    coverageRate,
    source,
    warning
  };
}

async function getLatestTaskByDate(env: Bindings, userId: string, date: string): Promise<StoredReadingTask | null> {
  return env.DB.prepare(
    `SELECT id, date, target_words_json, reading_text, coverage_rate, questions_json, answers_json, score, created_at
     FROM reading_tasks
     WHERE user_id = ? AND date = ?
     ORDER BY id DESC
     LIMIT 1`
  )
    .bind(userId, date)
    .first<StoredReadingTask>();
}

async function markDailyTaskPendingIfMissing(env: Bindings, userId: string, date: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO daily_tasks (user_id, date, review_words_count, new_words_count, reading_status)
     VALUES (?, ?, 0, 20, 'pending')
     ON CONFLICT(user_id, date) DO NOTHING`
  )
    .bind(userId, date)
    .run();
}

async function markDailyTaskDone(env: Bindings, userId: string, date: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO daily_tasks (user_id, date, review_words_count, new_words_count, reading_status)
     VALUES (?, ?, 0, 20, 'done')
     ON CONFLICT(user_id, date) DO UPDATE SET reading_status = 'done'`
  )
    .bind(userId, date)
    .run();
}

export async function getTodayReadingTask(
  env: Bindings,
  userId: string,
  date = formatDate()
): Promise<ReadingTaskView | null> {
  const existing = await getLatestTaskByDate(env, userId, date);
  if (!existing) return null;
  return toReadingTaskView(existing);
}

export async function generateReadingTask(params: GenerateReadingParams): Promise<GenerateReadingResult> {
  const date = params.date || formatDate();
  if (!params.forceRegenerate) {
    const existing = await getLatestTaskByDate(params.env, params.userId, date);
    if (existing) {
      return { task: toReadingTaskView(existing), source: "template", reused: true };
    }
  }

  const todayWords = await fetchTodayWords(params.env, params.userId, date);
  if (todayWords.length === 0) {
    throw new Error("NO_DAILY_WORDS");
  }

  const generated = await generateReadingPayload(params.env, todayWords, Boolean(params.strictAi));
  const now = Date.now();

  await markDailyTaskPendingIfMissing(params.env, params.userId, date);

  const insert = await params.env.DB.prepare(
    `INSERT INTO reading_tasks (user_id, date, target_words_json, reading_text, coverage_rate, questions_json, answers_json, score, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?)`
  )
    .bind(
      params.userId,
      date,
      JSON.stringify(generated.targetWords),
      generated.readingText,
      generated.coverageRate,
      JSON.stringify(generated.questions),
      now
    )
    .run();

  const taskId = Number(insert.meta.last_row_id);
  const latest = await params.env.DB.prepare(
    `SELECT id, date, target_words_json, reading_text, coverage_rate, questions_json, answers_json, score, created_at
     FROM reading_tasks
     WHERE id = ? LIMIT 1`
  )
    .bind(taskId)
    .first<StoredReadingTask>();

  if (!latest) {
    throw new Error("READING_TASK_WRITE_FAILED");
  }

  return {
    task: toReadingTaskView(latest),
    source: generated.source,
    reused: false,
    warning: generated.warning
  };
}

export async function submitQuiz(params: SubmitQuizParams): Promise<SubmitQuizResult> {
  const date = params.date || formatDate();
  const task = params.readingTaskId
    ? await params.env.DB
        .prepare(
          `SELECT id, date, target_words_json, reading_text, coverage_rate, questions_json, answers_json, score, created_at
           FROM reading_tasks
           WHERE id = ? AND user_id = ?
           LIMIT 1`
        )
        .bind(params.readingTaskId, params.userId)
        .first<StoredReadingTask>()
    : await getLatestTaskByDate(params.env, params.userId, date);

  if (!task) {
    throw new Error("READING_TASK_NOT_FOUND");
  }

  const questions = parseJsonArray<QuizQuestion>(task.questions_json, []);
  if (questions.length === 0) {
    throw new Error("QUIZ_NOT_FOUND");
  }

  const answerMap = new Map<string, number>();
  for (const answer of params.answers) {
    if (answer.questionId && Number.isFinite(answer.selectedIndex)) {
      answerMap.set(answer.questionId, answer.selectedIndex);
    }
  }

  const results: GradedAnswer[] = questions.map((question) => {
    const selected = answerMap.get(question.id);
    const selectedIndex = typeof selected === "number" ? selected : null;
    return {
      questionId: question.id,
      selectedIndex,
      correctIndex: question.correctIndex,
      isCorrect: selectedIndex === question.correctIndex
    };
  });

  const totalCount = questions.length;
  const correctCount = results.filter((item) => item.isCorrect).length;
  const score = Math.round((correctCount / totalCount) * 100);

  await params.env.DB.prepare("UPDATE reading_tasks SET answers_json = ?, score = ? WHERE id = ?")
    .bind(JSON.stringify(results), score, task.id)
    .run();

  await markDailyTaskDone(params.env, params.userId, task.date);

  return {
    readingTaskId: task.id,
    date: task.date,
    score,
    correctCount,
    totalCount,
    results
  };
}


