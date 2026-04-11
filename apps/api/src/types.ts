export type Role = "student" | "teacher" | "admin";

export type JwtPayload = {
  sub: string;
  role: Role;
  exp: number;
};

export type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_BASE_URL?: string;
  DEEPSEEK_MODEL?: string;
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
};

export type Variables = {
  userId: string;
  role: Role;
};
