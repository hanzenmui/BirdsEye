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

// Resolve the id of an existing relationship row by (person_a_id, type,
// person_b_id). Throws if zero or more than one match is found.
async function resolveRelationship(aId: string, type: string, bId: string): Promise<string> {
  const row = await db.execute({
    sql: "SELECT id FROM relationships WHERE person_a_id = ? AND type = ? AND person_b_id = ?",
    args: [aId, type, bId],
  });
  if (row.rows.length === 0) {
    throw new Error(`resolveRelationship: no relationship found for (${aId}, ${type}, ${bId})`);
  }
  if (row.rows.length > 1) {
    throw new Error(`resolveRelationship: ${row.rows.length} relationships found for (${aId}, ${type}, ${bId}) — ambiguous`);
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
  const matthiasUpperId = await resolveExisting("matthias_luke_upper", "Matthias", "Matthias son of Semein, in Luke's genealogy");
  const matthiasLowerId = await resolveExisting("matthias_luke_lower", "Matthias", "Matthias son of Amos, in Luke's genealogy lower");
  const semeinId = await resolveExisting("semein", "Semein", "Semein son of Josech, in Luke's genealogy");
  const maathId = await resolveExisting("maath", "Maath", "Maath son of Matthias, in Luke's genealogy");
  const amosLukeId = await resolveExisting("amos_luke", "Amos", "Amos son of Nahum, in Luke's genealogy");
  const josephLukeLowerId = await resolveExisting("joseph_luke_lower", "Joseph", "Joseph son of Matthias, in Luke's genealogy lower");
  const neriId = await resolveExisting("neri", "Neri", "Neri son of Melchi, in Luke's genealogy");

  // ───────────────────────────────────────────────────────────────────────
  // Finding 1: both Luke-genealogy "Matthias" people (Luke 3:25-26) are
  // misspelled — the ESV renders "Mattathias," not "Matthias." Fix both
  // person records' name/also_known_as/description, the four other
  // people's descriptions that cross-reference them, and both scripture_
  // refs notes.
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 1a", `UPDATE people (name, also_known_as, description) for matthias_luke_upper (id: ${matthiasUpperId})`, {
    sql: `UPDATE people SET name = ?, also_known_as = ?, description = ? WHERE id = ?`,
    args: [
      "Mattathias",
      "Mattathias son of Semein, in Luke's genealogy",
      "Son of Semein and father of Maath in Luke's genealogy of Jesus (Luke 3:26). Not the same name as the apostle Matthias chosen in Acts 1, despite the similar spelling; known only from this genealogical record.",
      matthiasUpperId,
    ],
  });

  await run("Finding 1b", `UPDATE people (name, also_known_as, description) for matthias_luke_lower (id: ${matthiasLowerId})`, {
    sql: `UPDATE people SET name = ?, also_known_as = ?, description = ? WHERE id = ?`,
    args: [
      "Mattathias",
      "Mattathias son of Amos, in Luke's genealogy lower",
      "Son of Amos and father of Joseph in Luke's genealogy of Jesus (Luke 3:25). Known only from this genealogical record.",
      matthiasLowerId,
    ],
  });

  await run("Finding 1c", `UPDATE people.description for semein (id: ${semeinId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Son of Josech and father of Mattathias in Luke's genealogy of Jesus (Luke 3:26). Known only from this genealogical record.",
      semeinId,
    ],
  });

  await run("Finding 1d", `UPDATE people.description for maath (id: ${maathId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Son of Mattathias and father of Naggai in Luke's genealogy of Jesus (Luke 3:26). Known only from this genealogical record.",
      maathId,
    ],
  });

  await run("Finding 1e", `UPDATE people.description for amos_luke (id: ${amosLukeId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Son of Nahum and father of Mattathias in Luke's genealogy of Jesus (Luke 3:25). Not the prophet Amos; known only from this genealogical record.",
      amosLukeId,
    ],
  });

  await run("Finding 1f", `UPDATE people.description for joseph_luke_lower (id: ${josephLukeLowerId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Son of Mattathias and father of Jannai in Luke's genealogy of Jesus (Luke 3:24). Not the OT patriarch Joseph nor NT Joseph husband of Mary; known only from this genealogical record.",
      josephLukeLowerId,
    ],
  });

  {
    const refId = await resolveScriptureRef(matthiasUpperId, "Luke", 3, 26);
    await run("Finding 1g", `UPDATE scripture_refs.note for matthias_luke_upper's Luke 3:26 ref (id: ${refId})`, {
      sql: `UPDATE scripture_refs SET note = ? WHERE id = ?`,
      args: ["Mattathias son of Semein in Luke's genealogy", refId],
    });
  }
  {
    const refId = await resolveScriptureRef(matthiasLowerId, "Luke", 3, 25);
    await run("Finding 1h", `UPDATE scripture_refs.note for matthias_luke_lower's Luke 3:25 ref (id: ${refId})`, {
      sql: `UPDATE scripture_refs SET note = ? WHERE id = ?`,
      args: ["Mattathias son of Amos in Luke's genealogy", refId],
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // Finding 2: neri.description and the Neri→Shealtiel relationship note
  // both say "Matthew says son of Jehoiachin," but Matthew 1:12 (ESV)
  // reads "Jechoniah." Same historical king, wrong wording attributed to
  // the text.
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 2a", `UPDATE people.description for neri (id: ${neriId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Son of Melchi and father of Shealtiel in Luke's genealogy (Luke 3:27). Luke says Shealtiel is son of Neri, while Matthew says son of Jechoniah — a longstanding theological discrepancy possibly explained by levirate marriage or adoption.",
      neriId,
    ],
  });

  {
    const shealtielId = await resolveExisting("shealtiel", "Shealtiel", "Shealtiel son of Jeconiah, Salathiel");
    const relId = await resolveRelationship(neriId, "parent_of", shealtielId);
    await run("Finding 2b", `UPDATE relationships.notes for neri parent_of Shealtiel (id: ${relId})`, {
      sql: `UPDATE relationships SET notes = ? WHERE id = ?`,
      args: [
        "Luke says Shealtiel is son of Neri (Luke 3:27); Matthew says son of Jechoniah (Matt 1:12) — a theological discrepancy possibly explained by levirate marriage or adoption",
        relId,
      ],
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
