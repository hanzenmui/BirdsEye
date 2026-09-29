import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { apiHandler } from "@/lib/auth";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const { id } = await params;
    await getDb().run("DELETE FROM scripture_refs WHERE id = $1", [id]);
    return NextResponse.json({ ok: true });
  });
}
