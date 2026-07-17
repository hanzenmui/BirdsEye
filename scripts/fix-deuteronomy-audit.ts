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
  const row = alsoKnownAs
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
  // "Manasseh" is ambiguous in this DB (also present as "Manasseh king of
  // Judah" via scripts/seed-2kings.ts), so disambiguate via also_known_as,
  // matching the pattern used in scripts/fix-numbers-audit.ts and
  // scripts/fix-genesis-audit.ts.
  const manassehId = await resolveExisting("manasseh", "Manasseh", "Manasseh son of Joseph");
  const ogId = await resolveExisting("og", "Og");
  const sihonId = await resolveExisting("sihon", "Sihon");

  // ───────────────────────────────────────────────────────────────────────
  // Finding 1: `manasseh ruler_of og` (scripts/seed-deuteronomy.ts line 113)
  // inverts and mischaracterizes Deut 3:13. That verse has Moses granting
  // Og's already-conquered territory of Bashan to the half-tribe of
  // Manasseh as a land allotment — not Manasseh ruling over Og as a person.
  // Og was already dead by that point (Deut 3:3: struck down until no
  // survivor was left), so a person-to-person "ruler_of" relationship
  // between Manasseh and Og is not even coherent under a loose reading.
  // Every other `ruler_of` use in this codebase pairs a living authority
  // with a living subordinate person, confirming this relationship doesn't
  // fit the type's established semantic. Correction: delete it outright;
  // the accurate territorial-transfer fact already stands as prose in Og's
  // description and in the Deut 3:1-13 scripture ref attached to `og`.
  // ───────────────────────────────────────────────────────────────────────

  {
    const relId = await resolveRelationship(manassehId, "ruler_of", ogId);
    // Finding 1
    await run("Finding 1", `DELETE relationship manasseh ruler_of og (id: ${relId})`, {
      sql: `DELETE FROM relationships WHERE id = ?`,
      args: [relId],
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // Finding 2: `sihon enemy_of og` (scripts/seed-deuteronomy.ts line 110)
  // asserts direct hostility between Sihon and Og that no cited passage
  // supports. Numbers 21:21-35 and Deuteronomy 2:26-3:13 each place Sihon
  // and Og independently in battle against Israel, never against each
  // other; Deut 3:2 and 31:4 pair them only as a narrative
  // precedent/retrospective ("as he did to Sihon... [so to Og]"), not as
  // combatants. The inline comment in the seed file itself concedes the
  // real basis is that they are "structurally paired," not that they were
  // enemies of one another. Correction: delete it outright; the genuine
  // textual connection (Og's defeat narrated as a repeat of Sihon's) is
  // already captured by the existing `sihon` ref at Deut 3:2.
  // ───────────────────────────────────────────────────────────────────────

  {
    const relId = await resolveRelationship(sihonId, "enemy_of", ogId);
    // Finding 2
    await run("Finding 2", `DELETE relationship sihon enemy_of og (id: ${relId})`, {
      sql: `DELETE FROM relationships WHERE id = ?`,
      args: [relId],
    });
  }

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
