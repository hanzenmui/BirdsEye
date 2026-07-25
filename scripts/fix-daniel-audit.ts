import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN ?? process.env.TURSO_DATABASE_TURSO_AUTH_TOKEN,
});

const DRY_RUN = process.argv.includes("--dry-run");

// ── helpers ────────────────────────────────────────────────────────────────
const existingIds: Record<string, string> = {};
const names: Record<string, string> = {};

// Resolve the DB id for a person already in the seed data, by exact name
// (and, when given, also_known_as) match. Throws if not found — this script
// must never silently proceed against a live DB with an unresolved id.
async function resolveExisting(key: string, name: string, alsoKnownAs?: string): Promise<string> {
  if (existingIds[key]) return existingIds[key];
  const row = alsoKnownAs !== undefined
    ? await db.execute({
        sql: "SELECT id, name FROM people WHERE name = ? AND also_known_as = ? LIMIT 1",
        args: [name, alsoKnownAs],
      })
    : await db.execute({
        sql: "SELECT id, name FROM people WHERE name = ? LIMIT 1",
        args: [name],
      });
  const r = row.rows[0] as unknown as { id: string; name: string } | undefined;
  if (!r) {
    throw new Error(
      `resolveExisting: could not find existing person for key="${key}" name="${name}" akas="${alsoKnownAs ?? ""}" — aborting, refusing to guess against live DB`
    );
  }
  existingIds[key] = r.id;
  names[key] = r.name;
  return r.id;
}

// Resolve the id of an existing scripture_refs row by (person_id, book,
// chapter_start, verse_start). Throws if zero or more than one match is
// found — this script must never mutate an ambiguous row on a live DB.
async function resolveScriptureRef(
  personId: string,
  book: string,
  chapterStart: number,
  verseStart: number
): Promise<string> {
  const row = await db.execute({
    sql: "SELECT id FROM scripture_refs WHERE person_id = ? AND book = ? AND chapter_start = ? AND verse_start = ?",
    args: [personId, book, chapterStart, verseStart],
  });
  if (row.rows.length === 0) {
    throw new Error(
      `resolveScriptureRef: no scripture_refs row found for (person_id=${personId}, book="${book}", chapter_start=${chapterStart}, verse_start=${verseStart})`
    );
  }
  if (row.rows.length > 1) {
    throw new Error(
      `resolveScriptureRef: ${row.rows.length} scripture_refs rows found for (person_id=${personId}, book="${book}", chapter_start=${chapterStart}, verse_start=${verseStart}) — ambiguous`
    );
  }
  return (row.rows[0] as unknown as { id: string }).id;
}

type Stmt = { sql: string; args: unknown[] };

const plannedStatements: { citation: string; description: string; stmt: Stmt }[] = [];

async function run(citation: string, description: string, stmt: Stmt) {
  plannedStatements.push({ citation, description, stmt });
  if (DRY_RUN) {
    console.log(`\n[${citation}] ${description}`);
    console.log(`  SQL:  ${stmt.sql.replace(/\s+/g, " ").trim()}`);
    console.log(`  ARGS: ${JSON.stringify(stmt.args)}`);
    return;
  }
  await db.execute({ sql: stmt.sql, args: stmt.args as (string | number | null)[] });
}

// ── main correction routine ─────────────────────────────────────────────────
async function main() {
  console.log(DRY_RUN ? "=== DRY RUN — no statements will be executed ===" : "=== LIVE RUN — mutating database ===");

  // Resolve all existing people this script needs to reference, up front.
  const danielId = await resolveExisting("daniel", "Daniel", "Belteshazzar");
  const nebId = await resolveExisting("neb", "Nebuchadnezzar");
  const hananiahId = await resolveExisting("hananiah", "Hananiah", "Shadrach");
  const mishaelId = await resolveExisting("mishael", "Mishael", "Meshach");
  const azariahId = await resolveExisting("azariah", "Azariah", "Abednego");

  // ───────────────────────────────────────────────────────────────────────
  // Finding 1: daniel.description (scripts/seed-daniel.ts line 85) says
  // Daniel "wrote on the wall that appeared at Belshazzar's feast" — but
  // Daniel 5:5 (ESV) is explicit that a disembodied hand did the writing;
  // Daniel's role was to read and interpret it (Dan 5:24-28). Reword to
  // attribute the action correctly.
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 1", `UPDATE people.description for daniel (id: ${danielId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Young man from Judah's royal or noble family, taken to Babylon by Nebuchadnezzar. Given the Babylonian name Belteshazzar. He and his three friends refused the king's food to avoid defilement; God gave them wisdom and Daniel the ability to understand visions and dreams. He interpreted Nebuchadnezzar's statue dream and read and interpreted the mysterious writing that appeared on the wall at Belshazzar's feast. Threw into a den of lions by Darius's officials for praying; God shut the lions' mouths. Received remarkable apocalyptic visions about four empires, the Ancient of Days, the Son of Man, and a seventy-weeks prophecy. A model of integrity, prayer, and courage across multiple empires.",
      danielId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 2: the scripture_refs row for Nebuchadnezzar (Daniel 1:1-4:37,
  // scripts/seed-daniel.ts line 142) has note "Dreams of statue and tree;
  // madness for seven years; restored" — omitting Nebuchadnezzar's
  // substantial role in Daniel 3 (commands the golden image and fiery
  // furnace, then blesses God) despite that chapter falling within the
  // cited range. Expand the note to include it.
  // ───────────────────────────────────────────────────────────────────────

  {
    const refId = await resolveScriptureRef(nebId, "Daniel", 1, 1);
    await run("Finding 2", `UPDATE scripture_refs.note for Nebuchadnezzar's Daniel 1:1-4:37 ref (id: ${refId})`, {
      sql: `UPDATE scripture_refs SET note = ? WHERE id = ?`,
      args: [
        "Dreams of statue and tree; commands the golden image and fiery furnace, then blesses the God who delivered Shadrach, Meshach, and Abednego; madness for seven years; restored",
        refId,
      ],
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // Finding 3: the scripture_refs rows for Hananiah, Mishael, and Azariah
  // (scripts/seed-daniel.ts lines 134-136) each start at Daniel 1:7 (their
  // renaming), but verse 6 is where the three are first named alongside
  // Daniel. Move each ref's start to 1:6.
  // ───────────────────────────────────────────────────────────────────────

  {
    const hananiahRefId = await resolveScriptureRef(hananiahId, "Daniel", 1, 7);
    await run("Finding 3a", `UPDATE scripture_refs.chapter_start/verse_start for hananiah (id: ${hananiahRefId}) from 1:7 to 1:6`, {
      sql: `UPDATE scripture_refs SET chapter_start = ?, verse_start = ? WHERE id = ?`,
      args: [1, 6, hananiahRefId],
    });
  }
  {
    const mishaelRefId = await resolveScriptureRef(mishaelId, "Daniel", 1, 7);
    await run("Finding 3b", `UPDATE scripture_refs.chapter_start/verse_start for mishael (id: ${mishaelRefId}) from 1:7 to 1:6`, {
      sql: `UPDATE scripture_refs SET chapter_start = ?, verse_start = ? WHERE id = ?`,
      args: [1, 6, mishaelRefId],
    });
  }
  {
    const azariahRefId = await resolveScriptureRef(azariahId, "Daniel", 1, 7);
    await run("Finding 3c", `UPDATE scripture_refs.chapter_start/verse_start for azariah (id: ${azariahRefId}) from 1:7 to 1:6`, {
      sql: `UPDATE scripture_refs SET chapter_start = ?, verse_start = ? WHERE id = ?`,
      args: [1, 6, azariahRefId],
    });
  }

  console.log(`\n${DRY_RUN ? "[DRY RUN] Would execute" : "Executed"} ${plannedStatements.length} statements.`);
  const counts = { insert: 0, update: 0, delete: 0, other: 0 };
  for (const p of plannedStatements) {
    const sql = p.stmt.sql.trim().toUpperCase();
    if (sql.startsWith("INSERT")) counts.insert++;
    else if (sql.startsWith("UPDATE")) counts.update++;
    else if (sql.startsWith("DELETE")) counts.delete++;
    else counts.other++;
  }
  console.log(`  INSERTs: ${counts.insert}`);
  console.log(`  UPDATEs: ${counts.update}`);
  console.log(`  DELETEs: ${counts.delete}`);
  if (counts.other) console.log(`  Other:   ${counts.other}`);

  if (!DRY_RUN) {
    process.exit(0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
