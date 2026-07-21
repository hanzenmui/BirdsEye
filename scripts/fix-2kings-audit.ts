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
  const jehuId = await resolveExisting("jehu", "Jehu", "Jehu son of Jehoshaphat");
  const ahaziahJudahId = await resolveExisting("ahaziah_judah", "Ahaziah", "Ahaziah king of Judah");
  const jehoiadaId = await resolveExisting("jehoiada", "Jehoiada");
  const zechariahJehoiadaId = await resolveExisting("zechariah_jehoiada", "Zechariah", "Zechariah son of Jehoiada");
  const sennacheribId = await resolveExisting("sennacherib", "Sennacherib");

  // ───────────────────────────────────────────────────────────────────────
  // Finding 1: jehu.description and ahaziah_judah.description
  // (scripts/seed-2kings.ts lines 105 and 170) state Ahaziah of Judah was
  // killed "at Jezreel" / "at Beth-haggan." ESV 2 Kgs 9:27 is explicit that
  // Ahaziah fled *toward* Beth-haggan, was shot near "the ascent of Gur,
  // which is by Ibleam," and then fled on to Megiddo, "and died there."
  // Jezreel is where Joram (not Ahaziah) was killed. Per the findings doc's
  // proposed correction, update both descriptions to reflect the correct
  // sequence of locations without altering surrounding sentence structure.
  // ───────────────────────────────────────────────────────────────────────

  // Finding 1 (jehu.description)
  await run("Finding 1", `UPDATE people.description for jehu (id: ${jehuId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Army commander anointed by one of Elisha's prophets to destroy the house of Ahab. Described as driving his chariot furiously. Killed Joram king of Israel at Jezreel and Ahaziah king of Judah near Ibleam as he fled toward Beth-haggan. Threw Jezebel from a window; her blood splattered on the wall and horses trampled her. Executed all of Ahab's seventy sons, all his officials, priests of Baal, and the Baal worshippers he lured into the temple under false pretense of a great sacrifice. Founded a dynasty that lasted four generations. But he did not turn from Jeroboam's golden calves.",
      jehuId,
    ],
  });

  // Finding 1 (ahaziah_judah.description)
  await run("Finding 1", `UPDATE people.description for ahaziah_judah (id: ${ahaziahJudahId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Son of Jehoram king of Judah and Athaliah daughter of Ahab. Twenty-two years old when he began to reign; walked in the ways of the house of Ahab. Went to visit the wounded Joram king of Israel at Jezreel and was caught in Jehu's revolution — Jehu's men shot him near Ibleam as he fled toward Beth-haggan; he escaped to Megiddo and died there. His death triggered his mother Athaliah to seize the throne and attempt to kill all the royal family; only the infant Joash survived. Not to be confused with Ahaziah king of Israel.",
      ahaziahJudahId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 1 (controller extension): the jehu --enemy_of--> ahaziah_judah
  // relationship's notes field (scripts/seed-2kings.ts line 236) has the
  // identical "at Beth-haggan" location error as the two descriptions above
  // ("Jehu killed Ahaziah of Judah at Beth-haggan") — same underlying error,
  // same ESV 2 Kgs 9:27 correction. The findings doc scoped Finding 1 to the
  // two description fields only, but the controller is extending the fix to
  // this relationship note for consistency, since it's the same mistake.
  // ───────────────────────────────────────────────────────────────────────

  // Finding 1 (controller extension: relationship note)
  {
    const relId = await resolveRelationship(jehuId, "enemy_of", ahaziahJudahId);
    await run("Finding 1", `UPDATE relationships.notes for jehu enemy_of ahaziah_judah (id: ${relId})`, {
      sql: `UPDATE relationships SET notes = ? WHERE id = ?`,
      args: ["Jehu's men shot Ahaziah of Judah near Ibleam as he fled toward Beth-haggan; he died at Megiddo (2 Kgs 9:27)", relId],
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // Finding 2: jehoiada.description (scripts/seed-2kings.ts line 121) states
  // he "lived to 130," a detail found only in 2 Chronicles 24:15-16, not in
  // 2 Kings — but jehoiada's only scripture ref cites "2 Kings" (line 270).
  // Controller-chosen option (a): add a second scripture ref citing
  // 2 Chronicles 24:15-16, matching the existing convention already used
  // for zechariah_jehoiada's 2 Chronicles ref in this same seed file.
  // ───────────────────────────────────────────────────────────────────────

  // Finding 2
  await run("Finding 2", `INSERT OR IGNORE scripture_refs for jehoiada (id: ${jehoiadaId}) citing 2 Chronicles 24:15-16`, {
    sql: `INSERT OR IGNORE INTO scripture_refs (id,person_id,book,chapter_start,verse_start,chapter_end,verse_end,note,created_at)
          VALUES (?,?,?,?,?,?,?,?,datetime('now'))`,
    args: [
      crypto.randomUUID(),
      jehoiadaId,
      "2 Chronicles",
      24,
      15,
      24,
      16,
      "Died at 130, full of days; buried among the kings for his good deeds",
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 3: zechariah_jehoiada.description (scripts/seed-2kings.ts line
  // 205) flatly asserts "Jesus cited his blood" via Matt 23:35, but that
  // verse names the murdered Zechariah's father as "Barachiah" — the
  // patronymic of the different, post-exilic prophet Zechariah, the very
  // figure the same description warns not to confuse this person with. Per
  // the findings doc's proposed correction, soften the sentence to
  // acknowledge the textual tension rather than stating the identification
  // as settled fact.
  // ───────────────────────────────────────────────────────────────────────

  // Finding 3
  await run("Finding 3", `UPDATE people.description for zechariah_jehoiada (id: ${zechariahJehoiadaId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Son of Jehoiada the high priest. After his father died Joash listened to corrupt officials and allowed idolatry to return; Zechariah stood and prophesied: 'This is what God says: why do you disobey the Lord's commands? You will not prosper.' The people stoned him in the Temple court at the king's command. His dying words: 'May the Lord see this and call you to account.' Many interpreters identify him as the Zechariah Jesus refers to among the righteous blood shed from Abel onward (Matt 23:35), though that verse names the victim's father as Berechiah, leading some to think Jesus meant the later prophet Zechariah instead. Not to be confused with the post-exilic prophet Zechariah son of Berechiah.",
      zechariahJehoiadaId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 4: sennacherib.description (scripts/seed-2kings.ts line 137)
  // states he "captured 46 fortified cities," but 2 Kings 18:13 (the only
  // ref cited for this person) says only "all the fortified cities of
  // Judah" — the figure 46 comes from Sennacherib's own Assyrian annals
  // (the Taylor/Sennacherib Prism), not the biblical text. Controller-
  // chosen option (b): keep the number but attribute it explicitly,
  // consistent with how manasseh_king.description already attributes a
  // Chronicles-sourced detail ("Chronicles adds that he was taken
  // captive...").
  // ───────────────────────────────────────────────────────────────────────

  // Finding 4
  await run("Finding 4", `UPDATE people.description for sennacherib (id: ${sennacheribId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "King of Assyria who invaded Judah, captured 46 fortified cities per his own Assyrian annals, and besieged Jerusalem. Sent his envoy Rabshakeh to demoralize the defenders with a speech in Hebrew mocking Hezekiah and the Lord. Sent a threatening letter when he heard of an Ethiopian threat. The Angel of the Lord struck down 185,000 in his camp in a single night; Sennacherib withdrew to Nineveh and was later killed by his own sons while worshipping in the temple of Nisrok.",
      sennacheribId,
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
