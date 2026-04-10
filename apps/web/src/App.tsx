import { useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import { fetchTodayTask, login, submitWordFeedback } from "./lib/api";
import { clearSession, loadSession, saveSession } from "./lib/session";
import LoginPage from "./pages/LoginPage";
import ReadingPage from "./pages/ReadingPage";
import StudyPage from "./pages/StudyPage";
import type { AuthSession, FeedbackResult, TodayTask } from "./types";

function ProtectedRoute(props: { session: AuthSession | null }) {
  if (!props.session) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

function AppRoutes() {
  const navigate = useNavigate();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [task, setTask] = useState<TodayTask | null>(null);
  const [message, setMessage] = useState("请先登录");
  const [loadingTask, setLoadingTask] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    const current = loadSession();
    if (!current) return;
    setSession(current);
    void refreshTask(current.token, false);
  }, []);

  async function refreshTask(token = session?.token ?? "", announce = true): Promise<void> {
    if (!token) return;
    setLoadingTask(true);
    try {
      const data = await fetchTodayTask(token);
      setTask(data);
      if (announce) {
        setMessage(`任务更新：复习 ${data.reviewWords}，新词 ${data.newWords}`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "拉取任务失败");
    } finally {
      setLoadingTask(false);
    }
  }

  async function handleLogin(username: string, password: string): Promise<void> {
    if (!username || !password) {
      setMessage("请输入账号和密码");
      return;
    }
    setLoggingIn(true);
    try {
      const result = await login(username, password);
      const auth: AuthSession = {
        token: result.token,
        role: result.user.role
      };
      setSession(auth);
      saveSession(auth);
      setMessage(`登录成功，角色：${result.user.role}`);
      await refreshTask(auth.token, false);
      navigate("/study", { replace: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登录失败");
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleFeedback(wordId: number, result: FeedbackResult): Promise<void> {
    if (!session?.token) return;
    try {
      await submitWordFeedback(session.token, wordId, result);
      setMessage(`反馈已提交：${result}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "反馈提交失败");
    }
  }

  function handleLogout() {
    clearSession();
    setSession(null);
    setTask(null);
    setMessage("已退出登录");
    navigate("/login", { replace: true });
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage onLogin={handleLogin} loading={loggingIn} message={message} />} />

      <Route element={<ProtectedRoute session={session} />}>
        <Route
          element={
            <AppLayout
              onRefreshTask={() => refreshTask(session?.token ?? "", true)}
              onLogout={handleLogout}
              loadingTask={loadingTask}
              taskDate={task?.date ?? null}
            />
          }
        >
          <Route path="/study" element={<StudyPage task={task} message={message} onFeedback={handleFeedback} />} />
          <Route path="/reading" element={session ? <ReadingPage token={session.token} task={task} /> : null} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={session ? "/study" : "/login"} replace />} />
    </Routes>
  );
}

export default function App() {
  return <AppRoutes />;
}
