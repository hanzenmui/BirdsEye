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
  const pilateId = await resolveExisting("pilate", "Pontius Pilate", "Pilate, Pontius Pilate prefect of Judea");
  const agrippa1Id = await resolveExisting("herod_agrippa1", "Herod Agrippa I", "Herod Agrippa I, king of Judea");

  // ───────────────────────────────────────────────────────────────────────
  // Finding 1: pilate.description (scripts/seed-nt-passion.ts line 115)
  // says the cross inscription was in "Hebrew, Latin, and Greek," but the
  // ESV's primary text at John 19:20 reads "Aramaic, in Latin, and in
  // Greek" (with a footnote offering "Hebrew" as an alternate).
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 1", `UPDATE people.description for pilate (id: ${pilateId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Roman prefect of Judea c. 26–36 AD. Tried Jesus and found no guilt in him; attempted to release him using the Passover custom of releasing a prisoner; when the crowd chose Barabbas instead, washed his hands saying 'I am innocent of this man's blood'; had Jesus flogged; sentenced him to crucifixion under crowd pressure. His wife sent word: 'Have nothing to do with that righteous man, for I have suffered much because of him today in a dream.' Posted a sign above the cross: 'Jesus of Nazareth, King of the Jews' in Aramaic, Latin, and Greek. Refused to change it despite the chief priests' objections. Later recalled to Rome and his fate is unknown.",
      pilateId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 2: herod_agrippa1.description (scripts/seed-nt-passion.ts line
  // 153) quotes Acts 12:23 dropping the opening "Immediately," silently
  // omitting the causal clause "because he did not give God the glory"
  // with no ellipsis, and substituting "died" for "breathed his last."
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 2", `UPDATE people.description for herod_agrippa1 (id: ${agrippa1Id})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Grandson of Herod the Great, appointed king over most of his grandfather's territory by Emperor Claudius. To please the Jewish leadership, had James son of Zebedee executed by the sword — the first apostle martyred. When he saw it pleased them, also arrested Peter; an angel released Peter from prison the night before his scheduled trial. Died suddenly and gruesomely in Caesarea after accepting divine worship from a crowd: 'Immediately an angel of the Lord struck him down, because he did not give God the glory, and he was eaten by worms and breathed his last' (Acts 12:23). Not to be confused with Herod the Great, Herod Antipas, or Herod Agrippa II.",
      agrippa1Id,
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
