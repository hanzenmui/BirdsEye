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

// Check whether a relationship row already exists for the (a, type, b)
// triple. Unlike resolveRelationship, this does not throw when zero rows are
// found — it's used to decide whether an INSERT OR IGNORE is needed at all.
// This matters because relationships.id is the table's only PRIMARY KEY /
// unique constraint (no unique index on (person_a_id, type, person_b_id)),
// so a plain INSERT OR IGNORE with a freshly minted id would NOT be a no-op
// against an already-correct row — it would silently create a duplicate.
async function relationshipExists(aId: string, type: string, bId: string): Promise<boolean> {
  const row = await db.execute({
    sql: "SELECT id FROM relationships WHERE person_a_id = ? AND type = ? AND person_b_id = ?",
    args: [aId, type, bId],
  });
  return row.rows.length > 0;
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
  // Judah must be disambiguated via also_known_as = '' — the patriarch row
  // (scripts/seed-genesis.ts, insertPerson) has also_known_as = '', while the
  // distinct "Judah" from Luke's genealogy (scripts/seed-luke-lineage.ts) has
  // also_known_as = "Judah son of Joseph, in Luke's genealogy". A bare
  // `name = ?` lookup (as scripts/seed-ruth.ts's insertRelNameToLocal does)
  // has no structural guarantee of picking the patriarch row over the Luke
  // row — see Finding 1.
  const judahId = await resolveExisting("judah", "Judah", "");
  const elimelechId = await resolveExisting("elimelech", "Elimelech");
  const boazId = await resolveExisting("boaz", "Boaz");
  const jesseId = await resolveExisting("jesse", "Jesse");

  // ───────────────────────────────────────────────────────────────────────
  // Finding 1: `insertRelNameToLocal("Judah", "ancestor_of", ...)` in
  // scripts/seed-ruth.ts (lines 165-166, used for both Elimelech and Boaz)
  // resolves "Judah" via a bare `name = ?` lookup with no also_known_as
  // disambiguation and no ORDER BY. There are two "Judah" person rows in
  // this DB: the OT patriarch (also_known_as = '') and a distinct figure
  // from Luke 3:30's genealogy (also_known_as = "Judah son of Joseph, in
  // Luke's genealogy"). Under the documented seed order (seed:ruth runs
  // before seed:luke-lineage), the lookup currently resolves correctly to
  // the patriarch — the data is not currently wrong — but the mechanism
  // provides no structural guarantee of that outcome if seeds are ever run
  // out of order. This is a data-fix, not a seed-script-code-fix: since
  // scripts/seed-ruth.ts itself is not being re-run here, we instead
  // explicitly re-assert (INSERT OR IGNORE — idempotent no-op if the row
  // already correctly points at the patriarch) both `ancestor_of`
  // relationships against the disambiguated patriarch Judah id, giving the
  // live DB a structural guarantee independent of the seed script's lookup
  // mechanism. Scoped to the two Ruth-file relationships only, per the
  // audit's findings doc (the broader codebase-wide pattern also present in
  // scripts/seed-numbers.ts etc. is out of scope for this audit).
  // ───────────────────────────────────────────────────────────────────────

  // Finding 1: re-assert Judah (patriarch) -> Elimelech ancestor_of against the
  // disambiguated patriarch id, so the relationship no longer depends on
  // insertRelNameToLocal's unguarded bare-name lookup. Guarded by an explicit
  // existence check first: relationships.id is the table's only unique
  // constraint (no unique index on (person_a_id, type, person_b_id)), so a
  // bare INSERT OR IGNORE with a fresh id would create a duplicate row rather
  // than being a no-op if the correct relationship already exists (which,
  // per the findings doc, it currently does).
  if (await relationshipExists(judahId, "ancestor_of", elimelechId)) {
    console.log(
      `\n[Finding 1] Judah(patriarch, id: ${judahId}) -ancestor_of-> Elimelech(id: ${elimelechId}) already exists and is already correct — no statement needed.`
    );
  } else {
    await run(
      "Finding 1",
      `INSERT relationships row for Judah(patriarch, id: ${judahId}) -ancestor_of-> Elimelech(id: ${elimelechId})`,
      {
        sql: `INSERT OR IGNORE INTO relationships (id,person_a_id,person_a_name,type,person_b_id,person_b_name,notes,created_at)
              VALUES (?,?,?,?,?,?,?,datetime('now'))`,
        args: [
          crypto.randomUUID(),
          judahId,
          "Judah",
          "ancestor_of",
          elimelechId,
          "Elimelech",
          "Elimelech of Bethlehem in Judah (Ruth 1:1)",
        ],
      }
    );
  }

  // Finding 1: re-assert Judah (patriarch) -> Boaz ancestor_of against the
  // disambiguated patriarch id, so the relationship no longer depends on
  // insertRelNameToLocal's unguarded bare-name lookup. Same existence-check
  // guard as above, for the same reason.
  if (await relationshipExists(judahId, "ancestor_of", boazId)) {
    console.log(
      `\n[Finding 1] Judah(patriarch, id: ${judahId}) -ancestor_of-> Boaz(id: ${boazId}) already exists and is already correct — no statement needed.`
    );
  } else {
    await run(
      "Finding 1",
      `INSERT relationships row for Judah(patriarch, id: ${judahId}) -ancestor_of-> Boaz(id: ${boazId})`,
      {
        sql: `INSERT OR IGNORE INTO relationships (id,person_a_id,person_a_name,type,person_b_id,person_b_name,notes,created_at)
              VALUES (?,?,?,?,?,?,?,datetime('now'))`,
        args: [
          crypto.randomUUID(),
          judahId,
          "Judah",
          "ancestor_of",
          boazId,
          "Boaz",
          "Boaz of the clan of Elimelech, Bethlehem in Judah",
        ],
      }
    );
  }

  // ───────────────────────────────────────────────────────────────────────
  // Finding 2: Jesse's description (scripts/seed-ruth.ts line 135) states
  // "Father of King David and six other sons," matching 1 Chronicles
  // 2:13-15's count (7 total, David 7th) but conflicting with 1 Samuel
  // 17:12's count of eight sons total (7 others). Ruth's own text (4:17)
  // states no count at all — this detail is sourced from elsewhere in the
  // canon and the two sourced totals disagree. Applying the findings doc's
  // recommended Option 1 (minimal): keep "six" as primary (it's the more
  // specific, named list) but add a citation and acknowledge the
  // conflicting total from 1 Samuel, rather than stating one as settled
  // fact with no source.
  // ───────────────────────────────────────────────────────────────────────

  // Finding 2
  await run("Finding 2", `UPDATE people.description for jesse (id: ${jesseId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Son of Obed, grandson of Boaz and Ruth. Father of King David and (per 1 Chr 2:13-15) six other sons — though 1 Sam 17:12 counts eight sons total. The 'root of Jesse' became a messianic title (Isa 11:1, 10). Lived in Bethlehem of Judah.",
      jesseId,
    ],
  });

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
