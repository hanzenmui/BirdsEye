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

async function insertPerson(
  key: string,
  p: { name: string; alsoKnownAs?: string; gender: string; description: string; tags: string[] },
  citation: string
) {
  names[key] = p.name;
  await run(citation, `INSERT person "${p.name}" (key: ${key})`, {
    sql: `INSERT OR IGNORE INTO people (id,name,also_known_as,gender,testament,birth_year,death_year,description,tags,created_at)
          VALUES (?,?,?,?,'OT','','',?,?,datetime('now'))`,
    args: [newId(key), p.name, p.alsoKnownAs ?? "", p.gender, p.description, JSON.stringify(p.tags)],
  });
}

async function insertRel(aKey: string, aId: string, type: string, bKey: string, bId: string, citation: string, notes?: string) {
  await run(citation, `INSERT relationship ${aKey} --${type}--> ${bKey}`, {
    sql: `INSERT OR IGNORE INTO relationships (id,person_a_id,person_a_name,type,person_b_id,person_b_name,notes,created_at)
          VALUES (?,?,?,?,?,?,?,datetime('now'))`,
    args: [crypto.randomUUID(), aId, names[aKey] ?? aKey, type, bId, names[bKey] ?? bKey, notes ?? ""],
  });
}

async function insertRef(
  key: string,
  personId: string,
  book: string,
  cs: number,
  vs: number,
  ce?: number,
  ve?: number,
  citation?: string,
  note?: string
) {
  await run(citation ?? "", `INSERT scripture_ref for ${key}: ${book} ${cs}:${vs}-${ce ?? cs}:${ve ?? vs}`, {
    sql: `INSERT OR IGNORE INTO scripture_refs (id,person_id,book,chapter_start,verse_start,chapter_end,verse_end,note,created_at)
          VALUES (?,?,?,?,?,?,?,?,datetime('now'))`,
    args: [crypto.randomUUID(), personId, book, cs, vs, ce ?? cs, ve ?? vs, note ?? ""],
  });
}

// ── main correction routine ─────────────────────────────────────────────────
async function main() {
  console.log(DRY_RUN ? "=== DRY RUN — no statements will be executed ===" : "=== LIVE RUN — mutating database ===");

  // Resolve all existing people this script needs to reference, up front.
  const hurId = await resolveExisting("hur", "Hur");
  const bezalelId = await resolveExisting("bezalel", "Bezalel");
  const hobabId = await resolveExisting("hobab", "Hobab");

  // ───────────────────────────────────────────────────────────────────────
  // Finding 1: Bezalel is recorded as Hur's direct son, skipping the real
  // intermediate generation, Uri (Exodus 31:2; 1 Chronicles 2:18-20). Add a
  // person record for Uri and replace the single hur→bezalel relationship
  // with two: hur→uri and uri→bezalel.
  // ───────────────────────────────────────────────────────────────────────

  // Finding 1: new person record for Uri, the missing intermediate generation
  await insertPerson(
    "uri",
    {
      name: "Uri",
      gender: "male",
      description:
        "Son of Hur, father of Bezalel, from the tribe of Judah. Exodus 31:2 names him as the link between Hur and his grandson Bezalel; 1 Chronicles 2:20 confirms 'Hur fathered Uri, and Uri fathered Bezalel.'",
      tags: [],
    },
    "Finding 1"
  );

  // Finding 1: delete the existing direct hur parent_of bezalel edge, which
  // flattens the three-generation Hur → Uri → Bezalel chain into one hop
  {
    const relId = await resolveRelationship(hurId, "parent_of", bezalelId);
    // Finding 1
    await run("Finding 1", `DELETE relationship hur parent_of bezalel (id: ${relId})`, {
      sql: `DELETE FROM relationships WHERE id = ?`,
      args: [relId],
    });
  }

  // Finding 1: replacement edge — hur parent_of uri
  await insertRel("hur", hurId, "parent_of", "uri", newId("uri"), "Finding 1", "Hur fathered Uri (1 Chronicles 2:20)");
  // Finding 1: replacement edge — uri parent_of bezalel
  await insertRel("uri", newId("uri"), "parent_of", "bezalel", bezalelId, "Finding 1", "Uri fathered Bezalel (Exodus 31:2; 1 Chronicles 2:20)");

  // Finding 1: scripture ref for the new Uri person record
  await insertRef("uri", newId("uri"), "Exodus", 31, 2, 31, 2, "Finding 1", "Bezalel the son of Uri, son of Hur, of the tribe of Judah");

  // ───────────────────────────────────────────────────────────────────────
  // Finding 2: hobab.description states only the "brother-in-law" reading of
  // Numbers 10:29 as settled fact, without acknowledging Judges 1:16/4:11's
  // competing "father-in-law" reading. Soften the description; no
  // relationship change (jethro parent_of hobab is retained as-is).
  // ───────────────────────────────────────────────────────────────────────

  // Finding 2
  await run("Finding 2", `UPDATE people.description for hobab (id: ${hobabId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Son of Jethro (Reuel), Moses' brother-in-law. Moses asked him to serve as a guide through the wilderness, using his knowledge of the terrain. His descendants settled in the Negev. (Numbers 10:29 is read here as identifying Reuel, not Hobab, as Moses' father-in-law, making Hobab a brother-in-law; Judges 1:16 and 4:11, however, call Hobab himself 'Moses' father-in-law,' so the exact relationship is debated.)",
      hobabId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 3: hur.description says "son of Caleb" with no qualifier, which
  // reads as Caleb son of Jephunneh (the spy — the only "caleb" person
  // record in the DB), a different, much later person from Hur's actual
  // father, Caleb son of Hezron (1 Chronicles 2:18-20). Clarify the
  // description; no relationship change (no relationship currently links
  // hur to the caleb/spy record).
  // ───────────────────────────────────────────────────────────────────────

  // Finding 3
  await run("Finding 3", `UPDATE people.description for hur (id: ${hurId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "From the tribe of Judah, son of Caleb son of Hezron (1 Chronicles 2:18-20) and Ephrath — not to be confused with Caleb son of Jephunneh, the spy. With Aaron, he held up Moses' hands during the battle against the Amalekites, ensuring Israel's victory. Helped govern Israel when Moses was on Sinai.",
      hurId,
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
