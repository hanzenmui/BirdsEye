import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/auth";
import { getReadyDb } from "@/lib/db";
import { createOwnerToken, ownerConfigured, ownerCookieOptions, OWNER_COOKIE, passcodeMatches, sameOriginRequest, validOwnerToken } from "@/lib/owner-session";
import { readSmallJson } from "@/lib/request-body";

const reply = (data: object, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req: NextRequest) {
  return reply({ owner: await validOwnerToken(req.cookies.get(OWNER_COOKIE)?.value), configured: ownerConfigured() });
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    if (!sameOriginRequest(req)) return reply({ error: "Open Birdseye directly to sign in." }, 403);
    if (!ownerConfigured()) return reply({ error: "Owner tools need ADMIN_PASSCODE (8+ characters) and AUTH_SECRET (32+ characters) in the app’s hosting settings. Reading is still open." }, 503);
    if (!req.headers.get("content-type")?.includes("application/json")) return reply({ error: "Invalid sign-in request." }, 400);
    const body = await readSmallJson(req);
    if (!body || typeof body !== "object" || !("passcode" in body)) return reply({ error: "Enter a passcode." }, 400);
    const db = await getReadyDb();
    const now = Date.now();
    // This shared limit survives serverless restarts and multiple instances.
    // A client-provided IP cannot bypass the single-owner attempt counter.
    const [attempt] = await db.query<{ attempts: number; window_start: number }>(
      `INSERT INTO owner_login_attempts (id,window_start,attempts) VALUES ('owner',$1,1)
       ON CONFLICT(id) DO UPDATE SET
         attempts = CASE WHEN window_start <= $2 THEN 1 ELSE attempts + 1 END,
         window_start = CASE WHEN window_start <= $2 THEN $1 ELSE window_start END
       RETURNING attempts,window_start`, [now, now - 15 * 60 * 1000],
    );
    if (attempt.attempts > 10) {
      const response = reply({ error: "Too many sign-in attempts. Try again in 15 minutes." }, 429);
      response.headers.set("Retry-After", String(Math.max(1, Math.ceil((attempt.window_start + 900000 - now) / 1000))));
      return response;
    }
    if (!passcodeMatches(body?.passcode)) return reply({ error: "That passcode isn’t correct." }, 401);
    const response = reply({ owner: true, configured: true });
    response.cookies.set(OWNER_COOKIE, await createOwnerToken(), ownerCookieOptions);
    return response;
  });
}

export async function DELETE(req: NextRequest) {
  if (!sameOriginRequest(req)) return reply({ error: "Open Birdseye directly to sign out." }, 403);
  const response = reply({ owner: false });
  response.cookies.set(OWNER_COOKIE, "", { ...ownerCookieOptions, maxAge: 0 });
  return response;
}
