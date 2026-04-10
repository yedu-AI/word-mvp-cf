export type FeedbackResult = "know" | "vague" | "unknown";

export type TaskWord = {
  id: number;
  word: string;
  phonetic: string | null;
  cnMeaning: string;
  example: string | null;
};

export type TodayTask = {
  date: string;
  reviewWords: number;
  newWords: number;
  readingStatus: "pending" | "done";
  reviewQueue: TaskWord[];
  newQueue: TaskWord[];
};

export type AuthSession = {
  token: string;
  role: string;
};

export type ReadingQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex?: number;
};

export type ReadingTask = {
  id?: number;
  date: string;
  readingText: string;
  coveragePercent: number;
  targetWords: Array<{ id: number; word: string; cnMeaning: string }>;
  questions: ReadingQuestion[];
  source: "api" | "fallback";
};

export type QuizResult = {
  score: number;
  correctCount: number;
  totalCount: number;
};
