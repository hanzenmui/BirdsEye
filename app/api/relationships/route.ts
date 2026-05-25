import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth, apiHandler } from "@/lib/auth";
import { relationshipFromDb } from "@/lib/mappers";
import type { Relationship } from "@/lib/types";

export async function GET() {
  return apiHandler(async () => {
    await requireAuth();
    const db = getDb();
    const rows = await db.query("SELECT * FROM relationships ORDER BY created_at DESC");
    return NextResponse.json(rows.map(relationshipFromDb));
  });
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    await requireAuth();
    const db = getDb();
    const body: Omit<Relationship, "id" | "createdAt"> = await req.json();
    const rel: Relationship = { ...body, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    await db.run(
      `INSERT INTO relationships (id,person_a_id,person_a_name,type,person_b_id,person_b_name,notes,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [rel.id, rel.personAId, rel.personAName, rel.type, rel.personBId, rel.personBName, rel.notes, rel.createdAt]
    );
    return NextResponse.json(rel, { status: 201 });
  });
}
