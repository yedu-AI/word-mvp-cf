import type { AuthSession } from "../types";

const TOKEN_KEY = "word_mvp_token";
const ROLE_KEY = "word_mvp_role";

export function loadSession(): AuthSession | null {
  const token = localStorage.getItem(TOKEN_KEY) ?? "";
  const role = localStorage.getItem(ROLE_KEY) ?? "";
  if (!token || !role) return null;
  return { token, role };
}

export function saveSession(session: AuthSession): void {
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(ROLE_KEY, session.role);
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
}
