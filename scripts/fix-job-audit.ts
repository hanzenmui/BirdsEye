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
  const jobId = await resolveExisting("job", "Job");
  const zopharId = await resolveExisting("zophar", "Zophar", "Zophar the Naamathite");

  // ───────────────────────────────────────────────────────────────────────
  // Finding 1: job.description (scripts/seed-job.ts line 61) states God
  // "spoke from the whirlwind and rebuked them all" — "them" grammatically
  // refers back to "his three friends and Elihu." But Job 42:7-9 (ESV)
  // rebukes only Eliphaz "and your two friends" (42:7), named again in full
  // in 42:9 as Eliphaz, Bildad, and Zophar — Elihu is never named, addressed,
  // or rebuked anywhere in ch. 42. This also creates an internal DB
  // contradiction against the existing (correct) elihu.description field,
  // which already states "God does not rebuke Elihu at the end as he does
  // the three friends." Per the findings doc's proposed correction, limit
  // the rebuke to the three friends.
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 1", `UPDATE people.description for job (id: ${jobId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Man from the land of Uz, 'blameless and upright, one who feared God and turned away from evil.' Wealthiest man in the east — 7,000 sheep, 3,000 camels, 500 yoke of oxen. God pointed him out to the Adversary (ha-satan) as his finest servant; the Adversary was allowed to test him by stripping away everything. Job lost his livestock, servants, and all ten children in a single day, then was afflicted with painful sores from head to foot. Through all this he did not curse God. After his three friends and Elihu spoke, God spoke from the whirlwind — and afterward rebuked the three friends (though not Elihu) for not speaking rightly of him, as Job had. His fortunes were restored double.",
      jobId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 2: zophar.description (scripts/seed-job.ts line 76) claims his
  // silence in the third round of speeches "implying that Job's responses
  // silenced him" — a specific causal narrative the text never states. Job
  // 26:1 and 27:1 (ESV) attribute that portion of the book to Job, not
  // Zophar, but the text gives no explicit reason for Zophar's absence; the
  // scholarly discussion is genuinely disputed (mainstream: the friends'
  // shared argument had run out of steam, evidenced also by Bildad's own
  // unusually short third speech; minority: textual displacement of a
  // "missing third speech of Zophar"). Neither matches the DB's specific
  // "Job silenced him" framing. Per the findings doc's proposed correction,
  // remove the unstated causal clause while preserving the accurate
  // structural observation (two speeches, no third).
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 2", `UPDATE people.description for zophar (id: ${zopharId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Third of Job's friends, from Naamah. The most blunt and harsh; told Job that whatever he had suffered was less than his guilt deserved. Only speaks twice (chapters 11 and 20) — the text gives no explicit reason for his silence in the third round of speeches, though Bildad's own third speech is also unusually short, suggesting the friends' argument had run its course. Like the other two, condemned by God at the end.",
      zopharId,
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
