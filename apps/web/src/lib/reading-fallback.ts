import type { ReadingTask, TaskWord } from "../types";

const EXTRA_DISTRACTORS = [
  "a weather event",
  "a travel habit",
  "a classroom behavior",
  "an emotion",
  "a city landmark",
  "a time expression",
  "a study strategy"
];

function formatDate(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function pickTargetWords(words: TaskWord[]): Array<{ id: number; word: string; cnMeaning: string }> {
  const seen = new Set<number>();
  const unique: Array<{ id: number; word: string; cnMeaning: string }> = [];
  for (const item of words) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push({
      id: item.id,
      word: item.word,
      cnMeaning: item.cnMeaning
    });
    if (unique.length >= 10) break;
  }
  return unique;
}

function buildReadingText(targetWords: Array<{ word: string }>): string {
  const anchors = targetWords.slice(0, 8).map((w) => w.word).join(", ");
  return [
    "Emma planned a focused evening review before tomorrow's English class.",
    "She wrote a short goal on paper: finish vocabulary cards first, then read one passage, then answer five questions.",
    "At the start, she wanted to abandon the plan because she felt tired, but she kept moving for ten more minutes.",
    "That small decision created a clear benefit: her attention returned, and each sentence became easier to understand.",
    "When a challenge appeared, she did not stop immediately.",
    "She marked the unknown part, continued reading, and came back with better context.",
    `In her notebook, she highlighted these words: ${anchors}.`,
    "She used each word in one sentence and checked whether the meaning fit the paragraph.",
    "By the end of the session, she could retell the story in her own words and explain why the writer chose that tone.",
    "Her teacher said this routine works because it combines memory, reading speed, and self-check into one loop."
  ].join(" ");
}

export function buildFallbackReading(words: TaskWord[], date?: string): ReadingTask {
  const targetWords = pickTargetWords(words);
  const readingText = buildReadingText(targetWords);

  const baseQuestions = targetWords.slice(0, 5).map((word, index) => {
    const distractors = [
      ...targetWords.filter((w) => w.id !== word.id).slice(0, 3).map((w) => w.cnMeaning),
      ...EXTRA_DISTRACTORS
    ];
    const options = [word.cnMeaning, ...distractors].slice(0, 4);
    const sorted = [options[0], options[2], options[1], options[3]].filter(Boolean) as string[];
    const correctIndex = sorted.findIndex((item) => item === word.cnMeaning);

    return {
      id: `q-${index + 1}`,
      prompt: `The word "${word.word}" is closest to:`,
      options: sorted,
      correctIndex
    };
  });

  while (baseQuestions.length < 5) {
    const idx = baseQuestions.length + 1;
    baseQuestions.push({
      id: `q-${idx}`,
      prompt: `Which statement best matches paragraph ${Math.min(idx + 2, 8)}?`,
      options: [
        "Keep reading and infer from context.",
        "Skip all unknown words forever.",
        "Only memorize spelling without sentence use.",
        "Finish without checking understanding."
      ],
      correctIndex: 0
    });
  }

  return {
    date: date ?? formatDate(),
    readingText,
    coveragePercent: targetWords.length === 0 ? 0 : 72,
    targetWords,
    questions: baseQuestions,
    source: "fallback"
  };
}

export function gradeFallbackQuiz(
  reading: ReadingTask,
  answers: Record<string, number>
): { score: number; correctCount: number; totalCount: number } {
  const questions = reading.questions.filter((q) => typeof q.correctIndex === "number");
  if (questions.length === 0) {
    return { score: 0, correctCount: 0, totalCount: reading.questions.length };
  }
  const correctCount = questions.filter((q) => answers[q.id] === q.correctIndex).length;
  return {
    score: Math.round((correctCount / questions.length) * 100),
    correctCount,
    totalCount: questions.length
  };
}
