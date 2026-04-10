import { NavLink, Outlet } from "react-router-dom";

type AppLayoutProps = {
  onRefreshTask: () => Promise<void>;
  onLogout: () => void;
  loadingTask: boolean;
  taskDate: string | null;
};

export default function AppLayout(props: AppLayoutProps) {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">W</span>
          <div>
            <p className="brand-name">Word Master</p>
            <p className="brand-sub">Apple-like Minimal Learning Flow</p>
          </div>
        </div>
        <div className="top-actions">
          <button className="ghost-btn" onClick={() => void props.onRefreshTask()} disabled={props.loadingTask}>
            {props.loadingTask ? "更新中..." : "刷新任务"}
          </button>
          <button className="ghost-btn" onClick={props.onLogout}>
            退出
          </button>
        </div>
      </header>

      <nav className="tabbar" aria-label="main">
        <NavLink to="/study" className={({ isActive }) => `tab ${isActive ? "is-active" : ""}`}>
          背单词
        </NavLink>
        <NavLink to="/reading" className={({ isActive }) => `tab ${isActive ? "is-active" : ""}`}>
          阅读测验
        </NavLink>
      </nav>

      <section className="content">
        <Outlet />
      </section>

      <footer className="footnote">{props.taskDate ? `今日任务日期 ${props.taskDate}` : "尚未拉取今日任务"}</footer>
    </main>
  );
}
