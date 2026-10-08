import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/auth";
import { getReadyDb } from "@/lib/db";
import { BIBLE_BOOKS } from "@/lib/types";
import { historicalEventFromDb, scriptureRefFromDb } from "@/lib/mappers";

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const book = req.nextUrl.searchParams.get("book");
    const rawChapter = req.nextUrl.searchParams.get("chapter") ?? "";
    const chapter = Number(rawChapter);
    if (!BIBLE_BOOKS.some(b => b.name === book) || !/^\d+$/.test(rawChapter) || chapter < 1 || chapter > 150) {
      return NextResponse.json({ error: "Choose a Bible book and chapter." }, { status: 400 });
    }
    const db = await getReadyDb();
    const refs = await db.query(
      `SELECT * FROM scripture_refs WHERE book=$1 AND chapter_start <= $2 AND chapter_end >= $3
       AND event_id IS NOT NULL AND event_id != '' ORDER BY chapter_start,verse_start`, [book, chapter, chapter],
    );
    const events = await db.query(
      `SELECT DISTINCT e.* FROM historical_events e JOIN scripture_refs sr ON sr.event_id=e.id
       WHERE sr.book=$1 AND sr.chapter_start <= $2 AND sr.chapter_end >= $3 ORDER BY e.year_bc DESC,e.rowid ASC`,
      [book, chapter, chapter],
    );
    return NextResponse.json({ events: events.map(historicalEventFromDb), refs: refs.map(scriptureRefFromDb) });
  });
}
