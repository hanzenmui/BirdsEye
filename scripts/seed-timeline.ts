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

type Row = [string, string, number, number];

// Thiele's chronology (The Mysterious Numbers of the Hebrew Kings) — the
// standard reconstruction used by most study Bibles.
const JUDAH_KINGS: Row[] = [
  ["Rehoboam", "", 931, 913],
  ["Abijah", "Abijam king of Judah, Abijah son of Rehoboam", 913, 911],
  ["Asa", "Asa king of Judah, son of Abijam", 911, 870],
  ["Jehoshaphat", "Jehoshaphat king of Judah, son of Asa", 870, 848],
  ["Jehoram", "Jehoram king of Judah, Joram king of Judah", 848, 841],
  ["Ahaziah", "Ahaziah king of Judah", 841, 841],
  ["Athaliah", "", 841, 835],
  ["Joash", "Joash king of Judah", 835, 796],
  ["Amaziah", "Amaziah king of Judah, son of Joash", 796, 767],
  ["Uzziah", "Uzziah king of Judah, Azariah king of Judah", 767, 740],
  ["Jotham", "Jotham king of Judah, son of Uzziah", 740, 732],
  ["Ahaz", "Ahaz king of Judah, son of Jotham", 732, 716],
  ["Hezekiah", "", 716, 687],
  ["Manasseh", "Manasseh king of Judah", 687, 643],
  ["Amon", "Amon king of Judah", 643, 641],
  ["Josiah", "", 641, 609],
  ["Jehoahaz", "Jehoahaz king of Judah, Shallum son of Josiah", 609, 609],
  ["Jehoiakim", "Jehoiakim king of Judah, Eliakim son of Josiah", 609, 598],
  ["Jehoiachin", "Jehoiachin king of Judah, Jeconiah, Coniah", 598, 597],
  ["Zedekiah", "Zedekiah king of Judah, Mattaniah son of Josiah", 597, 586],
];

const ISRAEL_KINGS: Row[] = [
  ["Jeroboam", "Jeroboam son of Nebat", 931, 910],
  ["Nadab", "Nadab king of Israel", 910, 909],
  ["Baasha", "Baasha king of Israel", 909, 886],
  ["Elah", "Elah king of Israel", 886, 885],
  ["Zimri", "Zimri king of Israel", 885, 885],
  ["Omri", "Omri king of Israel", 885, 874],
  ["Ahab", "", 874, 853],
  ["Ahaziah", "Ahaziah king of Israel", 853, 852],
  ["Joram", "Joram king of Israel, Jehoram king of Israel", 852, 841],
  ["Jehu", "Jehu son of Jehoshaphat", 841, 814],
  ["Jehoahaz", "Jehoahaz king of Israel", 814, 798],
  ["Jehoash", "Jehoash king of Israel", 798, 782],
  ["Jeroboam", "Jeroboam II king of Israel", 782, 753],
  ["Zechariah", "Zechariah king of Israel", 753, 752],
  ["Shallum", "Shallum king of Israel", 752, 752],
  ["Menahem", "Menahem king of Israel", 752, 742],
  ["Pekahiah", "Pekahiah king of Israel", 742, 740],
  ["Pekah", "Pekah king of Israel", 740, 732],
  ["Hoshea", "Hoshea king of Israel", 732, 722],
];

const UNITED_KINGS: Row[] = [
  ["Saul", "", 1047, 1010],
  ["David", "", 1010, 970],
  ["Solomon", "Jedidiah", 970, 931],
];

const MAJOR_PROPHETS: Row[] = [
  ["Isaiah", "Isaiah son of Amoz", 740, 680],
  ["Jeremiah", "", 627, 580],
  ["Ezekiel", "", 593, 570],
  ["Daniel", "Belteshazzar", 605, 530],
];

const MINOR_PROPHETS: Row[] = [
  ["Hosea", "Hosea son of Beeri", 760, 710],
  ["Amos", "", 760, 750],
  ["Micah", "Micah of Moresheth", 740, 700],
  ["Zephaniah", "", 630, 627],
  ["Nahum", "Nahum the Elkoshite", 663, 612],
  ["Habakkuk", "", 608, 598],
  ["Haggai", "", 520, 520],
  ["Zechariah", "Zechariah son of Berechiah", 520, 518],
  ["Malachi", "", 450, 430],
  ["Jonah", "Jonah son of Amittai", 780, 750],
  ["Joel", "Joel son of Pethuel", 835, 796],
  ["Obadiah", "Obadiah the prophet", 845, 840],
];

// One reconstruction among several — biblical durations (Judg 3–12) placed
// within the overlapping blocks scholars propose. All marked uncertain.
const JUDGES: Row[] = [
  ["Othniel", "", 1350, 1310],
  ["Ehud", "", 1309, 1229],
  ["Shamgar", "Shamgar son of Anath", 1230, 1220],
  ["Deborah", "Deborah wife of Lappidoth", 1209, 1169],
  ["Gideon", "Jerubbaal", 1191, 1151],
  ["Tola", "Tola son of Puah", 1149, 1126],
  ["Jair", "Jair the Gileadite", 1126, 1104],
  ["Samson", "", 1096, 1076],
  ["Jephthah", "", 1093, 1087],
  ["Ibzan", "Ibzan of Bethlehem", 1087, 1080],
  ["Elon", "Elon the Zebulunite", 1080, 1070],
  ["Abdon", "Abdon son of Hillel", 1070, 1062],
];

const JUDGES_NOTE = "The judges did not rule in a single sequence — several judged concurrently in different regions, and reconstructions differ by up to two centuries. The duration here follows the figure given in Judges; its placement follows one common reconstruction and should be treated as approximate.";

const UNCERTAIN_NOTES: Record<string, string> = {
  "Joel": "The book of Joel is not internally dated. Proposals range from the 9th century BC to the 2nd century BC. Placed here in the early pre-exilic range; a post-exilic date is equally defensible.",
  "Obadiah": "The book of Obadiah is not internally dated. Some place him in the 840s BC, others after Jerusalem's fall in 586 BC. Placed here in the earlier range.",
  "Habakkuk": "Sources split between c. 630 BC (before Babylon rose to power) and c. 608-598 BC (as the invasion loomed). Placed in the later window since the Chaldean threat is his central subject.",
};

async function stampDates(rows: Row[], track: string, confidence: string, noteFor: (name: string) => string) {
  for (const [name, aka, startBc, endBc] of rows) {
    const id = await resolvePerson(name, aka);
    if (!id) {
      console.warn(`  MISSING: ${name} (aka="${aka}") — not found, skipping`);
      continue;
    }
    const note = noteFor(name);
    console.log(`  ${DRY_RUN ? "would stamp" : "stamping"}: ${name} ${startBc}-${endBc} BC [${track}]`);
    if (!DRY_RUN) {
      await db.execute({
        sql: `UPDATE people SET timeline_start_bc = ?, timeline_end_bc = ?, timeline_track = ?,
              date_confidence = ?, date_uncertainty_note = ? WHERE id = ?`,
        args: [startBc, endBc, track, confidence, note, id],
      });
    }
  }
}

async function seedTimelineDates() {
  console.log("Stamping timeline dates...");
  await stampDates(JUDAH_KINGS,  "judah_king",    "firm", () => "");
  await stampDates(ISRAEL_KINGS, "israel_king",   "firm", () => "");
  await stampDates(UNITED_KINGS, "united_king",   "good", () => "");
  await stampDates(MAJOR_PROPHETS, "major_prophet", "good", () => "");
  await stampDates(MINOR_PROPHETS, "minor_prophet", "good",
    (name) => UNCERTAIN_NOTES[name] ?? "");
  await stampDates(JUDGES, "judge", "uncertain", () => JUDGES_NOTE);

  // The three genuinely-disputed prophets are downgraded after the fact so
  // the bulk minor-prophet pass stays simple.
  if (!DRY_RUN) {
    for (const name of Object.keys(UNCERTAIN_NOTES)) {
      await db.execute({
        sql: `UPDATE people SET date_confidence = 'uncertain'
              WHERE name = ? AND timeline_track = 'minor_prophet'`,
        args: [name],
      });
    }
  }
}

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== LIVE RUN ===");
  await seedMissingPeople();
  await seedTimelineDates();
  console.log("Done.");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
