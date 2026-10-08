import { NextRequest, NextResponse } from "next/server";
import { ownerApiHandler } from "@/lib/auth";
import { restoreRecord } from "@/lib/recovery";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return ownerApiHandler(req, async () => {
    const { id } = await params;
    return NextResponse.json({ label: await restoreRecord(id) });
  });
}
