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
  const shealtielId = await resolveExisting("shealtiel", "Shealtiel", "Shealtiel son of Jeconiah, Salathiel");
  const zerubbabelId = await resolveExisting("zerubbabel", "Zerubbabel");

  // ───────────────────────────────────────────────────────────────────────
  // Finding 1: shealtiel.description (scripts/seed-late-kings.ts line 135)
  // and the shealtiel–parent_of–Zerubbabel relationship's notes field
  // (line 156) both cite 1 Chr 3:17 as if it supports "Shealtiel father of
  // Zerubbabel," but 1 Chr 3:18-19 (same chapter, same list) names Pedaiah
  // — Shealtiel's brother — as Zerubbabel's actual father. This is a
  // genuine, well-documented genealogical crux (Matt 1:12 and Ezra 3:2 both
  // say Shealtiel; Chronicles' plain reading says Pedaiah), commonly
  // harmonized via levirate succession. Per the findings doc's proposed
  // correction: soften the wording on both fields to acknowledge the
  // tension rather than assert one side as settled fact. The
  // shealtiel–parent_of–Zerubbabel relationship itself is kept unchanged
  // (majority/traditional Matthew-genealogy reading), matching how this
  // series has handled other genuine textual cruxes (e.g. Judges'
  // Othniel/Caleb ambiguity).
  // ───────────────────────────────────────────────────────────────────────

  // Finding 1 (shealtiel.description)
  await run("Finding 1", `UPDATE people.description for shealtiel (id: ${shealtielId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Son of Jehoiachin (Jeconiah). Called father of Zerubbabel in the Matthew genealogy and in Ezra 3:2/Hag 1:1, though 1 Chronicles 3:19 names Zerubbabel's father as Pedaiah, Shealtiel's brother — a genealogical tension often reconciled via levirate succession. A key link in the Matthew genealogy bridging the Babylonian exile to the return and the eventual line of Joseph, husband of Mary (Matt 1:12; 1 Chr 3:17-19; Ezra 3:2).",
      shealtielId,
    ],
  });

  // Finding 1 (shealtiel–parent_of–Zerubbabel relationship notes)
  {
    const relId = await resolveRelationship(shealtielId, "parent_of", zerubbabelId);
    await run("Finding 1", `UPDATE relationships.notes for shealtiel parent_of zerubbabel (id: ${relId})`, {
      sql: `UPDATE relationships SET notes = ? WHERE id = ?`,
      args: [
        "Zerubbabel is called son of Shealtiel in Matt 1:12, Ezra 3:2, and Hag 1:1, though 1 Chr 3:19 names Pedaiah (Shealtiel's brother) as his father — commonly harmonized via levirate marriage.",
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
