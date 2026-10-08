import { NextRequest, NextResponse } from "next/server";
import { ownerApiHandler } from "@/lib/auth";
import { exportLibrary } from "@/lib/recovery";

export async function GET(req: NextRequest) {
  return ownerApiHandler(req, async () => NextResponse.json(await exportLibrary(), {
    headers: { "Content-Disposition": `attachment; filename="birdseye-backup-${new Date().toISOString().slice(0, 10)}.json"` },
  }));
}
