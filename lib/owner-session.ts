import { createHash, timingSafeEqual } from "node:crypto";
import { sealData, unsealData } from "iron-session";
import { NextRequest, NextResponse } from "next/server";

export const OWNER_COOKIE = "birdseye-owner";
export const OWNER_TTL = 8 * 60 * 60;

export function ownerConfigured() {
  return (process.env.ADMIN_PASSCODE?.length ?? 0) >= 8
    && (process.env.AUTH_SECRET?.length ?? 0) >= 32;
}

const digest = (value: string) => createHash("sha256").update(value).digest();
export function passcodeMatches(value: unknown) {
  return ownerConfigured() && typeof value === "string" && value.length <= 1024
    && timingSafeEqual(digest(value), digest(process.env.ADMIN_PASSCODE!));
}

// Rotating either credential invalidates existing sessions, not just new logins.
const credentialVersion = () => digest(`${process.env.AUTH_SECRET}:${process.env.ADMIN_PASSCODE}`).toString("hex");
type OwnerSession = { role: "owner"; expiresAt: number; version: string };

export async function createOwnerToken(now = Date.now()) {
  if (!ownerConfigured()) throw new Error("Owner access is not configured");
  return sealData({ role: "owner", expiresAt: now + OWNER_TTL * 1000, version: credentialVersion() }, {
    password: process.env.AUTH_SECRET!, ttl: OWNER_TTL,
  });
}

export async function validOwnerToken(token: string | undefined, now = Date.now()) {
  if (!ownerConfigured() || !token || token.length > 4096 || !/^[^~]+~2$/.test(token)) return false;
  try {
    const session = await unsealData<OwnerSession>(token, { password: process.env.AUTH_SECRET!, ttl: OWNER_TTL });
    return session.role === "owner" && Number.isFinite(session.expiresAt)
      && session.expiresAt > now && session.expiresAt <= now + OWNER_TTL * 1000
      && session.version === credentialVersion();
  } catch { return false; }
}

export const ownerCookieOptions = {
  httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const,
  path: "/", maxAge: OWNER_TTL,
};

export function sameOriginRequest(req: NextRequest) {
  return req.headers.get("origin") === req.nextUrl.origin
    && req.headers.get("sec-fetch-site") !== "cross-site";
}

export async function ownerDenial(req: NextRequest) {
  if (!await validOwnerToken(req.cookies.get(OWNER_COOKIE)?.value)) {
    return NextResponse.json({ error: "Sign in to owner tools to make changes." }, { status: 401 });
  }
  if (!["GET", "HEAD"].includes(req.method) && !sameOriginRequest(req)) {
    return NextResponse.json({ error: "Open Birdseye directly before making changes." }, { status: 403 });
  }
  return null;
}
