import { NextRequest, NextResponse } from "next/server";
import { getDb, getReadyDb } from "@/lib/db";
import { ApiError, apiHandler, ownerApiHandler } from "@/lib/auth";
import { relationshipFromDb, validateRelationshipType } from "@/lib/mappers";
import type { Relationship } from "@/lib/types";

export async function GET() {
  return apiHandler(async () => {
    const db = await getReadyDb();
    const rows = await db.query("SELECT * FROM relationships ORDER BY created_at DESC");
    return NextResponse.json(rows.map(relationshipFromDb));
  });
}

export async function POST(req: NextRequest) {
  return ownerApiHandler(req, async () => {
    const db = getDb();
    const body: Omit<Relationship, "id" | "createdAt"> = await req.json();
    if (!body || typeof body.personAId !== "string" || typeof body.personBId !== "string") return NextResponse.json({ error: "Choose two different people and a valid relationship." }, { status: 400 });
    const validationError = validateRelationshipType(body.type);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    if (typeof body.notes !== "string" || body.notes.length > 10000 || body.personAId === body.personBId) return NextResponse.json({ error: "Choose two different people and a valid relationship." }, { status: 400 });
    try {
      const rel = await db.transaction(async tx => {
        const endpoints = await tx.query<{ id: string; name: string }>("SELECT id,name FROM people WHERE id=$1 OR id=$2", [body.personAId, body.personBId]);
        if (endpoints.length !== 2) throw new ApiError("One of these people no longer exists.", 404);
        // Older libraries may still have legacy duplicates and therefore no
        // uniqueness index. Do not add new duplicates while preserving them.
        if ((await tx.query("SELECT id FROM relationships WHERE person_a_id=$1 AND type=$2 AND person_b_id=$3", [body.personAId, body.type, body.personBId])).length) {
          throw new ApiError("This relationship already exists between these two people.", 409);
        }
        const record: Relationship = { ...body, personAName: endpoints.find(p => p.id === body.personAId)!.name,
          personBName: endpoints.find(p => p.id === body.personBId)!.name, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
        await tx.run(
        `INSERT INTO relationships (id,person_a_id,person_a_name,type,person_b_id,person_b_name,notes,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [record.id, record.personAId, record.personAName, record.type, record.personBId, record.personBName, record.notes, record.createdAt]
        );
        return record;
      });
      return NextResponse.json(rel, { status: 201 });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/UNIQUE constraint failed/i.test(msg)) {
        return NextResponse.json(
          { error: "This relationship already exists between these two people." },
          { status: 409 }
        );
      }
      throw e;
    }
  });
}
