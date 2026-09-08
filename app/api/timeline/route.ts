import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth, apiHandler } from "@/lib/auth";
import { personFromDb, historicalEventFromDb, prophecyLinkFromDb, scriptureRefFromDb } from "@/lib/mappers";

export async function GET() {
  return apiHandler(async () => {
    await requireAuth();
    const db = getDb();
    const [people, events, links, eventRefs, personBookRows] = await Promise.all([
      db.query("SELECT * FROM people WHERE timeline_start_bc IS NOT NULL ORDER BY timeline_start_bc DESC"),
      // rowid breaks ties within a year, which is the only ordering four
      // events sharing AD 30 have. Rows are seeded in narrative order, so the
      // triumphal entry still comes out before the cross and the cross before
      // Pentecost; without the tiebreak that week renders in arbitrary order.
      db.query("SELECT * FROM historical_events ORDER BY year_bc DESC, rowid ASC"),
      db.query("SELECT * FROM prophecy_links"),
      db.query(
        `SELECT * FROM scripture_refs WHERE event_id IS NOT NULL AND event_id != ''
         ORDER BY book ASC, chapter_start ASC, verse_start ASC`
      ),
      db.query<{ person_id: string; book: string }>(
        `SELECT DISTINCT sr.person_id, sr.book
         FROM scripture_refs sr
         JOIN people p ON p.id = sr.person_id
         WHERE p.timeline_start_bc IS NOT NULL AND sr.person_id != ''`
      ),
    ]);
    const personBooks: Record<string, string[]> = {};
    for (const row of personBookRows) {
      (personBooks[row.person_id] ||= []).push(row.book);
    }
    return NextResponse.json({
      people:        people.map(personFromDb),
      events:        events.map(historicalEventFromDb),
      prophecyLinks: links.map(prophecyLinkFromDb),
      eventRefs:     eventRefs.map(scriptureRefFromDb),
      personBooks,
    });
  });
}
