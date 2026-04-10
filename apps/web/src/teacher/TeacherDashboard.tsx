import { FormEvent, useEffect, useMemo, useState } from "react";
import { METRIC_DEFINITIONS, fetchTeacherDashboard, getDemoDashboard } from "./data";
import type { TeacherDashboardPayload } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8787";
const TOKEN_KEY = "word_mvp_teacher_token";

type LoginState = {
  username: string;
  password: string;
};

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatMetric(label: string, value: number): string {
  if (label === "复习积压") {
    return `${value} 词`;
  }
  if (label === "连续学习天数") {
    return `${value} 天`;
  }
  return formatPercent(value);
}

export default function TeacherDashboard() {
  const [loginState, setLoginState] = useState<LoginState>({ username: "", password: "" });
  const [dashboard, setDashboard] = useState<TeacherDashboardPayload>(getDemoDashboard());
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("未检测到教师会话，当前展示演示数据。");

  const metricCards = useMemo(
    () => [
      { name: "完成率", value: dashboard.completionRate },
      { name: "正确率", value: dashboard.accuracyRate },
      { name: "复习积压", value: dashboard.reviewBacklog },
      { name: "连续学习天数", value: dashboard.streakDays },
      { name: "阅读完成率", value: dashboard.readingCompletionRate }
    ],
    [dashboard]
  );

  async function loadDashboard(token: string) {
    setIsLoading(true);
    const data = await fetchTeacherDashboard(token);
    setDashboard(data);
    setMessage(data.note);
    setIsLoading(false);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginState)
      });
      const data = (await response.json()) as { token?: string; user?: { role?: string }; error?: string };
      if (!response.ok || !data.token) {
        setMessage(data.error ?? "登录失败");
        setIsLoading(false);
        return;
      }

      const role = data.user?.role;
      if (role !== "teacher" && role !== "admin") {
        setMessage("当前账号不是教师或管理员，无法查看教师看板。");
        setIsLoading(false);
        return;
      }

      localStorage.setItem(TOKEN_KEY, data.token);
      await loadDashboard(data.token);
    } catch {
      setMessage("登录请求失败，请检查 API 是否运行。");
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY) ?? "";
    if (!token) {
      return;
    }
    loadDashboard(token);
  }, []);

  return (
    <main className="teacher-page">
      <header className="hero">
        <div>
          <h1>教师端最小看板</h1>
          <p>
            班级：{dashboard.className} | 统计日期：{dashboard.date} | 样本：{dashboard.sampleSize} 人
          </p>
        </div>
        <span className={`source source-${dashboard.source}`}>{dashboard.source === "live" ? "实时数据" : "演示数据"}</span>
      </header>

      <section className="panel">
        <form onSubmit={handleLogin} className="login-form">
          <input
            placeholder="教师账号"
            value={loginState.username}
            onChange={(event) => setLoginState((prev) => ({ ...prev, username: event.target.value }))}
          />
          <input
            placeholder="密码"
            type="password"
            value={loginState.password}
            onChange={(event) => setLoginState((prev) => ({ ...prev, password: event.target.value }))}
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? "加载中..." : "登录并刷新数据"}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              localStorage.removeItem(TOKEN_KEY);
              const demo = getDemoDashboard();
              setDashboard(demo);
              setMessage("已切回演示数据。");
            }}
          >
            仅看演示数据
          </button>
        </form>
        <p className="hint">{message}</p>
      </section>

      <section className="cards">
        {metricCards.map((card) => (
          <article key={card.name} className="card">
            <h2>{card.name}</h2>
            <strong>{formatMetric(card.name, card.value)}</strong>
          </article>
        ))}
      </section>

      <details className="panel">
        <summary>指标口径（UAT 校验用）</summary>
        <ul className="definition-list">
          {METRIC_DEFINITIONS.map((item) => (
            <li key={item.key}>
              <b>{item.name}：</b>
              {item.formula}；分母范围：{item.denominator}
            </li>
          ))}
        </ul>
      </details>
    </main>
  );
}

