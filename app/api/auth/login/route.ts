import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { timingSafeEqual } from "crypto";

const attempts = new Map<string, { count: number; lockedUntil: number }>();

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const now = Date.now();
  const state = attempts.get(ip) ?? { count: 0, lockedUntil: 0 };
  if (state.lockedUntil > now) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }
  const { passcode } = await req.json();
  const expected = Buffer.from(process.env.ADMIN_PASSCODE ?? "");
  const provided = Buffer.from(passcode ?? "");
  const valid = expected.length === provided.length && timingSafeEqual(expected, provided);
  if (!valid) {
    state.count++;
    if (state.count >= 5) state.lockedUntil = now + 15 * 60 * 1000;
    attempts.set(ip, state);
    return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });
  }
  attempts.delete(ip);
  const session = await getSession();
  session.authenticated = true;
  await session.save();
  return NextResponse.json({ ok: true });
}
