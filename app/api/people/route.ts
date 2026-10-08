import { NextRequest, NextResponse } from "next/server";
import { getDb, getReadyDb } from "@/lib/db";
import { apiHandler, ownerApiHandler } from "@/lib/auth";
import { personFromDb, personToDb, validatePersonFields } from "@/lib/mappers";
import type { Person } from "@/lib/types";

export async function GET() {
  return apiHandler(async () => {
    const db = await getReadyDb();
    const rows = await db.query("SELECT * FROM people ORDER BY name ASC");
    return NextResponse.json(rows.map(personFromDb));
  });
}

export async function POST(req: NextRequest) {
  return ownerApiHandler(req, async () => {
    const db = getDb();
    const body: Omit<Person, "id" | "createdAt"> = await req.json();
    const validationError = validatePersonFields(body);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    if (!body.name?.trim()) return NextResponse.json({ error: "Enter a name." }, { status: 400 });
    const person: Person = {
      ...body, name: body.name.trim(),
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
