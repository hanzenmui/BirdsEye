import { NextRequest, NextResponse } from "next/server";
import { ownerApiHandler } from "@/lib/auth";
import { archiveRecord } from "@/lib/recovery";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return ownerApiHandler(req, async () => {
    const { id } = await params;
    return NextResponse.json({ ok: true, recoveryId: await archiveRecord("relationship", id) });
  });
}
