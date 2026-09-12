import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth, apiHandler } from "@/lib/auth";
import { traditionFromDb, traditionEdgeFromDb, traditionPersonFromDb } from "@/lib/mappers";

// Denominations, communions and movements, and the split/merge/influence
// edges between them — the data behind the Family Tree's "Traditions"
// picker group. See docs/superpowers/specs/2026-09-11-church-history-design.md.
export async function GET() {
  return apiHandler(async () => {
    await requireAuth();
    const db = getDb();
    const [traditions, edges, people] = await Promise.all([
      db.query("SELECT * FROM traditions ORDER BY start_year DESC"),
      db.query("SELECT * FROM tradition_edges ORDER BY year DESC"),
      db.query("SELECT * FROM tradition_people"),
    ]);
    return NextResponse.json({
      traditions: traditions.map(traditionFromDb),
      edges:      edges.map(traditionEdgeFromDb),
      people:     people.map(traditionPersonFromDb),
    });
  });
}
