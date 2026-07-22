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
  const jehoshaphatId = await resolveExisting("jehoshaphat", "Jehoshaphat", "Jehoshaphat king of Judah, son of Asa");
  const davidId = await resolveExisting("david", "David");
  const asaphId = await resolveExisting("asaph", "Asaph", "Asaph son of Berechiah");
  const jeduthunId = await resolveExisting("jeduthun", "Jeduthun", "Jeduthun the seer, Ethan the Ezrahite");

  // ───────────────────────────────────────────────────────────────────────
  // Finding 1: jehoshaphat.description (scripts/seed-chronicles.ts line 135)
  // misquotes 2 Chronicles 20:20. The ESV reads "Believe in the Lord your
  // God, and you will be established; believe his prophets, and you will
  // succeed" — the DB text says "Trust in the LORD your God and you will be
  // established," substituting "Trust" for "Believe." Since the field
  // presents this as a verbatim quotation ("Famously said '...'"), it must
  // match the ESV wording exactly, per the findings doc's proposed
  // correction.
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 1", `UPDATE people.description for jehoshaphat (id: ${jehoshaphatId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "One of Judah's better kings (~873–849 BC). Sent teachers throughout the land, established judges, and led the people in prayer against a coalition of enemies (2 Chr 17–20). Famously said 'Believe in the LORD your God, and you will be established'.",
      jehoshaphatId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 2: The relationship notes for david–ally_of–jeduthun (line 252),
  // asaph–ally_of–jeduthun (line 254), and heman–ally_of–jeduthun (line 255)
  // cite "1 Chr 15:17" / "1 Chr 15:17–19" as textual support for Jeduthun's
  // involvement, but Jeduthun is not named anywhere in 1 Chr 15:17-19 — that
  // verse range names Heman, Asaph, and Ethan (son of Kushaiah). The
  // Ethan-is-Jeduthun identification is a reasonable but never explicitly
  // stated inference elsewhere in Chronicles. Per the findings doc's
  // proposed correction (a), and the controller's decision, imprecise
  // "1 Chr 15:17" citations tied to Jeduthun are retargeted to 1 Chr
  // 16:41-42, where Jeduthun is named directly alongside Heman.
  //
  //   - Line 253 (asaph ally_of heman) is unaffected — both names ARE in
  //     15:17-19 — left alone, not touched by this script.
  //   - Line 255 (heman ally_of jeduthun) currently cites "1 Chr 25:1; 2 Chr
  //     5:12" (verified directly against the file, not "1 Chr 15:17" as the
  //     task brief's summary hedged) — 1 Chr 25:1 does name Jeduthun
  //     directly, so this citation is already accurate and out of Finding
  //     2's scope. No change made to line 255.
  // ───────────────────────────────────────────────────────────────────────

  // Finding 2 (david–ally_of–jeduthun, line 252): remove the imprecise
  // "1 Chr 15:17" portion — Jeduthun isn't named there either — keeping only
  // the accurate "1 Chr 16:41" reference. Controller extension beyond the
  // findings doc's literal scope (line 254 only), applied by direct
  // instruction.
  {
    const relId = await resolveRelationship(davidId, "ally_of", jeduthunId);
    await run("Finding 2", `UPDATE relationships.notes for david ally_of jeduthun (id: ${relId})`, {
      sql: `UPDATE relationships SET notes = ? WHERE id = ?`,
      args: [
        "David appointed Jeduthun (Ethan) as a chief musician (1 Chr 16:41)",
        relId,
      ],
    });
  }

  // Finding 2 (asaph–ally_of–jeduthun, line 254): retarget the citation from
  // 1 Chr 15:17-19 (doesn't name Jeduthun) to 1 Chr 16:41-42 (names him
  // directly, alongside Heman).
  {
    const relId = await resolveRelationship(asaphId, "ally_of", jeduthunId);
    await run("Finding 2", `UPDATE relationships.notes for asaph ally_of jeduthun (id: ${relId})`, {
      sql: `UPDATE relationships SET notes = ? WHERE id = ?`,
      args: [
        "Colleagues in the temple music ministry (1 Chr 16:41–42)",
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
