// Timeline dataset: inserts the timeline figures missing from the DB, then
// stamps timeline_* columns onto every Phase 1 king, judge, and prophet.
// Idempotent — safe to re-run.
import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN ?? process.env.TURSO_DATABASE_TURSO_AUTH_TOKEN,
});

const DRY_RUN = process.argv.includes("--dry-run");

// Resolve an existing person by name + exact also_known_as. Returns null when
// absent. NEVER falls back to name-only matching — see the collision table in
// the plan; name-only would attach reign dates to the wrong person.
async function resolvePerson(name: string, aka: string): Promise<string | null> {
  const r = await db.execute({
    sql: "SELECT id FROM people WHERE name = ? AND also_known_as = ? LIMIT 1",
    args: [name, aka],
  });
  const row = r.rows[0] as unknown as { id: string } | undefined;
  return row ? row.id : null;
}

// Insert a person only if (name, also_known_as) isn't already present.
async function safeInsertTimelinePerson(p: {
  name: string; alsoKnownAs: string; gender: string; description: string; tags: string[];
}): Promise<string> {
  const existing = await resolvePerson(p.name, p.alsoKnownAs);
  if (existing) return existing;
  const id = crypto.randomUUID();
  console.log(`  ${DRY_RUN ? "would insert" : "inserting"}: ${p.name} (${p.alsoKnownAs})`);
  if (!DRY_RUN) {
    await db.execute({
      sql: `INSERT INTO people (id,name,also_known_as,gender,testament,birth_year,death_year,description,tags,created_at)
            VALUES (?,?,?,?,'OT','','',?,?,datetime('now'))`,
      args: [id, p.name, p.alsoKnownAs, p.gender, p.description, JSON.stringify(p.tags)],
    });
  }
  return id;
}

async function seedMissingPeople() {
  console.log("Inserting missing timeline people...");

  // --- Kings of Israel absent from the DB (11) ---
  await safeInsertTimelinePerson({ name: "Nadab", alsoKnownAs: "Nadab king of Israel",
    gender: "male", tags: ["king"],
    description: "Son of Jeroboam I and second king of the northern kingdom. Reigned two years before Baasha assassinated him while he besieged Gibbethon, wiping out Jeroboam's whole house. Not to be confused with Nadab son of Aaron." });
  await safeInsertTimelinePerson({ name: "Baasha", alsoKnownAs: "Baasha king of Israel",
    gender: "male", tags: ["king"],
    description: "Killed Nadab and seized the throne of Israel, destroying the house of Jeroboam. Reigned 24 years and warred continually with Asa of Judah." });
  await safeInsertTimelinePerson({ name: "Elah", alsoKnownAs: "Elah king of Israel",
    gender: "male", tags: ["king"],
    description: "Son of Baasha. Assassinated by his chariot commander Zimri while drinking himself drunk in Tirzah, ending Baasha's dynasty." });
  await safeInsertTimelinePerson({ name: "Zimri", alsoKnownAs: "Zimri king of Israel",
    gender: "male", tags: ["king"],
    description: "Chariot commander who murdered Elah and reigned just seven days. When the army proclaimed Omri king instead, Zimri burned the palace down over himself. Not to be confused with Zimri son of Salu." });
  await safeInsertTimelinePerson({ name: "Omri", alsoKnownAs: "Omri king of Israel",
    gender: "male", tags: ["king"],
    description: "Army commander made king by his troops. Founded Samaria as Israel's capital and began the Omride dynasty. So significant that Assyrian records called Israel 'the house of Omri' long after his death. Father of Ahab." });
  await safeInsertTimelinePerson({ name: "Jehoahaz", alsoKnownAs: "Jehoahaz king of Israel",
    gender: "male", tags: ["king"],
    description: "Son of Jehu. Reigned during Israel's lowest military ebb under Aramean oppression, left with only fifty horsemen. Not to be confused with Jehoahaz king of Judah." });
  await safeInsertTimelinePerson({ name: "Jehoash", alsoKnownAs: "Jehoash king of Israel",
    gender: "male", tags: ["king"],
    description: "Son of Jehoahaz. Recovered the cities his father lost to Aram, and defeated Amaziah of Judah. Wept at the deathbed of Elisha. Not to be confused with Joash king of Judah." });
  await safeInsertTimelinePerson({ name: "Zechariah", alsoKnownAs: "Zechariah king of Israel",
    gender: "male", tags: ["king"],
    description: "Son of Jeroboam II and the last of Jehu's dynasty. Reigned six months before Shallum assassinated him publicly, fulfilling the promise that Jehu's line would sit on Israel's throne to the fourth generation. Not the prophet." });
  await safeInsertTimelinePerson({ name: "Shallum", alsoKnownAs: "Shallum king of Israel",
    gender: "male", tags: ["king"],
    description: "Assassinated Zechariah and reigned one month before Menahem killed him in turn." });
  await safeInsertTimelinePerson({ name: "Menahem", alsoKnownAs: "Menahem king of Israel",
    gender: "male", tags: ["king"],
    description: "Seized the throne by killing Shallum. Bought off the Assyrian king Tiglath-pileser III with a thousand talents of silver extracted from Israel's wealthy men — the beginning of Israel's vassalage to Assyria." });
  await safeInsertTimelinePerson({ name: "Pekahiah", alsoKnownAs: "Pekahiah king of Israel",
    gender: "male", tags: ["king"],
    description: "Son of Menahem. Reigned two years before his own officer Pekah assassinated him in the citadel of the palace in Samaria." });

  // --- Minor judges absent from the DB (5) ---
  await safeInsertTimelinePerson({ name: "Tola", alsoKnownAs: "Tola son of Puah",
    gender: "male", tags: ["judge"],
    description: "Judge from the tribe of Issachar who led Israel twenty-three years from Shamir in the hill country of Ephraim. One of the 'minor judges' recorded without a narrative of his deeds." });
  await safeInsertTimelinePerson({ name: "Jair", alsoKnownAs: "Jair the Gileadite",
    gender: "male", tags: ["judge"],
    description: "Judge who led Israel twenty-two years. Had thirty sons who rode thirty donkeys and controlled thirty towns in Gilead." });
  await safeInsertTimelinePerson({ name: "Ibzan", alsoKnownAs: "Ibzan of Bethlehem",
    gender: "male", tags: ["judge"],
    description: "Judge for seven years. Had thirty sons and thirty daughters, marrying them all outside his clan." });
  await safeInsertTimelinePerson({ name: "Elon", alsoKnownAs: "Elon the Zebulunite",
    gender: "male", tags: ["judge"],
    description: "Judge from the tribe of Zebulun who led Israel ten years." });
  await safeInsertTimelinePerson({ name: "Abdon", alsoKnownAs: "Abdon son of Hillel",
    gender: "male", tags: ["judge"],
    description: "Judge for eight years. Had forty sons and thirty grandsons who rode seventy donkeys." });
}

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== LIVE RUN ===");
  await seedMissingPeople();
  console.log("Done.");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
