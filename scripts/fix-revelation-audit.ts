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
  const antipasId = await resolveExisting("antipas", "Antipas", "Antipas martyr of Pergamum, faithful witness");
  const jezebelId = await resolveExisting("jezebel_thyatira", "Jezebel of Thyatira", "Jezebel of Thyatira, false prophetess");

  // ───────────────────────────────────────────────────────────────────────
  // Finding 1: antipas.description (scripts/seed-revelation.ts line 95)
  // quotes Rev 2:13 with three deviations — "was put to death" for "was
  // killed," "in your city" for "among you," and "where Satan lives" for
  // "where Satan dwells."
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 1", `UPDATE people.description for antipas (id: ${antipasId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "A Christian martyr in Pergamum described by the risen Christ as 'my faithful witness, who was killed among you, where Satan dwells' (Rev 2:13). Little else is known of him from scripture, but he is venerated as one of the earliest martyrs of Asia Minor.",
      antipasId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 2: jezebel_thyatira.description and her Revelation 2:20
  // scripture_refs note (scripts/seed-revelation.ts lines 104, 134) quote
  // "calls herself a prophet," but Rev 2:20 (ESV) reads "prophetess."
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 2a", `UPDATE people.description for jezebel_thyatira (id: ${jezebelId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "A false prophetess active in the church at Thyatira who 'calls herself a prophetess' and leads believers into sexual immorality and eating food sacrificed to idols (Rev 2:20). She is not the OT Jezebel (wife of Ahab) but a different person using the same symbolic name. The risen Christ warns of severe judgment on her and those who follow her teaching (Rev 2:20–25).",
      jezebelId,
    ],
  });

  {
    // This file creates two refs both starting at Rev 2:20 (one ending
    // 2:20, one ending 2:25) — resolveScriptureRef alone is ambiguous
    // between them, so disambiguate directly by chapter_end/verse_end too.
    const row = await db.execute({
      sql: "SELECT id FROM scripture_refs WHERE person_id = ? AND book = ? AND chapter_start = ? AND verse_start = ? AND chapter_end = ? AND verse_end = ?",
      args: [jezebelId, "Revelation", 2, 20, 2, 20],
    });
    if (row.rows.length !== 1) {
      throw new Error(`Expected exactly 1 scripture_refs row for jezebel_thyatira Rev 2:20-2:20, found ${row.rows.length}`);
    }
    const refId = (row.rows[0] as unknown as { id: string }).id;
    await run("Finding 2b", `UPDATE scripture_refs.note for jezebel_thyatira's Rev 2:20-2:20 ref (id: ${refId})`, {
      sql: `UPDATE scripture_refs SET note = ? WHERE id = ?`,
      args: ["Jezebel rebuked for calling herself a prophetess and leading Thyatira astray", refId],
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
