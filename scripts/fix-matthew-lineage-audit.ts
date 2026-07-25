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
  const ramId = await resolveExisting("ram", "Ram", "Ram son of Hezron, Aram");
  const amminadabId = await resolveExisting("amminadab", "Amminadab", "Amminadab son of Ram");

  // ───────────────────────────────────────────────────────────────────────
  // Finding 1: ram.description (scripts/seed-matthew-lineage.ts line 120)
  // claims Matt 1:3-4 renders him "Aram," but the ESV's actual text reads
  // "Ram" ("Aram" is the KJV's manuscript-variant rendering, not this
  // project's ESV source of truth). Remove the inaccurate parenthetical.
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 1", `UPDATE people.description for ram (id: ${ramId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Son of Hezron, father of Amminadab. Listed in the genealogy from Judah to David (Ruth 4:19; 1 Chr 2:9; Matt 1:3-4).",
      ramId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 2: amminadab.description (scripts/seed-matthew-lineage.ts line
  // 130) reads "Also the father-in-law of Aaron, whose son Nahshon led
  // Judah in the wilderness" — "whose" grammatically attaches to the
  // nearest antecedent "Aaron," misreading Nahshon as Aaron's son. Nahshon
  // was Amminadab's own son (Exod 6:23; Num 1:7). Reword to remove the
  // ambiguity.
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 2", `UPDATE people.description for amminadab (id: ${amminadabId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Son of Ram and father of Nahshon, the prince of Judah during the Exodus. Also the father-in-law of Aaron (Exod 6:23) — Amminadab's own son Nahshon led Judah in the wilderness. Part of the Davidic lineage (Ruth 4:19–20; 1 Chr 2:10; Matt 1:4).",
      amminadabId,
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
