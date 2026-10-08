import { NextRequest, NextResponse } from "next/server";
import { getDb, getReadyDb } from "@/lib/db";
import { ApiError, apiHandler, ownerApiHandler } from "@/lib/auth";
import { scriptureRefFromDb } from "@/lib/mappers";
import type { ScriptureRef } from "@/lib/types";
import { BIBLE_BOOKS } from "@/lib/types";

export async function GET() {
  return apiHandler(async () => {
    const db = await getReadyDb();
    const rows = await db.query(
      `SELECT * FROM scripture_refs
       WHERE event_id IS NULL OR event_id = ''
       ORDER BY book ASC, chapter_start ASC, verse_start ASC`
    );
    return NextResponse.json(rows.map(scriptureRefFromDb));
  });
}

export async function POST(req: NextRequest) {
  return ownerApiHandler(req, async () => {
    const db = getDb();
    const body: Omit<ScriptureRef, "id" | "createdAt"> = await req.json();
    if (!body || typeof body.personId !== "string" || !BIBLE_BOOKS.some(b => b.name === body.book)
      || ![body.chapterStart, body.chapterEnd, body.verseStart, body.verseEnd].every(n => Number.isInteger(n) && n > 0 && n <= 200)
      || body.chapterEnd < body.chapterStart || (body.chapterEnd === body.chapterStart && body.verseEnd < body.verseStart)
      || typeof body.note !== "string" || body.note.length > 10000) {
      return NextResponse.json({ error: "Choose a Bible book and a valid chapter and verse range." }, { status: 400 });
    }
    const ref: ScriptureRef = { ...body, eventId: null, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    await db.transaction(async tx => {
      if (!(await tx.query("SELECT id FROM people WHERE id=$1", [body.personId])).length) throw new ApiError("This person no longer exists.", 404);
      await tx.run(
      `INSERT INTO scripture_refs (id,person_id,book,chapter_start,verse_start,chapter_end,verse_end,note,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [ref.id, ref.personId, ref.book, ref.chapterStart, ref.verseStart, ref.chapterEnd, ref.verseEnd, ref.note, ref.createdAt]
      );
    });
    return NextResponse.json(ref, { status: 201 });
  });
}
