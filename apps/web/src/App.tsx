import { useState } from "react";

const API_BASE = "http://127.0.0.1:8787";

export default function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("请先登录");

  async function login() {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "登录失败");
      return;
    }
    setToken(data.token);
    setMessage(`登录成功，角色: ${data.user.role}`);
  }

  async function loadTodayTask() {
    const res = await fetch(`${API_BASE}/api/tasks/today`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "获取任务失败");
      return;
    }
    setMessage(`今日任务: 复习 ${data.reviewWords} / 新词 ${data.newWords} / 阅读 ${data.readingStatus}`);
  }

  return (
    <main className="container">
      <h1>Word MVP Cloudflare</h1>
      <p>{message}</p>
      <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" />
      <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" type="password" />
      <div className="actions">
        <button onClick={login}>登录</button>
        <button onClick={loadTodayTask} disabled={!token}>
          拉取今日任务
        </button>
      </div>
    </main>
  );
}
