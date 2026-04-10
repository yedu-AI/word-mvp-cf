import { Hono } from "hono";
import { z } from "zod";
import { issueJwt } from "../lib/jwt";
import { verifyPassword } from "../lib/password";
import type { Bindings } from "../types";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

const authRoutes = new Hono<{ Bindings: Bindings }>();
const DUMMY_HASH = "pbkdf2$120000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

authRoutes.get("/ping", (c) => c.json({ ok: true }));

authRoutes.post("/login", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const { username, password } = parsed.data;
  const user = await c.env.DB.prepare(
    "SELECT id, role, password_hash FROM users WHERE username = ? LIMIT 1"
  )
    .bind(username)
    .first<{ id: string; role: "student" | "teacher" | "admin"; password_hash: string }>();

  const passwordHash = user?.password_hash ?? DUMMY_HASH;
  const passwordMatched = await verifyPassword(password, passwordHash);
  if (!user || !passwordMatched) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const token = await issueJwt(c.env.JWT_SECRET, user.id, user.role);
  return c.json({ token, user: { id: user.id, role: user.role } });
});

export default authRoutes;
