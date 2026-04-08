import { Hono } from "hono";
import { z } from "zod";
import { issueJwt } from "../lib/jwt";
import type { Bindings } from "../types";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

const authRoutes = new Hono<{ Bindings: Bindings }>();

authRoutes.get("/ping", (c) => c.json({ ok: true }));

authRoutes.post("/login", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const { username, password } = parsed.data;
  const user = await c.env.DB.prepare(
    "SELECT id, role FROM users WHERE username = ? AND password_hash = ? LIMIT 1"
  )
    .bind(username, password)
    .first<{ id: string; role: "student" | "teacher" | "admin" }>();

  if (!user) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const token = await issueJwt(c.env.JWT_SECRET, user.id, user.role);
  return c.json({ token, user: { id: user.id, role: user.role } });
});

export default authRoutes;
