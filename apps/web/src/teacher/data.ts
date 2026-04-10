import type { MetricDefinition, TeacherDashboardPayload } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8787";

const today = new Date().toISOString().slice(0, 10);

const DEMO_DASHBOARD: TeacherDashboardPayload = {
  date: today,
  className: "七年级(2)班",
  sampleSize: 36,
  completionRate: 72.2,
  accuracyRate: 83.4,
  reviewBacklog: 49,
  streakDays: 11,
  readingCompletionRate: 66.7,
  source: "demo",
  note: "当前为演示数据。后端提供 /api/teacher/dashboard 后会自动切换为真实数据。"
};

export const METRIC_DEFINITIONS: MetricDefinition[] = [
  {
    key: "completionRate",
    name: "完成率",
    formula: "当日完成学习流程学生数 / 班级学生总数",
    denominator: "班级内 role=student 的用户数"
  },
  {
    key: "accuracyRate",
    name: "正确率",
    formula: "当日反馈 know 次数 / 当日总反馈次数",
    denominator: "当日 learning_records 中 last_result 总次数"
  },
  {
    key: "reviewBacklog",
    name: "复习积压",
    formula: "当前应复习但未完成条目数",
    denominator: "next_review_at <= 当前时间 的 learning_records 条数"
  },
  {
    key: "streakDays",
    name: "连续学习天数",
    formula: "班级学生个人连续学习天数的中位数",
    denominator: "按每个学生近 30 天有学习记录的自然日计算"
  },
  {
    key: "readingCompletionRate",
    name: "阅读完成率",
    formula: "当日 reading_status=done 学生数 / 班级学生总数",
    denominator: "daily_tasks 当日记录 + users 班级范围"
  }
];

function toSafePercent(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Number(num.toFixed(1))));
}

function toSafeNumber(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return 0;
  }
  return Math.max(0, Math.round(num));
}

function buildDemo(note: string): TeacherDashboardPayload {
  return { ...DEMO_DASHBOARD, note };
}

export async function fetchTeacherDashboard(token: string): Promise<TeacherDashboardPayload> {
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE}/api/teacher/dashboard`, { headers });
    if (!response.ok) {
      return buildDemo(`教师接口返回 ${response.status}，已切换演示数据。`);
    }

    const data = (await response.json()) as Partial<TeacherDashboardPayload>;
    return {
      date: typeof data.date === "string" ? data.date : today,
      className: typeof data.className === "string" ? data.className : "未命名班级",
      sampleSize: toSafeNumber(data.sampleSize),
      completionRate: toSafePercent(data.completionRate),
      accuracyRate: toSafePercent(data.accuracyRate),
      reviewBacklog: toSafeNumber(data.reviewBacklog),
      streakDays: toSafeNumber(data.streakDays),
      readingCompletionRate: toSafePercent(data.readingCompletionRate),
      source: "live",
      note: "实时数据"
    };
  } catch {
    return buildDemo("教师接口暂不可用，已切换演示数据。");
  }
}

export function getDemoDashboard(): TeacherDashboardPayload {
  return buildDemo(DEMO_DASHBOARD.note);
}

