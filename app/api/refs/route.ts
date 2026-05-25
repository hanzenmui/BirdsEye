import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth, apiHandler } from "@/lib/auth";
import { scriptureRefFromDb } from "@/lib/mappers";
import type { ScriptureRef } from "@/lib/types";

export async function GET() {
  return apiHandler(async () => {
    await requireAuth();
    const db = getDb();
    const rows = await db.query("SELECT * FROM scripture_refs ORDER BY book ASC, chapter_start ASC, verse_start ASC");
    return NextResponse.json(rows.map(scriptureRefFromDb));
  });
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    await requireAuth();
    const db = getDb();
    const body: Omit<ScriptureRef, "id" | "createdAt"> = await req.json();
    const ref: ScriptureRef = { ...body, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    await db.run(
      `INSERT INTO scripture_refs (id,person_id,book,chapter_start,verse_start,chapter_end,verse_end,note,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [ref.id, ref.personId, ref.book, ref.chapterStart, ref.verseStart, ref.chapterEnd, ref.verseEnd, ref.note, ref.createdAt]
    );
    return NextResponse.json(ref, { status: 201 });
  });
}
