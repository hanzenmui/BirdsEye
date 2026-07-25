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
  const epaenetusId = await resolveExisting("epaenetus", "Epaenetus", "Epaenetus first convert in Asia");
  const maryOfRomeId = await resolveExisting("mary_of_rome", "Mary of Rome", "Mary of Rome, church worker");
  const ampliatusId = await resolveExisting("ampliatus", "Ampliatus", "Ampliatus beloved in the Lord");
  const urbanusId = await resolveExisting("urbanus", "Urbanus", "Urbanus co-worker of Paul");
  const stachysId = await resolveExisting("stachys", "Stachys", "Stachys dear friend of Paul");
  const apellesId = await resolveExisting("apelles", "Apelles", "Apelles tested and approved in Christ");
  const tryphenaId = await resolveExisting("tryphena", "Tryphena", "Tryphena worker in the Lord");
  const tryphosaId = await resolveExisting("tryphosa", "Tryphosa", "Tryphosa worker in the Lord");
  const persisId = await resolveExisting("persis", "Persis", "Persis who worked hard for the Lord");
  const rufusMotherId = await resolveExisting("rufus_mother", "Mother of Rufus", "mother of Rufus, also a mother to Paul");
  const erastusId = await resolveExisting("erastus", "Erastus", "Erastus city treasurer of Corinth");

  // ───────────────────────────────────────────────────────────────────────
  // Finding 1: epaenetus.description (scripts/seed-romans16.ts line 102)
  // quotes "dear friend"/"the province of Asia," but Romans 16:5 (ESV)
  // reads "beloved"/"Asia."
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 1", `UPDATE people.description for epaenetus (id: ${epaenetusId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Greeted by Paul in Romans 16:5 as 'my beloved Epaenetus, who was the first convert to Christ in Asia.' The first recorded Christian convert in Asia Minor.",
      epaenetusId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 2: mary_of_rome.description (scripts/seed-romans16.ts line
  // 111) adds "very," not present in Romans 16:6 (ESV).
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 2", `UPDATE people.description for mary_of_rome (id: ${maryOfRomeId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Greeted by Paul in Romans 16:6 as one 'who has worked hard for you.' Not to be confused with Mary the mother of Jesus, Mary Magdalene, or Mary of Bethany. A female church worker in Rome.",
      maryOfRomeId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 3: ampliatus.description (scripts/seed-romans16.ts line 120)
  // quotes "dear friend in the Lord," but Romans 16:8 (ESV) reads
  // "beloved in the Lord."
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 3", `UPDATE people.description for ampliatus (id: ${ampliatusId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Greeted by Paul in Romans 16:8 as 'my beloved in the Lord.' A common slave name in the Roman world; may have been a freed slave or slave in a Christian household.",
      ampliatusId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 4: urbanus.description (scripts/seed-romans16.ts line 129)
  // quotes "co-worker," but Romans 16:9 (ESV) reads "fellow worker."
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 4", `UPDATE people.description for urbanus (id: ${urbanusId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Greeted by Paul in Romans 16:9 as 'our fellow worker in Christ.' A Latin name common among Roman freedmen and slaves.",
      urbanusId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 5: stachys.description (scripts/seed-romans16.ts line 138)
  // quotes "my dear friend," but Romans 16:9 (ESV) never uses a predicate
  // "friend" phrase for Stachys — only "my beloved Stachys."
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 5", `UPDATE people.description for stachys (id: ${stachysId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Greeted by Paul in Romans 16:9 as 'my beloved Stachys.' A Greek name meaning 'ear of grain,' relatively rare in Roman contexts.",
      stachysId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 6: apelles.description (scripts/seed-romans16.ts line 147)
  // quotes a substantial paraphrase, but Romans 16:10 (ESV) reads simply
  // "who is approved in Christ."
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 6", `UPDATE people.description for apelles (id: ${apellesId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Greeted by Paul in Romans 16:10 as one 'who is approved in Christ.' The phrase suggests he had passed through some trial or persecution that proved his faith.",
      apellesId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 7 & 8: tryphena.description and tryphosa.description
  // (scripts/seed-romans16.ts lines 165, 174) quote "work[s] hard in the
  // Lord," but Romans 16:12 (ESV) calls them "workers in the Lord" — the
  // word "hard" is Persis's separate clause later in the same verse.
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 7", `UPDATE people.description for tryphena (id: ${tryphenaId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Greeted by Paul in Romans 16:12 as one of 'those workers in the Lord.' Named alongside Tryphosa; possibly sisters or close ministry partners. The name means 'dainty' or 'luxurious.'",
      tryphenaId,
    ],
  });

  await run("Finding 8", `UPDATE people.description for tryphosa (id: ${tryphosaId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Greeted by Paul in Romans 16:12 as one of 'those workers in the Lord.' Named alongside Tryphena; possibly sisters or close ministry partners. The name means 'delicate.'",
      tryphosaId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 9: persis.description (scripts/seed-romans16.ts line 183)
  // quotes "dear"/adds "very," but Romans 16:12 (ESV) reads "the beloved
  // Persis, who has worked hard in the Lord."
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 9", `UPDATE people.description for persis (id: ${persisId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Greeted by Paul in Romans 16:12 as 'the beloved Persis, who has worked hard in the Lord.' Described as 'beloved,' suggesting she was especially close to Paul. Her name means 'Persian woman,' suggesting possible eastern origin or slave background.",
      persisId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 10: rufus_mother.description (scripts/seed-romans16.ts line
  // 192) quotes "too," but Romans 16:13 (ESV) reads "as well."
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 10", `UPDATE people.description for rufus_mother (id: ${rufusMotherId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Unnamed woman greeted in Romans 16:13. Paul calls her mother of Rufus and says she 'has been a mother to me as well,' indicating she had personally cared for Paul at some point. Possibly the wife of Simon of Cyrene if Rufus is identified with Mark 15:21.",
      rufusMotherId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 11: erastus.description (scripts/seed-romans16.ts line 291)
  // quotes "the city's director of public works," but Romans 16:23 (ESV)
  // reads "the city treasurer."
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 11", `UPDATE people.description for erastus (id: ${erastusId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Identified in Romans 16:23 as 'the city treasurer' of Corinth. Also mentioned in Acts 19:22 (sent with Timothy to Macedonia) and 2 Timothy 4:20 (stayed in Corinth). A Corinthian inscription mentioning an Erastus who paved a plaza at his own expense may refer to this same individual.",
      erastusId,
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
