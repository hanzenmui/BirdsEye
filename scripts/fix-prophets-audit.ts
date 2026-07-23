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
  const baruchId = await resolveExisting("baruch", "Baruch", "Baruch son of Neriah");
  const pashhurId = await resolveExisting("pashhur_jeremiah", "Pashhur", "Pashhur son of Immer");
  const jonahId = await resolveExisting("jonah", "Jonah", "Jonah son of Amittai");
  const malachiId = await resolveExisting("malachi", "Malachi");
  const haggaiId = await resolveExisting("haggai", "Haggai");
  const habakkukId = await resolveExisting("habakkuk", "Habakkuk");
  const jeroboam2Id = await resolveExisting("jeroboam2", "Jeroboam", "Jeroboam II king of Israel");

  // ───────────────────────────────────────────────────────────────────────
  // Finding 1: baruch.description (scripts/seed-prophets.ts line 111) frames
  // Baruch's trip to Egypt with Jeremiah as "Tradition holds," but Jeremiah
  // 43:6 (ESV) states this directly as scriptural fact, not tradition.
  // Replace with a direct statement citing the verse.
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 1", `UPDATE people.description for baruch (id: ${baruchId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Son of Neriah, Jeremiah's secretary and loyal companion. Wrote Jeremiah's dictated words in a scroll and read them publicly in the Temple when Jeremiah was banned from entering. The scroll was burned by King Jehoiakim but rewritten. Baruch was given a personal oracle of comfort when he complained about his hardship. He preserved and transmitted the book of Jeremiah. He accompanied Jeremiah to Egypt after Gedaliah's assassination (Jer 43:6).",
      baruchId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 2: pashhur_jeremiah.description (scripts/seed-prophets.ts line
  // 121) says Jeremiah was stocked at "the Upper Gate," but Jeremiah 20:2
  // (ESV) specifies "the upper Benjamin Gate" — a different, more specific
  // gate than the "upper gate of the house of the LORD" (2 Kgs 15:35).
  // Restore the "Benjamin" identifier to avoid conflating the two gates.
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 2", `UPDATE people.description for pashhur_jeremiah (id: ${pashhurId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Chief officer in the Temple, son of Immer. Had Jeremiah beaten and put in stocks at the upper Benjamin Gate for prophesying Jerusalem's destruction. Jeremiah renamed him 'Magor-Missabib' (terror on every side) and prophesied he would die in Babylon. A different Pashhur son of Malchijah also appears in Jeremiah as an opponent.",
      pashhurId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 3: jonah.description (scripts/seed-prophets.ts line 165) quotes
  // God's closing question in Jonah 4:11 as "Should I not have concern for
  // the great city of Nineveh?" but the ESV renders it "And should not I
  // pity Nineveh, that great city...?" — "concern" is the NIV's wording,
  // not the ESV's. Replace the quote with the ESV's actual wording.
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 3", `UPDATE people.description for jonah (id: ${jonahId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Son of Amittai, from Gath-hepher in Zebulun (mentioned in 2 Kings 14:25 as prophesying during Jeroboam II's reign). Called by God to preach repentance to Nineveh, the Assyrian capital. Fled by ship to Tarshish; a great storm arose; cast into the sea at his own request and swallowed by a great fish for three days and nights. Prayed from the fish's belly; was vomited onto land. Preached to Nineveh; the entire city repented and God relented from the judgment. Jonah was angry at God's mercy toward Israel's enemies. God's response forms the book's climax: 'Should not I pity Nineveh, that great city?' Jesus cited Jonah's three days as a sign of his own death and resurrection.",
      jonahId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 4: malachi.description (scripts/seed-prophets.ts line 207)
  // quotes Malachi 4:5 as "the great and terrible Day of the Lord," but the
  // ESV renders it "the great and awesome day of the Lord" ("terrible" is
  // the KJV's wording). Replace with the ESV's actual wording.
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 4", `UPDATE people.description for malachi (id: ${malachiId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "The last of the Old Testament prophets (c. 430 BC), writing after the Temple had been rebuilt and the community had grown spiritually lax. Structured as a series of disputations between God and the people. Rebuked corrupt priesthood, faithless worship, divorce, and neglect of tithes. Promised the 'messenger of the covenant' (Mal 3:1 — identified by Jesus as referring to John the Baptist), and closed with the prophecy of 'Elijah' returning before 'the great and awesome day of the Lord' (Mal 4:5-6 — also applied to John the Baptist). The last word of the Old Testament canon.",
      malachiId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 5: haggai.description (scripts/seed-prophets.ts line 195) quotes
  // Haggai 1:5/1:7 as "Give careful thought to your ways," but the ESV
  // renders it "Consider your ways" ("Give careful thought to your ways" is
  // the NIV's wording). Replace with the ESV's actual wording.
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 5", `UPDATE people.description for haggai (id: ${haggaiId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Post-exilic prophet who delivered four oracles in a four-month period during the second year of Darius I (520 BC). The returned exiles had stopped rebuilding the Temple and were focused on their own paneled houses. Haggai challenged them: 'Consider your ways.' Under his and Zechariah's preaching, Zerubbabel and Jeshua resumed the work and completed the Temple in 516 BC.",
      haggaiId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 7: habakkuk.description (scripts/seed-prophets.ts line 183)
  // quotes Habakkuk 3:17 as "the fig tree does not blossom," but the ESV
  // renders it "the fig tree should not blossom." Replace with the ESV's
  // actual wording. (Note: Finding 6, on the same field's "the righteous
  // shall live by faith" quote, is non-prescriptive per the findings doc and
  // is deliberately left unchanged here — only the fig-tree phrase, which
  // Finding 7 does mandate a fix for, is corrected.)
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 7", `UPDATE people.description for habakkuk (id: ${habakkukId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Prophet in Judah, probably during Jehoiakim's reign (c. 605 BC). Uniquely, his book is structured as a dialogue with God: Habakkuk complains that God is silent while injustice reigns; God answers that the Babylonians will come as his instrument; Habakkuk complains that using Babylon is unjust; God declares 'the righteous shall live by faith' (Hab 2:4 — quoted in Romans, Galatians, and Hebrews). The book ends with one of the most beautiful expressions of faith in the Bible: 'Though the fig tree should not blossom…yet I will rejoice in the Lord.'",
      habakkukId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 8: scripts/seed-prophets.ts lines 230-231 insert a second,
  // near-duplicate relationship between Jonah and Jeroboam II —
  // insertRelByAkaToName("Jeroboam", "Jeroboam II king of Israel", "other",
  // "Jonah", ...) — describing the same underlying fact (2 Kgs 14:25) that
  // scripts/seed-2kings.ts line 244 already establishes via
  // insertRelNameToLocal("Jonah", "ally_of", "jeroboam2", ...), just with
  // person_a/person_b reversed and an inconsistent type ("other" vs.
  // "ally_of"). The relationships table has no unique constraint on
  // (person_a, person_b, type), so both rows persist side by side. Per the
  // findings doc's proposed correction (remove the redundant call) and the
  // task brief's preferred default for a flagged "duplicate" finding, delete
  // the newly-introduced duplicate row (person_a=Jeroboam II, type="other",
  // person_b=Jonah) and keep the pre-existing seed-2kings.ts row
  // (person_a=Jonah, type="ally_of", person_b=Jeroboam II) as the single
  // surviving relationship for this fact.
  // ───────────────────────────────────────────────────────────────────────

  {
    const dupRelId = await resolveRelationship(jeroboam2Id, "other", jonahId);
    await run("Finding 8", `DELETE duplicate relationship row (id: ${dupRelId}) — Jeroboam II "other" Jonah, duplicating the pre-existing Jonah "ally_of" Jeroboam II row from seed-2kings.ts`, {
      sql: `DELETE FROM relationships WHERE id = ?`,
      args: [dupRelId],
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
