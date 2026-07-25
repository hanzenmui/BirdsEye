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
  const maryId = await resolveExisting("mary_mother", "Mary", "Mary mother of Jesus, the Virgin Mary");
  const johnId = await resolveExisting("john_baptist", "John the Baptist", "John son of Zechariah");
  const simeonId = await resolveExisting("simeon_nt", "Simeon", "Simeon of Jerusalem");

  // ───────────────────────────────────────────────────────────────────────
  // Finding 1: mary_mother.description (scripts/seed-nt-birth.ts line 104)
  // quotes Luke 1:38 as "I am the servant of the Lord..." but the ESV's
  // actual wording opens with "Behold, I am the servant of the Lord...".
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 1", `UPDATE people.description for mary_mother (id: ${maryId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Young woman from Nazareth of Galilee, betrothed to Joseph son of David. Gabriel appeared to her announcing she would conceive by the Holy Spirit and bear the Son of God — she responded 'Behold, I am the servant of the Lord; let it be to me according to your word.' Traveled with Joseph to Bethlehem for the census; gave birth in a manger. Presented Jesus at the Temple; fled to Egypt with Joseph; settled in Nazareth. Present at the wedding at Cana where Jesus performed his first miracle. Stood at the foot of the cross; entrusted to the beloved disciple. Was in the upper room at Pentecost. The most mentioned woman in the New Testament.",
      maryId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 2 & 3: john_baptist.description (scripts/seed-nt-birth.ts line
  // 90) misattributes "Elijah who is to come" to Malachi 4:5 — that exact
  // phrase is Matt 11:14's wording (Jesus's own application of Malachi's
  // prophecy to John); Malachi 4:5 itself reads "Elijah the prophet."
  // It also names the dancer at Herod's feast "Salome" — a detail absent
  // from both Gospel accounts (Matt 14, Mark 6), which name her only "the
  // daughter of Herodias"; "Salome" comes from Josephus, not Scripture.
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 2+3", `UPDATE people.description for john_baptist (id: ${johnId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Son of Zechariah and Elizabeth, born six months before Jesus. Lived as an ascetic in the desert, clothed in camel's hair with a leather belt, eating locusts and wild honey. Called the people to repentance and baptized them in the Jordan — the forerunner prophesied by Isaiah 40:3 and Malachi 4:5, whom Jesus identified as 'Elijah who is to come' (Matt 11:14). Baptized Jesus, though he protested he was unworthy. Rebuked Herod Antipas for taking his brother's wife; imprisoned and ultimately beheaded at Herodias's request after her daughter (traditionally identified as Salome, per Josephus — not named in the Gospels) danced before Herod. Jesus declared: 'Among those born of women there has arisen no one greater than John the Baptist.'",
      johnId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 4: simeon_nt.description (scripts/seed-nt-birth.ts line 115)
  // quotes the Nunc Dimittis as a continuous sentence, but silently drops
  // "according to your word" and everything after "your salvation" from
  // the ESV's actual text, with no ellipsis marking the omission.
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 4", `UPDATE people.description for simeon_nt (id: ${simeonId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Righteous and devout man in Jerusalem who had been promised by the Holy Spirit that he would not die before seeing the Messiah. When Mary and Joseph brought the infant Jesus to the Temple, Simeon took him in his arms and prayed the Nunc Dimittis: 'Lord, now you are letting your servant depart in peace...for my eyes have seen your salvation.' He also prophesied to Mary: 'a sword will pierce through your own soul also.' Not to be confused with Simeon son of Jacob.",
      simeonId,
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
