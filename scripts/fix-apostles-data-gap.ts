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

async function insertRel(aId: string, aName: string, type: string, bId: string, bName: string, notes: string) {
  await run(
    "apostles-data-gap",
    `INSERT relationship: ${aName} --${type}--> ${bName}`,
    {
      sql: `INSERT OR IGNORE INTO relationships (id,person_a_id,person_a_name,type,person_b_id,person_b_name,notes,created_at)
            VALUES (?,?,?,?,?,?,?,datetime('now'))`,
      args: [crypto.randomUUID(), aId, aName, type, bId, bName, notes],
    },
  );
}

async function insertRef(personId: string, personName: string, book: string, cs: number, vs: number, ce: number, ve: number, note: string) {
  await run(
    "apostles-data-gap",
    `INSERT scripture_ref for ${personName}: ${book} ${cs}:${vs}-${ce}:${ve}`,
    {
      sql: `INSERT OR IGNORE INTO scripture_refs (id,person_id,book,chapter_start,verse_start,chapter_end,verse_end,note,created_at)
            VALUES (?,?,?,?,?,?,?,?,datetime('now'))`,
      args: [crypto.randomUUID(), personId, book, cs, vs, ce, ve, note],
    },
  );
}

// ── main correction routine ─────────────────────────────────────────────────
// Data-gap fix (not a text correction): James son of Alphaeus, Thaddaeus, and
// Simon the Zealot exist as full person records (from the NT ministry seed)
// but were never linked to Jesus or given a scripture reference — the app's
// live-DB audit found all three fully isolated (0 relationships, 0 refs).
// This links each as a disciple_of Jesus and adds their shared appearance in
// the Twelve's naming (Matt 10:2-4).
async function main() {
  console.log(DRY_RUN ? "=== DRY RUN — no statements will be executed ===" : "=== LIVE RUN — mutating database ===");

  const jesusId = await resolveExisting("jesus", "Jesus", "Jesus of Nazareth, Jesus Christ, the Messiah");
  const jamesAlphaeusId = await resolveExisting("james_alphaeus", "James", "James son of Alphaeus, James the Less");
  const thaddaeusId = await resolveExisting("thaddaeus", "Thaddaeus", "Thaddaeus, Judas son of James, Lebbaeus");
  const simonZealotId = await resolveExisting("simon_zealot", "Simon", "Simon the Zealot, Simon the Canaanite");

  const apostles: [string, string, string][] = [
    [jamesAlphaeusId, names.james_alphaeus, "james_alphaeus"],
    [thaddaeusId, names.thaddaeus, "thaddaeus"],
    [simonZealotId, names.simon_zealot, "simon_zealot"],
  ];

  for (const [id, name] of apostles) {
    await insertRel(id, name, "disciple_of", jesusId, names.jesus, "One of the Twelve named in Matt 10:2-4");
    await insertRef(id, name, "Matthew", 10, 2, 10, 4, "Named among the Twelve apostles");
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

  if (!DRY_RUN) process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
