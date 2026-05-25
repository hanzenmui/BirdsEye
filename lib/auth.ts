import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

interface SessionData { authenticated: boolean }

const sessionOptions = {
  cookieName: "birdseye-session",
  password: process.env.AUTH_SECRET!,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
  },
};

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export async function requireAuth() {
  const session = await getSession();
  if (!session.authenticated) throw new Error("Unauthorized");
}

export async function requireAuthPage() {
  const session = await getSession();
  if (!session.authenticated) redirect("/login");
}

export async function apiHandler(fn: () => Promise<NextResponse>) {
  try {
    return await fn();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error(msg);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
