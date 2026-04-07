import { Hono } from "hono";
import { cors } from "hono/cors";
import authRoutes from "./routes/auth";
import tasksRoutes from "./routes/tasks";
import wordsRoutes from "./routes/words";
import { verifyJwt } from "./lib/jwt";
import type { Bindings, Variables } from "./types";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", cors());

app.get("/health", (c) => c.json({ ok: true, ts: Date.now() }));

app.route("/api/auth", authRoutes);

app.use("/api/*", async (c, next) => {
  if (c.req.path.startsWith("/api/auth")) {
    return next();
  }

  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = auth.slice(7);
  try {
    const payload = await verifyJwt(c.env.JWT_SECRET, token);
    c.set("userId", payload.sub);
    c.set("role", payload.role);
    return next();
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
});

app.route("/api/tasks", tasksRoutes);
app.route("/api/words", wordsRoutes);

export default app;
