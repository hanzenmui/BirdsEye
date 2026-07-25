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

// Resolve the id of an existing scripture_refs row by (person_id, book,
// chapter_start, verse_start). Throws if zero or more than one match is
// found — this script must never mutate an ambiguous row on a live DB.
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

// Resolve the id of an existing relationship row by (person_a_id, type,
// person_b_id). Throws if zero or more than one match is found.
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
  const tychicusId = await resolveExisting("tychicus", "Tychicus", "Tychicus dear brother and faithful minister of Paul");
  const alexanderId = await resolveExisting("alexander_coppersmith", "Alexander the coppersmith", "Alexander the coppersmith, opponent of Paul");
  const peterId = await resolveExisting("peter", "Peter");
  const electLadyId = await resolveExisting("elect_lady", "The Elect Lady", "the Elect Lady and her children, recipient of 2 John");
  const johnId = await resolveExisting("john", "John");
  const fortunatusId = await resolveExisting("fortunatus", "Fortunatus", "Fortunatus of Stephanas's household");
  const achaicusId = await resolveExisting("achaicus", "Achaicus", "Achaicus of Stephanas's household");

  // ───────────────────────────────────────────────────────────────────────
  // Finding 1: tychicus.description (scripts/seed-nt-gaps.ts line 117)
  // quotes Eph 6:21/Col 4:7 as "dear brother and faithful servant," but
  // the ESV's actual wording is "beloved brother and faithful minister."
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 1", `UPDATE people.description for tychicus (id: ${tychicusId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "A trusted co-worker and letter-carrier for Paul, described as 'the beloved brother and faithful minister in the Lord' (Eph 6:21; Col 4:7). He delivered the letters to the Ephesians and Colossians and was later sent to Ephesus by Paul (2 Tim 4:12).",
      tychicusId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 2: alexander_coppersmith.description (scripts/seed-nt-gaps.ts
  // line 171) quotes 2 Tim 4:14 as "did me a great deal of harm," but the
  // ESV's actual wording is "did me great harm."
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 2", `UPDATE people.description for alexander_coppersmith (id: ${alexanderId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "A man who 'did me great harm' according to Paul (2 Tim 4:14). Paul warns Timothy to be on guard against him. Possibly the same Alexander who, with Hymenaeus, shipwrecked his faith and was handed over to Satan by Paul (1 Tim 1:20).",
      alexanderId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 3: peter's scripture_refs note for the 2 Peter 1:1 ref
  // (scripts/seed-nt-gaps.ts line 300) quotes "Simon Peter," but the ESV's
  // actual wording at this specific verse is "Simeon Peter" (a distinct,
  // fuller name-form used only here, not "Simon" as elsewhere in the NT).
  // ───────────────────────────────────────────────────────────────────────

  {
    const refId = await resolveScriptureRef(peterId, "2 Peter", 1, 1);
    await run("Finding 3", `UPDATE scripture_refs.note for peter's 2 Peter 1:1 ref (id: ${refId})`, {
      sql: `UPDATE scripture_refs SET note = ? WHERE id = ?`,
      args: ["Peter identifies himself as author: 'Simeon Peter, a servant and apostle'", refId],
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // Finding 4: three locations quote 2 John 1:1 as "the chosen lady," but
  // the ESV's actual wording is "the elect lady" — elect_lady.description,
  // the john→elect_lady relationship note, and elect_lady's own
  // scripture_refs note (scripts/seed-nt-gaps.ts lines 198, 230, 267).
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 4a", `UPDATE people.description for elect_lady (id: ${electLadyId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "The recipient of 2 John, addressed as 'the elect lady and her children' (2 John 1:1). Scholars debate whether this refers to a specific named woman and her household or is a symbolic way of addressing a local church congregation.",
      electLadyId,
    ],
  });

  {
    const relId = await resolveRelationship(johnId, "mentor_of", electLadyId);
    await run("Finding 4b", `UPDATE relationships.notes for john mentor_of elect_lady (id: ${relId})`, {
      sql: `UPDATE relationships SET notes = ? WHERE id = ?`,
      args: ["The Elder writes 'to the elect lady and her children, whom I love in the truth' (2 John 1:1)", relId],
    });
  }

  {
    const refId = await resolveScriptureRef(electLadyId, "2 John", 1, 1);
    await run("Finding 4c", `UPDATE scripture_refs.note for elect_lady's 2 John 1:1 ref (id: ${refId})`, {
      sql: `UPDATE scripture_refs SET note = ? WHERE id = ?`,
      args: ["The elect lady and her children: recipient of 2 John", refId],
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // Finding 5: peter's scripture_refs note for the 1 Peter 5:13 ref
  // (scripts/seed-nt-gaps.ts line 301) quotes "she who is in Babylon,"
  // but the ESV's actual wording is "She who is at Babylon."
  // ───────────────────────────────────────────────────────────────────────

  {
    const refId = await resolveScriptureRef(peterId, "1 Peter", 5, 13);
    await run("Finding 5", `UPDATE scripture_refs.note for peter's 1 Peter 5:13 ref (id: ${refId})`, {
      sql: `UPDATE scripture_refs SET note = ? WHERE id = ?`,
      args: ["Greetings from 'she who is at Babylon' — the Roman church", refId],
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // Finding 6: fortunatus's and achaicus's 1 Corinthians refs
  // (scripts/seed-nt-gaps.ts lines 261, 264) span only 16:17, but the
  // "refreshing his spirit" detail their own descriptions claim is in
  // 16:18. Extend both refs' end verse to 18.
  // ───────────────────────────────────────────────────────────────────────

  {
    const refId = await resolveScriptureRef(fortunatusId, "1 Corinthians", 16, 17);
    await run("Finding 6a", `UPDATE scripture_refs.chapter_end/verse_end for fortunatus (id: ${refId}) from 16:17 to 16:18`, {
      sql: `UPDATE scripture_refs SET chapter_end = ?, verse_end = ? WHERE id = ?`,
      args: [16, 18, refId],
    });
  }
  {
    const refId = await resolveScriptureRef(achaicusId, "1 Corinthians", 16, 17);
    await run("Finding 6b", `UPDATE scripture_refs.chapter_end/verse_end for achaicus (id: ${refId}) from 16:17 to 16:18`, {
      sql: `UPDATE scripture_refs SET chapter_end = ?, verse_end = ? WHERE id = ?`,
      args: [16, 18, refId],
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
