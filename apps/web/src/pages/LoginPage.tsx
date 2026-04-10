import { FormEvent, useState } from "react";

type LoginPageProps = {
  onLogin: (username: string, password: string) => Promise<void>;
  loading: boolean;
  message: string;
};

export default function LoginPage(props: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await props.onLogin(username.trim(), password);
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="eyebrow">Word Master</p>
        <h1>学员登录</h1>
        <p className="subtle">登录后进入背词与阅读两个独立学习界面</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            账号
            <input
              autoComplete="username"
              placeholder="请输入账号"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label>
            密码
            <input
              autoComplete="current-password"
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button type="submit" disabled={props.loading}>
            {props.loading ? "登录中..." : "登录并进入学习"}
          </button>
        </form>

        <p className="status-text">{props.message}</p>
      </section>
    </main>
  );
}
