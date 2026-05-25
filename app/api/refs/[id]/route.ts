import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth, apiHandler } from "@/lib/auth";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    await requireAuth();
    const { id } = await params;
    await getDb().run("DELETE FROM scripture_refs WHERE id = $1", [id]);
    return NextResponse.json({ ok: true });
  });
}
