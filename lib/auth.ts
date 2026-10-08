import { NextRequest, NextResponse } from "next/server";
import { ownerDenial } from "./owner-session";
import { getReadyDb } from "./db";

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function ownerApiHandler(req: NextRequest, fn: () => Promise<NextResponse>) {
  return apiHandler(async () => {
    const denial = await ownerDenial(req);
    if (denial) return denial;
    await getReadyDb();
    const response = await fn();
    response.headers.set("Cache-Control", "no-store");
    return response;
  });
}

export async function apiHandler(fn: () => Promise<NextResponse>) {
  try {
    return await fn();
  } catch (e: unknown) {
    if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof SyntaxError) return NextResponse.json({ error: "Invalid request. Check your entries and retry." }, { status: 400 });
    const msg = e instanceof Error ? e.message : String(e);
    console.error(msg);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
