export type TeacherDashboardMetrics = {
  date: string;
  className: string;
  sampleSize: number;
  completionRate: number;
  accuracyRate: number;
  reviewBacklog: number;
  streakDays: number;
  readingCompletionRate: number;
};

export type DashboardDataSource = "live" | "demo";

export type TeacherDashboardPayload = TeacherDashboardMetrics & {
  source: DashboardDataSource;
  note: string;
};

export type MetricDefinition = {
  key: string;
  name: string;
  formula: string;
  denominator: string;
};
