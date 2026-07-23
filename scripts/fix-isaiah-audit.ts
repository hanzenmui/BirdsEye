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
// chapter_start + verse_start (fields Finding 2's correction does NOT
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
  const maherShalalId = await resolveExisting("maher_shalal", "Maher-shalal-hash-baz", "Maher-shalal-hash-baz son of Isaiah");
  const ahazId = await resolveExisting("ahaz_judah", "Ahaz", "Ahaz king of Judah, son of Jotham");
  const hezekiahId = await resolveExisting("hezekiah", "Hezekiah");

  // ───────────────────────────────────────────────────────────────────────
  // Finding 1: maher_shalal.description (scripts/seed-isaiah.ts line 151)
  // quotes the name-meaning gloss as "Swift is the booty, speedy is the
  // prey," but the ESV's own footnote on Isaiah 8:1 translates the name as
  // "The spoil speeds, the prey hastens." The quoted phrase does not match
  // the ESV's actual wording. Per the findings doc's proposed correction,
  // replace the quoted phrase with the ESV's actual footnote wording.
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 1", `UPDATE people.description for maher_shalal (id: ${maherShalalId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Isaiah's second son, whose name means 'The spoil speeds, the prey hastens' (Isaiah 8:1 ESV footnote). Born as a prophetic sign of the imminent fall of Damascus and Samaria (Isaiah 8:1–4).",
      maherShalalId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 2: the ahaz_judah scripture_refs row for Isaiah 7:1–12 (scripts/
  // seed-isaiah.ts line 188) is captioned "Isaiah meets Ahaz with the
  // Immanuel sign," but the Immanuel sign itself — "the virgin shall
  // conceive... shall call his name Immanuel" — is given in verse 14, one
  // verse past the ref's stated end (7:12). The range and its own note are
  // mismatched. Per the findings doc's proposed correction, extend
  // chapter_end/verse_end from 7:12 to 7:14 so the range actually contains
  // the verse the note describes. The note text itself is accurate and is
  // NOT changed — only the range needs to grow. Resolve by chapter_start/
  // verse_start (7:1), which do not change, so the row is findable both
  // before and after the fix is applied.
  // ───────────────────────────────────────────────────────────────────────

  {
    const refId = await resolveScriptureRef(ahazId, "Isaiah", 7, 1);
    await run("Finding 2", `UPDATE scripture_refs.chapter_end/verse_end for ahaz_judah Isaiah 7:1 ref (id: ${refId})`, {
      sql: `UPDATE scripture_refs SET chapter_end = ?, verse_end = ? WHERE id = ?`,
      args: [7, 14, refId],
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // Finding 3: Hezekiah — named in the same Isaiah 1:1 superscription as
  // Uzziah, Jotham, and Ahaz — has no scripture_refs row anywhere in the
  // codebase pointing at Isaiah 1:1, unlike the other three kings named in
  // that verse (scripts/seed-isaiah.ts lines 184, 186, 187, each with the
  // note "One of the kings during Isaiah's ministry"). Per the findings
  // doc's proposed correction (controller decision, 2026-07-23), add a
  // matching ref for Hezekiah for symmetry.
  //
  // REMINDER (from the Wisdom books audit): scripture_refs has NO unique
  // constraint, so this INSERT is NOT idempotent — running this script live
  // more than once will create duplicate rows. This script must only ever
  // be run live exactly once (Task 3's job, not this task's).
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 3", `INSERT scripture_refs for hezekiah (id: ${hezekiahId}) — Isaiah 1:1`, {
    sql: `INSERT OR IGNORE INTO scripture_refs (id,person_id,book,chapter_start,verse_start,chapter_end,verse_end,note,created_at)
          VALUES (?,?,?,?,?,?,?,?,datetime('now'))`,
    args: [
      crypto.randomUUID(),
      hezekiahId,
      "Isaiah",
      1,
      1,
      1,
      1,
      "One of the kings during Isaiah's ministry",
    ],
  });

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
