import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth, apiHandler } from "@/lib/auth";
import { personFromDb, personToDb, validatePersonFields } from "@/lib/mappers";
import type { Person } from "@/lib/types";

export async function GET() {
  return apiHandler(async () => {
    await requireAuth();
    const db = getDb();
    const rows = await db.query("SELECT * FROM people ORDER BY name ASC");
    return NextResponse.json(rows.map(personFromDb));
  });
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    await requireAuth();
    const db = getDb();
    const body: Omit<Person, "id" | "createdAt"> = await req.json();
    const validationError = validatePersonFields(body);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    const person: Person = {
      ...body,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    await db.run(
      `INSERT INTO people (id,name,also_known_as,gender,testament,birth_year,death_year,description,tags,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      personToDb(person) as (string | number | null)[]
    );
    return NextResponse.json(person, { status: 201 });
  });
}
