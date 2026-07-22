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

// Resolve the id of an existing scripture_refs row by person_id + book +
// chapter_start + verse_start (fields Finding 2's correction does NOT
// change — only the note text is being corrected, so matching on the
// unchanged fields is what lets this resolver find the row both before and
// after the fix has been applied). Throws if zero or more than one match is
// found — same fail-loud philosophy as resolveExisting/resolveRelationship;
// this script must never mutate an ambiguous row on a live DB.
async function resolveScriptureRef(
  personId: string,
  book: string,
  chapterStart: number,
  verseStart: number
): Promise<string> {
  const row = await db.execute({
    sql: "SELECT id FROM scripture_refs WHERE person_id = ? AND book = ? AND chapter_start = ? AND verse_start = ?",
    args: [personId, book, chapterStart, verseStart],
  });
  if (row.rows.length === 0) {
    throw new Error(
      `resolveScriptureRef: no scripture_refs row found for (person_id=${personId}, book="${book}", chapter_start=${chapterStart}, verse_start=${verseStart})`
    );
  }
  if (row.rows.length > 1) {
    throw new Error(
      `resolveScriptureRef: ${row.rows.length} scripture_refs rows found for (person_id=${personId}, book="${book}", chapter_start=${chapterStart}, verse_start=${verseStart}) — ambiguous`
    );
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
  const mordecaiId = await resolveExisting("mordecai", "Mordecai");
  const ahasuerusId = await resolveExisting("ahasuerus", "Ahasuerus", "Xerxes I king of Persia");

  // ───────────────────────────────────────────────────────────────────────
  // Finding 1: mordecai.description (scripts/seed-esther.ts line 71) states
  // "descendant of Kish — the same Kish as Saul's father" as settled fact.
  // Esther 2:5-6 (ESV) gives Mordecai's genealogy as son of Jair, son of
  // Shimei, son of Kish, but never identifies this Kish with Kish the father
  // of Saul (1 Sam 9:1, whose own genealogy — Abiel, Zeror, Becorath, Aphiah
  // — shares no named generation with Esther 2:5's line). The findings doc
  // confirms this identification is a traditional/scholarly inference, not
  // a textual one, and is genuinely disputed given the ~500-year gap. Per
  // the findings doc's proposed correction, soften to a hedged, traditional
  // identification, mirroring the DB's existing "traditionally linked"
  // hedge used for Haman's Agagite/Amalekite line.
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 1", `UPDATE people.description for mordecai (id: ${mordecaiId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Benjaminite Jew in Susa, son of Jair, son of Shimei, son of Kish (Esth 2:5) — traditionally identified with Kish the father of Saul, though the text itself does not make this connection explicit, and the ~500-year gap makes it a disputed identification among scholars. Raised his orphaned cousin Esther as his own daughter. Discovered and reported a plot to assassinate Ahasuerus (recorded in the royal chronicles). Refused to bow to Haman, triggering the empire-wide plot against the Jews. Advised Esther to intercede, telling her 'who knows whether you have not come to the kingdom for such a time as this?' After Haman's fall he was given Haman's signet ring and position; he and Esther instituted the feast of Purim.",
      mordecaiId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 2: ahasuerus.description (scripts/seed-esther.ts line 61) says
  // he "reversed" Haman's edict, but Esther 8:8 (ESV) explicitly states a
  // royal edict sealed with the king's ring "cannot be revoked." The text
  // instead depicts Ahasuerus authorizing a second, counter-edict (8:11)
  // permitting the Jews to defend themselves — a different legal mechanism
  // than a reversal. The same "reverses Haman's edict" wording also appears
  // in the ahasuerus scripture_refs note (scripts/seed-esther.ts line 106);
  // the findings doc explicitly flags both instances for correction. Per
  // the findings doc's proposed correction, replace "reversed"/"reverses"
  // wording in both fields with wording reflecting the counter-edict
  // mechanism.
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 2a", `UPDATE people.description for ahasuerus (id: ${ahasuerusId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "King of Persia who ruled from India to Ethiopia over 127 provinces — historically identified as Xerxes I (r. 486–465 BC). Hosted a 180-day banquet displaying his wealth and power. Deposed Queen Vashti for refusing to appear before his guests. Chose Esther as queen from a kingdom-wide search. Allowed Haman's edict to annihilate the Jews, then, since the edict itself could not be revoked (Esth 8:8), authorized a counter-edict after Esther's intercession letting the Jews defend themselves. Had Haman hanged on the gallows Haman had built for Mordecai.",
      ahasuerusId,
    ],
  });

  {
    const refId = await resolveScriptureRef(ahasuerusId, "Esther", 1, 1);
    await run("Finding 2b", `UPDATE scripture_refs.note for ahasuerus (id: ${refId})`, {
      sql: `UPDATE scripture_refs SET note = ? WHERE id = ?`,
      args: [
        "Hosts banquet; deposes Vashti; chooses Esther; authorizes counter-edict letting Jews defend themselves",
        refId,
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
