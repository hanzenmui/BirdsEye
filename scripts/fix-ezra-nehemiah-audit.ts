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
  const cyrusId = await resolveExisting("cyrus", "Cyrus", "Cyrus the Great, Cyrus king of Persia");
  const dariusId = await resolveExisting("darius_persia", "Darius", "Darius king of Persia");
  const sheshbazzarId = await resolveExisting("sheshbazzar", "Sheshbazzar", "Sheshbazzar prince of Judah");
  const zerubbabelId = await resolveExisting("zerubbabel", "Zerubbabel");

  // ───────────────────────────────────────────────────────────────────────
  // Finding 1: cyrus.description (scripts/seed-ezra-nehemiah.ts line 78)
  // calls Cyrus "king of Babylon" in his first year, but Ezra 1:1 (ESV)
  // twice calls him "king of Persia" — "king of Babylon" never appears as a
  // title for Cyrus anywhere in Ezra 1. Per the findings doc's proposed
  // correction, change "as king of Babylon" to "as king of Persia" to match
  // the verse's own repeated title.
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 1", `UPDATE people.description for cyrus (id: ${cyrusId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Founder of the Achaemenid Persian Empire. In his first year as king of Persia (c. 538 BC) he issued a decree allowing exiled peoples — including the Jews — to return to their homelands and rebuild their temples. Isaiah had named him by name over a century earlier as God's 'anointed' (Isa 44:28–45:1). He returned the temple vessels Nebuchadnezzar had taken from Jerusalem and appointed Sheshbazzar to lead the first wave of returnees.",
      cyrusId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 2: The Isaiah/Cyrus "150+ years before his birth" ref note —
  // re-verification found the popular-apologetics literature is genuinely
  // split between birth-anchored and reign/conquest-anchored framings of the
  // same figure, including within a source the original finding itself
  // relied on. Downgraded to Minor/informational; the findings doc concludes
  // the DB's existing text is defensible and sourced. No DB correction
  // implemented for this finding, per controller decision.
  // ───────────────────────────────────────────────────────────────────────

  // ───────────────────────────────────────────────────────────────────────
  // Finding 3: darius_persia.description (scripts/seed-ezra-nehemiah.ts line
  // 83) contains a grammatically malformed, spliced sentence fragment:
  // "Completed the Temple rebuilding was finished in his sixth year (516
  // BC)." Per the findings doc's proposed correction, replaced with a single
  // well-formed sentence. The underlying claim (Temple finished in Darius's
  // 6th year, per Ezra 6:15 ESV) is correct — this is purely a grammar fix.
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 3", `UPDATE people.description for darius_persia (id: ${dariusId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Darius I (the Great), king of Persia. When opponents challenged the returnees' right to build the Temple and asked him to search the royal archives, Darius found Cyrus's original decree and not only confirmed it but ordered the expenses to be paid from the royal treasury. The Temple rebuilding was completed in his sixth year (c. 515 BC). Not to be confused with Darius the Mede in Daniel.",
      dariusId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 4: sheshbazzar.description (scripts/seed-ezra-nehemiah.ts line
  // 94) asserts a specific majority/minority scholarly split ("Some scholars
  // identify him with Zerubbabel; most treat them as separate individuals")
  // that overstates how settled the Sheshbazzar/Zerubbabel identification
  // question is. Live research found the literature genuinely split and
  // historically shifting, not a single settled majority. Per the findings
  // doc's proposed correction, softened to acknowledge the contested/
  // shifting nature rather than asserting a specific majority direction.
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 4", `UPDATE people.description for sheshbazzar (id: ${sheshbazzarId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Prince of Judah appointed by Cyrus to lead the first wave of returnees from Babylon (c. 537 BC) and entrusted with the gold and silver temple vessels. He laid the foundations of the Temple. Scholars are divided on whether he is the same person as Zerubbabel or a separate, earlier governor; the question remains unsettled.",
      sheshbazzarId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 5: zerubbabel.description (scripts/seed-ezra-nehemiah.ts line
  // 99) states "Grandson of Jehoiachin (the exiled king of Judah)" as
  // unqualified fact, which implicitly asserts the Jehoiachin→Shealtiel→
  // Zerubbabel chain. But 1 Chronicles 3:19 (ESV) names Pedaiah — one of
  // Shealtiel's brothers — as Zerubbabel's direct father, a tension Matthew
  // 1:12, Ezra 3:2, and Haggai 1:1 don't resolve (they call him "son of
  // Shealtiel"). Per the findings doc's proposed correction, softened to
  // acknowledge the tension, mirroring the tone/register of the parallel
  // Late Kings of Judah audit's shealtiel.description hedge ("...though 1
  // Chronicles 3:19 names Zerubbabel's father as Pedaiah, Shealtiel's
  // brother — a genealogical tension often reconciled via levirate
  // succession...").
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 5", `UPDATE people.description for zerubbabel (id: ${zerubbabelId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Traditionally called grandson of Jehoiachin (the exiled king of Judah) through his father Shealtiel (Matt 1:12; Ezra 3:2), though 1 Chronicles 3:19 names Zerubbabel's father as Pedaiah, Shealtiel's brother — a genealogical tension usually reconciled via levirate succession. Leader of the main wave of returnees and governor of Judah under the Persians. Together with Jeshua the high priest, he rebuilt the altar, restored the burnt offerings, and began rebuilding the Temple — work that stalled for years due to opposition and then resumed under Haggai and Zechariah's encouragement. Completed the Temple in 516 BC. He is named in both Davidic genealogies of Jesus (Matt 1:12-13; Luke 3:27).",
      zerubbabelId,
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
