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
  const phoebeId = await resolveExisting("phoebe", "Phoebe", "Phoebe deaconess of Cenchreae");
  const andronicusId = await resolveExisting("andronicus", "Andronicus", "Andronicus kinsman of Paul");
  const juniaId = await resolveExisting("junia", "Junia", "Junia kinswoman of Paul");
  const euodiaId = await resolveExisting("euodia", "Euodia", "Euodia of Philippi");
  const syntycheId = await resolveExisting("syntyche", "Syntyche", "Syntyche of Philippi");
  const epaphrasId = await resolveExisting("epaphras", "Epaphras", "Epaphras founder of the Colossian church");
  const demasId = await resolveExisting("demas", "Demas", "Demas co-worker of Paul");

  // ───────────────────────────────────────────────────────────────────────
  // Finding 1: phoebe.description (scripts/seed-nt-epistles.ts line 98)
  // quotes "a benefactor of many," but Romans 16:2 (ESV) reads "a patron
  // of many."
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 1", `UPDATE people.description for phoebe (id: ${phoebeId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Deaconess of the church at Cenchreae who personally carried Paul's letter to Rome (Romans 16:1–2). Called 'a servant/deaconess' and 'a patron of many'.",
      phoebeId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 2: andronicus.description, junia.description, and both
  // people's Romans 16:7 scripture_refs notes (scripts/seed-nt-epistles.ts
  // lines 107, 116, 399-400) quote "outstanding among the apostles," but
  // Romans 16:7 (ESV) reads "well known to the apostles" — a well-known,
  // contested translation crux. Fix all four locations to match the ESV.
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 2a", `UPDATE people.description for andronicus (id: ${andronicusId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Jewish Christian kinsman of Paul, imprisoned with him, and described as 'well known to the apostles' (Romans 16:7).",
      andronicusId,
    ],
  });

  await run("Finding 2b", `UPDATE people.description for junia (id: ${juniaId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Jewish Christian kinswoman of Paul, imprisoned with him, described as 'well known to the apostles' (Romans 16:7). Some scholars read the underlying Greek as 'outstanding among the apostles,' which would make her a female apostle — but that is not the ESV's own choice of wording here.",
      juniaId,
    ],
  });

  {
    const refId = await resolveScriptureRef(andronicusId, "Romans", 16, 7);
    await run("Finding 2c", `UPDATE scripture_refs.note for andronicus's Romans 16:7 ref (id: ${refId})`, {
      sql: `UPDATE scripture_refs SET note = ? WHERE id = ?`,
      args: ["Well known to the apostles; kinsman of Paul", refId],
    });
  }
  {
    const refId = await resolveScriptureRef(juniaId, "Romans", 16, 7);
    await run("Finding 2d", `UPDATE scripture_refs.note for junia's Romans 16:7 ref (id: ${refId})`, {
      sql: `UPDATE scripture_refs SET note = ? WHERE id = ?`,
      args: ["Well known to the apostles; kinswoman of Paul", refId],
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // Finding 3: euodia.description and syntyche.description
  // (scripts/seed-nt-epistles.ts lines 190, 199) quote "contended at his
  // side in the cause of the gospel," but Philippians 4:3 (ESV) reads
  // "labored side by side with me in the gospel."
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 3a", `UPDATE people.description for euodia (id: ${euodiaId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Church leader in Philippi whom Paul urges to reconcile with Syntyche. She has 'labored side by side with me in the gospel' (Philippians 4:2–3).",
      euodiaId,
    ],
  });

  await run("Finding 3b", `UPDATE people.description for syntyche (id: ${syntycheId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Church leader in Philippi whom Paul urges to reconcile with Euodia. She has 'labored side by side with me in the gospel' (Philippians 4:2–3).",
      syntycheId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 4: epaphras.description (scripts/seed-nt-epistles.ts line 254)
  // quotes "dear fellow servant" and "'agonizing' prayer warrior," but
  // Colossians 1:7 (ESV) reads "beloved fellow servant" and Colossians
  // 4:12-13 reads "struggling," not "agonizing."
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 4", `UPDATE people.description for epaphras (id: ${epaphrasId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "A Colossian Christian who founded the church at Colossae and reported on it to the imprisoned Paul. Called Paul's 'fellow prisoner' in Philemon 1:23 and Colossians' 'beloved fellow servant... a faithful minister' (Col 1:7), always struggling for the Colossians in prayer (Colossians 4:12–13).",
      epaphrasId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 5: demas.description and his 2 Timothy scripture_refs note
  // (scripts/seed-nt-epistles.ts lines 300, 437) quote "having loved this
  // present world," but 2 Timothy 4:10 (ESV) reads "in love with this
  // present world."
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 5a", `UPDATE people.description for demas (id: ${demasId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Once a co-worker of Paul (Colossians 4:14; Philemon 1:24), but later deserted him, 'in love with this present world' and gone to Thessalonica (2 Timothy 4:10).",
      demasId,
    ],
  });

  {
    const refId = await resolveScriptureRef(demasId, "2 Timothy", 4, 10);
    await run("Finding 5b", `UPDATE scripture_refs.note for demas's 2 Timothy 4:10 ref (id: ${refId})`, {
      sql: `UPDATE scripture_refs SET note = ? WHERE id = ?`,
      args: ["Deserted Paul, in love with the present world", refId],
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
