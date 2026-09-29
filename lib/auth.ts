import { NextResponse } from "next/server";

export async function apiHandler(fn: () => Promise<NextResponse>) {
  try {
    return await fn();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(msg);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
