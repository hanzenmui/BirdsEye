import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth, apiHandler } from "@/lib/auth";
import { personFromDb, historicalEventFromDb, prophecyLinkFromDb, scriptureRefFromDb } from "@/lib/mappers";

export async function GET() {
  return apiHandler(async () => {
    await requireAuth();
    const db = getDb();
    const [people, events, links, eventRefs] = await Promise.all([
      db.query("SELECT * FROM people WHERE timeline_start_bc IS NOT NULL ORDER BY timeline_start_bc DESC"),
      db.query("SELECT * FROM historical_events ORDER BY year_bc DESC"),
      db.query("SELECT * FROM prophecy_links"),
      db.query(
        `SELECT * FROM scripture_refs WHERE event_id IS NOT NULL AND event_id != ''
         ORDER BY book ASC, chapter_start ASC, verse_start ASC`
      ),
    ]);
    return NextResponse.json({
      people:        people.map(personFromDb),
      events:        events.map(historicalEventFromDb),
      prophecyLinks: links.map(prophecyLinkFromDb),
      eventRefs:     eventRefs.map(scriptureRefFromDb),
    });
  });
}
