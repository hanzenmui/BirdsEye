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
// New-person keys → freshly minted UUIDs for this correction run.
const newIds: Record<string, string> = {};
// Existing-person keys → their real DB id, resolved by looking up name (and,
// where ambiguous, also_known_as) at runtime. Populated by resolveExisting().
const existingIds: Record<string, string> = {};
const names: Record<string, string> = {}; // key → display name for denormalized cols

function newId(key: string) {
  if (!newIds[key]) newIds[key] = crypto.randomUUID();
  return newIds[key];
}

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

// Resolve the id of an existing relationship row by its (a, type, b) triple,
// matched via the people ids. Throws if zero or more than one match is found
// — this script must never mutate an ambiguous row on a live DB.
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

// Resolve the id of an existing scripture_refs row by person_id + book +
// chapter_start + verse_start (the fields Finding 2's correction does NOT
// change — only chapter_end/verse_end are being corrected, so matching on
// the unchanged fields is what lets this resolver find the row both before
// and after the fix has been applied). Throws if zero or more than one match
// is found — same fail-loud philosophy as resolveExisting/resolveRelationship;
// this script must never mutate an ambiguous row on a live DB.
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
  const goliathId = await resolveExisting("goliath", "Goliath");
  const eliId = await resolveExisting("eli", "Eli");

  // ───────────────────────────────────────────────────────────────────────
  // Finding 1: goliath.description (scripts/seed-1samuel.ts line 170) states
  // Goliath's height as flat, uncontested fact ("over nine feet tall (six
  // cubits and a span)"), with no note of the well-documented 4QSam-a (Dead
  // Sea Scrolls)/Septuagint textual variant of "four cubits and a span"
  // (~6'9"). Per the findings doc's proposed correction: keep the ESV's
  // six-cubits reading as primary (this project's source-of-truth
  // convention) while adding a hedge noting the manuscript variant.
  // ───────────────────────────────────────────────────────────────────────

  // Finding 1
  await run("Finding 1", `UPDATE people.description for goliath (id: ${goliathId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Philistine champion from Gath. The Masoretic Text (followed by the ESV) gives his height as six cubits and a span, over nine feet tall; the Dead Sea Scrolls' 4QSam-a manuscript and the Septuagint read four cubits and a span (about 6'9\"). Wore a bronze helmet, scale armor weighing 125 pounds, bronze shin guards, and a bronze javelin. Challenged Israel to single combat for forty days. Killed by David with a single sling stone to the forehead, then beheaded with his own sword. His brother Lahmi is mentioned in Chronicles; other giants from Gath also appear in 2 Samuel 21.",
      goliathId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 2: eli's scripture_refs row (scripts/seed-1samuel.ts line 260)
  // has chapter_end/verse_end of 14:3, nine chapters past Eli's death at
  // 4:18, pointing at a genealogical cameo of a different person (Ahijah).
  // The note text ("misjudges Hannah; raises Samuel; death") already
  // accurately describes only chs. 1-4. Fix the ref end-point to 4:18.
  // ───────────────────────────────────────────────────────────────────────

  // Finding 2
  {
    const refId = await resolveScriptureRef(eliId, "1 Samuel", 1, 9);
    // Finding 2
    await run("Finding 2", `UPDATE scripture_refs chapter_end/verse_end for eli (id: ${refId}) from 14:3 to 4:18`, {
      sql: `UPDATE scripture_refs SET chapter_end = ?, verse_end = ? WHERE id = ?`,
      args: [4, 18, refId],
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // Finding 3: Abner "Saul's uncle" (scripts/seed-1samuel.ts line 158) —
  // controller decision: no action. The DB reproduces the ESV's own genuine
  // ambiguity in 1 Sam 14:50-51 rather than adding false certainty beyond
  // what the source text itself carries. No statement implemented.
  // ───────────────────────────────────────────────────────────────────────

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
