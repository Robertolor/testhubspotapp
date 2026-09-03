import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

const COOKIE_NAME = "mbs_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export interface SessionPayload {
  tenantId: string;
  portalId: number;
  exp: number;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not configured");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function encodeSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = sign(body);
  return `${body}.${sig}`;
}

export function decodeSession(token: string): SessionPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as SessionPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(
  tenantId: string,
  portalId: number
): Promise<void> {
  const payload: SessionPayload = {
    tenantId,
    portalId,
    exp: Date.now() + MAX_AGE_SEC * 1000,
  };
  const jar = await cookies();
  jar.set(COOKIE_NAME, encodeSession(payload), sessionCookieOptions(MAX_AGE_SEC));
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return decodeSession(token);
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", sessionCookieOptions(0));
}

export function attachClearedSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(COOKIE_NAME, "", sessionCookieOptions(0));
  return response;
}
