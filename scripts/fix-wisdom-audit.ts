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
  const agurId = await resolveExisting("agur", "Agur", "Agur son of Jakeh");
  const shulamiteId = await resolveExisting("shulamite", "Shulamite", "the beloved, the Shulamite woman");
  const daughtersJerusalemId = await resolveExisting(
    "daughters_jerusalem",
    "Daughters of Jerusalem",
    "daughters of Jerusalem in Song of Solomon"
  );
  const solomonId = await resolveExisting("solomon", "Solomon");

  // ───────────────────────────────────────────────────────────────────────
  // Finding 1: agur.description (scripts/seed-wisdom.ts line 81) presents a
  // quoted sentence — "I am the most ignorant of men; I do not have human
  // wisdom" — as a verbatim opening of Proverbs 30:1, but the ESV's actual
  // text of 30:1-3 reads "I am weary, O God... Surely I am too stupid to be
  // a man. I have not the understanding of a man. I have not learned
  // wisdom, nor have I knowledge of the Holy One." The quoted phrase does
  // not appear in the ESV. Per the findings doc's proposed correction,
  // replace the quoted sentence with the actual ESV wording.
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 1", `UPDATE people.description for agur (id: ${agurId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Sage who authored Proverbs 30. Opens with profound humility, declaring himself 'too stupid to be a man' who has 'not learned wisdom, nor... knowledge of the Holy One' (Prov 30:2-3). His oracle contains numerical proverbs about things that are never satisfied. Identity uncertain; some traditions link him to Solomon.",
      agurId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 2: shulamite.name and shulamite.alsoKnownAs (scripts/seed-
  // wisdom.ts lines 106-111) spell the title "Shulamite" (one m), but the
  // ESV's own text of the only verse where this title occurs (Song 6:13,
  // both instances) spells it "Shulammite" (two m's). Per the findings
  // doc's proposed correction, change name to "Shulammite," update
  // alsoKnownAs to "the beloved, the Shulammite woman" (retaining
  // "Shulamite" as a secondary alternate spelling), and update the
  // description's two occurrences of "Shulamite" to "Shulammite" for
  // internal consistency.
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 2", `UPDATE people.name/also_known_as/description for shulamite (id: ${shulamiteId})`, {
    sql: `UPDATE people SET name = ?, also_known_as = ?, description = ? WHERE id = ?`,
    args: [
      "Shulammite",
      "the beloved, the Shulammite woman (also spelled Shulamite)",
      "The unnamed beloved woman who speaks throughout the Song of Solomon. Called 'the Shulammite' in 6:13 (possibly from Shunem). Her words make up much of the book; she is described as dark but lovely, a keeper of vineyards, longing for her lover.",
      shulamiteId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 3: daughters_jerusalem.description (scripts/seed-wisdom.ts line
  // 119) cites "Song 1:5; 2:7; 3:5; 5:8; 8:4" as the five places the
  // Daughters of Jerusalem are addressed, but the insertRef calls (lines
  // 158-160) only cover three: 1:5, 2:7, and 5:8. No scripture_refs row
  // exists for 3:5 or 8:4. Both missing verses are confirmed via live ESV
  // fetch to contain the same "do not stir up or awaken love" refrain
  // addressed to the Daughters of Jerusalem. Per the findings doc's
  // proposed correction, add two new scripture_refs rows.
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 3a", `INSERT scripture_refs for daughters_jerusalem (id: ${daughtersJerusalemId}) — Song 3:5`, {
    sql: `INSERT OR IGNORE INTO scripture_refs (id,person_id,book,chapter_start,verse_start,chapter_end,verse_end,note,created_at)
          VALUES (?,?,?,?,?,?,?,?,datetime('now'))`,
    args: [
      crypto.randomUUID(),
      daughtersJerusalemId,
      "Song of Solomon",
      3,
      5,
      3,
      5,
      "Do not stir up love until it pleases (refrain, repeated from 2:7)",
    ],
  });

  await run("Finding 3b", `INSERT scripture_refs for daughters_jerusalem (id: ${daughtersJerusalemId}) — Song 8:4`, {
    sql: `INSERT OR IGNORE INTO scripture_refs (id,person_id,book,chapter_start,verse_start,chapter_end,verse_end,note,created_at)
          VALUES (?,?,?,?,?,?,?,?,datetime('now'))`,
    args: [
      crypto.randomUUID(),
      daughtersJerusalemId,
      "Song of Solomon",
      8,
      4,
      8,
      4,
      "Do not stir up love until it pleases (final refrain)",
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 4: the shulamite spouse_of solomon relationship (scripts/seed-
  // wisdom.ts line 133) asserts a settled marital relationship the Song's
  // own text does not explicitly state in the Shulamite's own words, and
  // which is genuinely contested in scholarship (the "shepherd hypothesis").
  // Per the findings doc's proposed correction (controller decision,
  // 2026-07-22), retype the relationship from spouse_of to "other" — keeping
  // the same note text — matching this file's own precedent for the
  // similarly-hedged agur/lemuel "other" Solomon-identity relationships.
  // Must resolve by the OLD type (spouse_of), since that is what is
  // currently in the live DB; the row does not yet have type "other".
  // ───────────────────────────────────────────────────────────────────────

  {
    const relId = await resolveRelationship(shulamiteId, "spouse_of", solomonId);
    await run("Finding 4", `UPDATE relationships.type for shulamite-spouse_of-solomon (id: ${relId})`, {
      sql: `UPDATE relationships SET type = ? WHERE id = ?`,
      args: ["other", relId],
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
