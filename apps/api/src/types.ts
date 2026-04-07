export type Role = "student" | "teacher" | "admin";

export type JwtPayload = {
  sub: string;
  role: Role;
  exp: number;
};

export type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

export type Variables = {
  userId: string;
  role: Role;
};
