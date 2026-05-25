import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth, apiHandler } from "@/lib/auth";
import { personFromDb, personToDb } from "@/lib/mappers";
import type { Person } from "@/lib/types";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    await requireAuth();
    const { id } = await params;
    const db = getDb();
    const patch: Partial<Person> = await req.json();
    const rows = await db.query<Record<string, unknown>>("SELECT * FROM people WHERE id = $1", [id]);
    if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const updated: Person = { ...personFromDb(rows[0]), ...patch };
    await db.run(
      `UPDATE people SET name=$2,also_known_as=$3,gender=$4,testament=$5,birth_year=$6,death_year=$7,description=$8,tags=$9,created_at=$10
       WHERE id=$1`,
      personToDb(updated) as (string | number | null)[]
    );
    return NextResponse.json(updated);
  });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    await requireAuth();
    const { id } = await params;
    const db = getDb();
    await db.run("DELETE FROM scripture_refs WHERE person_id = $1", [id]);
    await db.run("DELETE FROM relationships WHERE person_a_id = $1 OR person_b_id = $1", [id]);
    await db.run("DELETE FROM people WHERE id = $1", [id]);
    return NextResponse.json({ ok: true });
  });
}
