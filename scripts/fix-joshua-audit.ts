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
  // "Judah" is ambiguous in this DB (also present as "Judah son of Joseph, in
  // Luke's genealogy" via a separate seed file), so disambiguate via
  // also_known_as (empty string for the patriarch), matching the pattern
  // used in scripts/fix-genesis-audit.ts and scripts/fix-numbers-audit.ts.
  const judahId = await resolveExisting("judah", "Judah", "");
  const achanId = await resolveExisting("achan", "Achan", "Achar");
  // "Zerah" (son of Judah) was already added by scripts/fix-genesis-audit.ts
  // (Finding S3), which also already wired judah parent_of zerah and
  // tamar parent_of zerah. This script only needs to extend the chain
  // onward from Zerah through Zabdi/Carmi to Achan.
  const zerahId = await resolveExisting("zerah_judah", "Zerah", "Zerah son of Judah");

  // ───────────────────────────────────────────────────────────────────────
  // Finding 1: Achan's description (scripts/seed-joshua.ts line 99-102)
  // names two specific intermediate generations between Judah and Achan —
  // his father Carmi and grandfather Zabdi (also called Zimri in 1 Chr
  // 2:6) — per Josh 7:1 ("Achan the son of Carmi, son of Zabdi, son of
  // Zerah, of the tribe of Judah") and 1 Chr 2:6-7. But the only
  // relationship the seed file creates is a single generic
  // `Judah ancestor_of achan` link with no intervening person records.
  // "Zerah" (son of Judah) already exists in the DB, added by
  // scripts/fix-genesis-audit.ts (Finding S3), whose description already
  // reads "Ancestor of Achan" — but no person record or relationship
  // extends that chain from Zerah down through Zabdi/Carmi to Achan.
  // Correction: add Carmi and Zabdi (Zimri) person records and the direct
  // parent_of chain Zerah -> Zabdi -> Carmi -> Achan, matching the
  // structural-gap correction pattern already used for the equivalent
  // genealogical gaps in Genesis (Finding S3, Zerah himself) and Numbers
  // (Finding 7, the Manasseh -> Zelophehad chain), including deleting the
  // now-redundant coarse `Judah ancestor_of achan` relationship once the
  // full direct chain supersedes it — the same cleanup Numbers Finding 7
  // performed for `manasseh ancestor_of zelophehad`.
  // ───────────────────────────────────────────────────────────────────────

  // Finding 1: new person record for Zabdi (also called Zimri in 1 Chr
  // 2:6), son of Zerah and father of Carmi. Distinct key from the
  // unrelated "Zimri son of Salu" record in scripts/seed-numbers.ts.
  await insertPerson(
    "zabdi_zerah",
    {
      name: "Zabdi",
      alsoKnownAs: "Zabdi son of Zerah, called Zimri in 1 Chr 2:6",
      gender: "male",
      description:
        "Son of Zerah, grandson of Judah and Tamar. Called Zimri in 1 Chronicles 2:6. Father of Carmi. Named in Achan's genealogy (Josh 7:1). Not to be confused with Zimri son of Salu, the Simeonite leader killed by Phinehas at Peor (Num 25).",
      tags: ["tribe of israel"],
    },
    "Finding 1"
  );

  // Finding 1: new person record for Carmi, son of Zabdi and father of Achan
  await insertPerson(
    "carmi_zabdi",
    {
      name: "Carmi",
      alsoKnownAs: "Carmi son of Zabdi",
      gender: "male",
      description:
        "Son of Zabdi (Zimri), great-grandson of Judah. Father of Achan. Named in Achan's genealogy (Josh 7:1; 1 Chr 2:7).",
      tags: ["tribe of israel"],
    },
    "Finding 1"
  );

  // Finding 1: relationship — zerah parent_of zabdi_zerah
  await insertRel("zerah_judah", zerahId, "parent_of", "zabdi_zerah", newId("zabdi_zerah"), "Finding 1", "The sons of Zerah: Zimri (1 Chr 2:6)");
  // Finding 1: relationship — zabdi_zerah parent_of carmi_zabdi
  await insertRel("zabdi_zerah", newId("zabdi_zerah"), "parent_of", "carmi_zabdi", newId("carmi_zabdi"), "Finding 1", "The son of Carmi: Achan (1 Chr 2:7), implying Zabdi/Zimri fathered Carmi");
  // Finding 1: relationship — carmi_zabdi parent_of achan
  await insertRel("carmi_zabdi", newId("carmi_zabdi"), "parent_of", "achan", achanId, "Finding 1", "Achan the son of Carmi (Josh 7:1; 1 Chr 2:7)");

  // Finding 1: scripture refs for the two new person records
  await insertRef("zabdi_zerah", newId("zabdi_zerah"), "Joshua", 7, 1, 7, 1, "Finding 1", "Achan the son of Carmi, son of Zabdi, son of Zerah, of the tribe of Judah");
  await insertRef("carmi_zabdi", newId("carmi_zabdi"), "Joshua", 7, 1, 7, 1, "Finding 1", "Achan the son of Carmi, son of Zabdi, son of Zerah, of the tribe of Judah");

  // Finding 1: delete the now-redundant coarse Judah ancestor_of Achan
  // relationship, superseded by the direct four-link parent_of chain
  // Judah -> Zerah -> Zabdi -> Carmi -> Achan (Judah -> Zerah already
  // existed via scripts/fix-genesis-audit.ts).
  {
    const relId = await resolveRelationship(judahId, "ancestor_of", achanId);
    // Finding 1
    await run("Finding 1", `DELETE relationship judah ancestor_of achan (id: ${relId})`, {
      sql: `DELETE FROM relationships WHERE id = ?`,
      args: [relId],
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // Finding 2: Achan's description (scripts/seed-joshua.ts line 101) omits
  // the gold item's stated weight and uses non-ESV phrasing. Josh 7:21 ESV:
  // "...two hundred shekels of silver and a bar of gold fifty shekels in
  // weight..." — the DB says only "a wedge of gold" with no weight given.
  // Correction: update the description to state the gold's weight and use
  // ESV-aligned "bar of gold" phrasing.
  // ───────────────────────────────────────────────────────────────────────

  // Finding 2
  await run("Finding 2", `UPDATE people.description for achan (id: ${achanId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Son of Carmi, of the clan of Zabdi (Zimri), from the tribe of Judah. Violated the ban (herem) on Jericho by secretly taking a Babylonian robe, 200 shekels of silver, and a bar of gold weighing 50 shekels and hiding them under his tent. His sin caused Israel's catastrophic defeat at Ai. Identified by lot, he confessed and was stoned along with his family and possessions in the Valley of Achor. His name was later rendered 'Achar' (meaning 'trouble') in Chronicles.",
      achanId,
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
