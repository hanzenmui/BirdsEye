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
  const paulId = await resolveExisting("paul", "Paul", "Paul of Tarsus, Saul of Tarsus, the Apostle Paul");
  const festusId = await resolveExisting("festus", "Festus", "Porcius Festus, governor of Judea");
  const jamesId = await resolveExisting("james_lord", "James", "James the brother of Jesus, James the Just");
  const markId = await resolveExisting("mark_evangelist", "Mark", "John Mark, Mark the Evangelist");
  const priscillaId = await resolveExisting("priscilla", "Priscilla", "Priscilla, Prisca");
  const gamalielId = await resolveExisting("gamaliel", "Gamaliel", "Gamaliel the Elder, Gamaliel I");

  // ───────────────────────────────────────────────────────────────────────
  // Finding 1: paul.description (scripts/seed-acts.ts line 90) quotes
  // Jesus as saying "why do you persecute me," but Acts 9:4 (ESV) reads
  // "why are you persecuting me" (present continuous, not simple present).
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 1", `UPDATE people.description for paul (id: ${paulId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Born Saul in Tarsus of Cilicia, a Roman citizen by birth, a Pharisee trained under Gamaliel in Jerusalem. Breathed murderous threats against the church; present at Stephen's stoning holding the cloaks. On the road to Damascus a blinding light struck him down and Jesus said 'Saul, Saul, why are you persecuting me?' He was led blind into the city; Ananias restored his sight and baptized him. Took the Roman name Paul. Went on three missionary journeys throughout the Mediterranean world planting churches. Wrote at least 13 New Testament letters. Shipwrecked, beaten, imprisoned repeatedly, stoned. Appealed to Caesar; arrived in Rome; according to tradition beheaded under Nero. 'I have fought the good fight, I have finished the race, I have kept the faith.'",
      paulId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 2: festus.description (scripts/seed-acts.ts line 203) quotes
  // "driving you mad," but Acts 26:24 (ESV) repeats "out of your mind"
  // rather than varying the wording.
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 2", `UPDATE people.description for festus (id: ${festusId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Roman governor who succeeded Felix c. 59 AD. Three days after arriving, chief priests asked him to send Paul to Jerusalem (planning an ambush). Festus offered to try him in Jerusalem; Paul appealed to Caesar. Festus consulted King Agrippa II on the case. When Paul gave his defense before Festus and Agrippa, Festus interrupted: 'Paul, you are out of your mind; your great learning is driving you out of your mind.' Paul appealed to Agrippa: 'Do you believe the prophets?' Festus concluded 'This man is doing nothing deserving death or imprisonment' but had to send him to Caesar since he had appealed.",
      festusId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 3: james_lord.description (scripts/seed-acts.ts line 108)
  // reorders John 7:5's negation — ESV reads "not even his brothers
  // believed in him," not "even his brothers did not believe in him."
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 3", `UPDATE people.description for james_lord (id: ${jamesId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Brother of Jesus (son of Mary and Joseph), initially skeptical of Jesus's ministry (John 7:5: 'not even his brothers believed in him'). After the resurrection Jesus appeared specifically to James (1 Cor 15:7), transforming him. Became the leader of the Jerusalem church; recognized as a pillar alongside Peter and John (Gal 2:9). Known for his extreme piety — called 'James the Just' by early tradition. Presided at the Jerusalem Council (Acts 15). Wrote the Epistle of James. Executed by the high priest Ananus II c. 62 AD; stoned to death according to Josephus.",
      jamesId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 4: mark_evangelist.description (scripts/seed-acts.ts line 159)
  // quotes "useful to me for ministry," dropping "very" from 2 Tim 4:11's
  // "he is very useful to me for ministry."
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 4", `UPDATE people.description for mark_evangelist (id: ${markId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "John Mark, cousin of Barnabas, associated with the Jerusalem church (his mother Mary's house was a prayer meeting location where Peter went after the angel freed him). Accompanied Paul and Barnabas on the first missionary journey but deserted them in Pamphylia. This caused a sharp disagreement when Paul refused to take him on the second journey, splitting the team — Barnabas took Mark to Cyprus. Later fully restored: Paul called him 'very useful to me for ministry' (2 Tim 4:11). Traditionally associated with Peter, whose eyewitness accounts he recorded as the Gospel of Mark. According to tradition, founded the church in Alexandria.",
      markId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 5: priscilla.description (scripts/seed-acts.ts line 175) cites
  // "Romans 16:3" for a quote that spans into v4 ("who risked their necks
  // for my life" is v4's content).
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 5", `UPDATE people.description for priscilla (id: ${priscillaId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Jewish Christian tent-maker who with her husband Aquila had left Rome after Claudius expelled the Jews (c. 49 AD). Met Paul in Corinth; he stayed and worked with them. Traveled with Paul to Ephesus; stayed there and together with Aquila instructed the eloquent Apollos 'more accurately' in the way of God. Paul greeted them in Romans 16:3-4 as 'fellow workers in Christ Jesus, who risked their necks for my life.' Notably, Priscilla is named first in four of the six NT references to the couple — unusual for a woman in antiquity, suggesting she was the more prominent teacher.",
      priscillaId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 6: gamaliel.description (scripts/seed-acts.ts line 192) quotes
  // Acts 22:3 as "I was educated at the feet of Gamaliel," but the ESV
  // never places those words contiguously ("I am a Jew... but brought up
  // in this city, educated at the feet of Gamaliel...").
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 6", `UPDATE people.description for gamaliel (id: ${gamalielId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Pharisee and teacher of the Law held in honor by all the people, Paul's teacher (Acts 22:3: 'brought up in this city, educated at the feet of Gamaliel'). When the Sanhedrin wanted to kill the apostles after their second arrest, Gamaliel urged caution: 'If this plan or this undertaking is of man, it will fail; but if it is of God, you will not be able to overthrow them. You might even be found opposing God!' The council took his advice and released the apostles (after flogging). The most revered rabbi of his generation.",
      gamalielId,
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
