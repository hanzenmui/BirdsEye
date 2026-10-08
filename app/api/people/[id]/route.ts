import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ApiError, ownerApiHandler } from "@/lib/auth";
import { archiveRecord } from "@/lib/recovery";
import { personFromDb, personToDb, validatePersonFields } from "@/lib/mappers";
import type { Person } from "@/lib/types";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return ownerApiHandler(req, async () => {
    const { id } = await params;
    const db = getDb();
    const raw: Partial<Person> = await req.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ApiError("Enter valid person details.", 400);
    // Strip immutable fields — client must not overwrite the primary key or timestamp
    const patch = Object.fromEntries(Object.entries(raw).filter(([key]) =>
      ["name", "alsoKnownAs", "gender", "testament", "birthYear", "deathYear", "description", "tags"].includes(key))) as Partial<Person>;
    const validationError = validatePersonFields(patch);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    const updated = await db.transaction(async tx => {
      const [existing] = await tx.query<Record<string, unknown>>("SELECT * FROM people WHERE id=$1", [id]);
      if (!existing) throw new ApiError("This person no longer exists.", 404);
      const person: Person = { ...personFromDb(existing), ...patch };
      await tx.run(
        `UPDATE people SET name=$2,also_known_as=$3,gender=$4,testament=$5,birth_year=$6,death_year=$7,description=$8,tags=$9,created_at=$10
         WHERE id=$1`, personToDb(person) as (string | number | null)[],
      );
      if (person.name !== existing.name) {
        await tx.run("UPDATE relationships SET person_a_name=$2 WHERE person_a_id=$1", [id, person.name]);
        await tx.run("UPDATE relationships SET person_b_name=$2 WHERE person_b_id=$1", [id, person.name]);
      }
      return person;
    });
    return NextResponse.json(updated);
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return ownerApiHandler(req, async () => {
    const { id } = await params;
    return NextResponse.json({ ok: true, recoveryId: await archiveRecord("person", id) });
  });
}
