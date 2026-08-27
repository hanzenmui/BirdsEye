import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth, apiHandler } from "@/lib/auth";
import { personFromDb, historicalEventFromDb, prophecyLinkFromDb } from "@/lib/mappers";

export async function GET() {
  return apiHandler(async () => {
    await requireAuth();
    const db = getDb();
    const [people, events, links] = await Promise.all([
      db.query("SELECT * FROM people WHERE timeline_start_bc IS NOT NULL ORDER BY timeline_start_bc DESC"),
      db.query("SELECT * FROM historical_events ORDER BY year_bc DESC"),
      db.query("SELECT * FROM prophecy_links"),
    ]);
    return NextResponse.json({
      people:        people.map(personFromDb),
      events:        events.map(historicalEventFromDb),
      prophecyLinks: links.map(prophecyLinkFromDb),
    });
  });
}
