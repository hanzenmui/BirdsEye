import { NextRequest, NextResponse } from "next/server";
import { ownerApiHandler } from "@/lib/auth";
import { getReadyDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  return ownerApiHandler(req, async () => {
    const db = await getReadyDb();
    return NextResponse.json(await db.query("SELECT id,label,kind,deleted_at AS deletedAt FROM deleted_records ORDER BY deleted_at DESC"));
  });
}
