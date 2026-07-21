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
  const absalomId = await resolveExisting("absalom", "Absalom");
  const bathshebaId = await resolveExisting("bathsheba", "Bathsheba", "Bath-shua");
  const davidId = await resolveExisting("david", "David");

  // ───────────────────────────────────────────────────────────────────────
  // Finding 1: absalom.description (scripts/seed-2samuel.ts line 146) states
  // his hair weight as a bare modern unit ("five pounds") without citing the
  // ESV's actual unit ("two hundred shekels by the king's weight," 2 Sam
  // 14:26) or the "king's weight" qualifier. Per the findings doc's proposed
  // correction: cite the ESV's stated unit as primary, keep the modern
  // conversion as a readability gloss.
  // ───────────────────────────────────────────────────────────────────────

  // Finding 1
  await run("Finding 1", `UPDATE people.description for absalom (id: ${absalomId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Third son of David, born to Maacah daughter of the king of Geshur. Described as the most handsome man in all Israel — no blemish from head to foot, with hair so thick it weighed two hundred shekels (by the king's weight) when cut annually — roughly five pounds by common estimates. Killed Amnon in revenge for Tamar's rape; fled to Geshur for three years. Returned to Jerusalem; reconciled with David. Stole the hearts of Israel through flattery at the city gate. Declared himself king in Hebron; briefly occupied Jerusalem. Killed against David's orders by Joab when his hair caught in a terebinth tree. David's lament: 'O my son Absalom! My son, my son Absalom!'",
      absalomId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 2: bathsheba.description (scripts/seed-2samuel.ts line 120)
  // lists her sons as "Solomon, Shimea, Shobab, and Nathan," which matches
  // neither 2 Sam 5:14 ("Shammua, Shobab, Nathan, Solomon") nor 1 Chr 3:5
  // ("Shimea, Shobab, Nathan and Solomon") — both list Solomon last. Per the
  // findings doc's proposed correction: reorder to "Shimea, Shobab, Nathan,
  // and Solomon," keeping the DB's existing "Shimea" spelling choice.
  // ───────────────────────────────────────────────────────────────────────

  // Finding 2
  await run("Finding 2", `UPDATE people.description for bathsheba (id: ${bathshebaId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Wife of Uriah the Hittite. Seen bathing on a rooftop by David, who sent for her; she became pregnant. After David arranged Uriah's death, he took her as his wife. Their first child died as a consequence of Nathan's prophecy. She then bore Shimea, Shobab, Nathan, and Solomon. Later, at David's old age, she advocated successfully to Nathan and David for Solomon's coronation over Adonijah. Mother of Israel's wisest king.",
      bathshebaId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 3: David's second son Chileab (Daniel), born in Hebron to
  // Abigail (2 Sam 3:2-3; named "Daniel" in 1 Chr 3:1), has no person record
  // in scripts/seed-2samuel.ts even though his birth is adjacent to Amnon's
  // (firstborn) and Absalom's (third), both of whom are seeded. Controller
  // decision: implement option (a) — add the person record. Primary `name`
  // is "Chileab" (not "Daniel"), since scripts/seed-daniel.ts already seeds
  // an unrelated person with name "Daniel" (the prophet, alsoKnownAs
  // "Belteshazzar") — using "Chileab" as the primary name with "Daniel" as
  // alsoKnownAs avoids any collision with that existing record. This also
  // matches scripts/seed-1samuel.ts's own abigail.description, which
  // already refers to "David's son Chileab (also called Daniel)."
  // ───────────────────────────────────────────────────────────────────────

  // Finding 3
  await run("Finding 3", `INSERT OR IGNORE person chileab (id: ${newId("chileab")})`, {
    sql: `INSERT OR IGNORE INTO people (id,name,also_known_as,gender,testament,birth_year,death_year,description,tags,created_at)
          VALUES (?,?,?,?,'OT','','',?,?,datetime('now'))`,
    args: [
      newId("chileab"),
      "Chileab",
      "Daniel",
      "male",
      "David's second son, born in Hebron to Abigail, widow of Nabal of Carmel (2 Sam 3:2-3), also named Daniel (1 Chr 3:1). Unlike his brothers Amnon and Absalom, born just before and after him in the same Hebron king-list, Chileab has no narrative role anywhere in Scripture beyond this birth notice — an absence from which tradition has long inferred he died young.",
      JSON.stringify(["tribe of israel"]),
    ],
  });

  // Finding 3
  await run("Finding 3", `INSERT OR IGNORE relationship David parent_of Chileab`, {
    sql: `INSERT OR IGNORE INTO relationships (id,person_a_id,person_a_name,type,person_b_id,person_b_name,notes,created_at)
          VALUES (?,?,?,?,?,?,?,datetime('now'))`,
    args: [
      crypto.randomUUID(),
      davidId,
      names["david"] ?? "David",
      "parent_of",
      newId("chileab"),
      "Chileab",
      "Chileab, David's second son by Abigail, born in Hebron (2 Sam 3:3)",
    ],
  });

  // Finding 3
  await run("Finding 3", `INSERT OR IGNORE scripture_refs for chileab`, {
    sql: `INSERT OR IGNORE INTO scripture_refs (id,person_id,book,chapter_start,verse_start,chapter_end,verse_end,note,created_at)
          VALUES (?,?,?,?,?,?,?,?,datetime('now'))`,
    args: [
      crypto.randomUUID(),
      newId("chileab"),
      "2 Samuel",
      3,
      3,
      3,
      3,
      "David's second son by Abigail, born in Hebron; also named Daniel (1 Chr 3:1)",
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 4: Esh-baal/Merib-baal sourcing (both alsoKnownAs values are
  // attested only in 1 Chronicles, not 2 Samuel itself) — controller
  // decision: no action. The framing is accurate and consistent with the
  // codebase-wide alsoKnownAs convention; this is informational only. No
  // statement implemented.
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
