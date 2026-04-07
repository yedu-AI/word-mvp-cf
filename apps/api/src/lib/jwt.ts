import { sign, verify } from "hono/jwt";
import type { JwtPayload } from "../types";

const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export async function issueJwt(secret: string, userId: string, role: JwtPayload["role"]): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign({ sub: userId, role, exp: now + TOKEN_TTL_SECONDS }, secret, "HS256");
}

export async function verifyJwt(secret: string, token: string): Promise<JwtPayload> {
  const payload = await verify(token, secret, "HS256");
  return payload as JwtPayload;
}
