// Timeline dataset: inserts the timeline figures missing from the DB, stamps
// timeline_* columns onto every Phase 1 king, judge, and prophet, seeds the
// historical_events and prophecy_links tables, and tags events with the book
// that narrates them. Descriptive/prose columns (people.description,
// historical_events.description/era/year_bc/date_uncertainty_note/
// date_confidence, scripture_refs.note, prophecy_links.explanation/
// uncertainty_note/fulfillment_event_id) are upserted: editing the data
// arrays below and re-running updates the live rows instead of no-op'ing.
// Idempotent — safe to re-run; a second run with unchanged data arrays
// produces neither inserts nor updates.
import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import { resolve } from "path";
import type { TimelineTrack, DateConfidence } from "../lib/types";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN ?? process.env.TURSO_DATABASE_TURSO_AUTH_TOKEN,
});

const DRY_RUN = process.argv.includes("--dry-run");

// Resolve an existing person by name + exact also_known_as. Returns null when
// absent. NEVER falls back to name-only matching — see the collision table in
// the plan; name-only would attach reign dates to the wrong person. Throws
// (rather than silently taking the first row) if (name, aka) is ambiguous —
// over 20 seeded rows resolve on an empty also_known_as, so a LIMIT 1 here
// would risk silently stamping the wrong person.
async function resolvePersonRow(name: string, aka: string): Promise<{ id: string; description: string } | null> {
  const r = await db.execute({
    sql: "SELECT id, description FROM people WHERE name = ? AND also_known_as = ?",
    args: [name, aka],
  });
  if (r.rows.length > 1) {
    throw new Error(
      `Ambiguous person match: ${r.rows.length} rows found for (name="${name}", aka="${aka}") — refusing to guess which one to update.`
    );
  }
  const row = r.rows[0] as unknown as { id: string; description: string } | undefined;
  return row ?? null;
}

async function resolvePerson(name: string, aka: string): Promise<string | null> {
  const row = await resolvePersonRow(name, aka);
  return row ? row.id : null;
}

// Insert a person if (name, also_known_as) isn't already present; otherwise
// update its description if the seed data's description has changed. Never
// touches name, also_known_as, gender, testament, tags, or the timeline
// columns on an existing row — those are owned elsewhere in this script.
async function upsertTimelinePerson(p: {
  name: string; alsoKnownAs: string; gender: string; description: string; tags: string[];
}): Promise<string> {
  const existing = await resolvePersonRow(p.name, p.alsoKnownAs);
  if (existing) {
    if (existing.description !== p.description) {
      console.log(`  ${DRY_RUN ? "would update" : "updating"}: ${p.name} (${p.alsoKnownAs}) description`);
      if (!DRY_RUN) {
        await db.execute({
          sql: "UPDATE people SET description = ? WHERE id = ?",
          args: [p.description, existing.id],
        });
      }
    }
    return existing.id;
  }
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
  await upsertTimelinePerson({ name: "Nadab", alsoKnownAs: "Nadab king of Israel",
    gender: "male", tags: ["king"],
    description: "Son of Jeroboam I and second king of the northern kingdom. Reigned two years before Baasha assassinated him while he besieged Gibbethon, wiping out Jeroboam's whole house. Not to be confused with Nadab son of Aaron." });
  await upsertTimelinePerson({ name: "Baasha", alsoKnownAs: "Baasha king of Israel",
    gender: "male", tags: ["king"],
    description: "Killed Nadab and seized the throne of Israel, destroying the house of Jeroboam. Reigned 24 years and warred continually with Asa of Judah." });
  await upsertTimelinePerson({ name: "Elah", alsoKnownAs: "Elah king of Israel",
    gender: "male", tags: ["king"],
    description: "Son of Baasha. Assassinated by his chariot commander Zimri while drinking himself drunk in Tirzah, ending Baasha's dynasty." });
  await upsertTimelinePerson({ name: "Zimri", alsoKnownAs: "Zimri king of Israel",
    gender: "male", tags: ["king"],
    description: "Chariot commander who murdered Elah and reigned just seven days. When the army proclaimed Omri king instead, Zimri burned the palace down over himself. Not to be confused with Zimri son of Salu." });
  await upsertTimelinePerson({ name: "Omri", alsoKnownAs: "Omri king of Israel",
    gender: "male", tags: ["king"],
    description: "Army commander made king by his troops. Founded Samaria as Israel's capital and began the Omride dynasty. So significant that Assyrian records called Israel 'the house of Omri' long after his death. Father of Ahab." });
  await upsertTimelinePerson({ name: "Jehoahaz", alsoKnownAs: "Jehoahaz king of Israel",
    gender: "male", tags: ["king"],
    description: "Son of Jehu. Reigned during Israel's lowest military ebb under Aramean oppression, left with only fifty horsemen. Not to be confused with Jehoahaz king of Judah." });
  await upsertTimelinePerson({ name: "Jehoash", alsoKnownAs: "Jehoash king of Israel",
    gender: "male", tags: ["king"],
    description: "Son of Jehoahaz. Recovered the cities his father lost to Aram, and defeated Amaziah of Judah. Wept at the deathbed of Elisha. Not to be confused with Joash king of Judah." });
  await upsertTimelinePerson({ name: "Zechariah", alsoKnownAs: "Zechariah king of Israel",
    gender: "male", tags: ["king"],
    description: "Son of Jeroboam II and the last of Jehu's dynasty. Reigned six months before Shallum assassinated him publicly, fulfilling the promise that Jehu's line would sit on Israel's throne to the fourth generation. Not the prophet." });
  await upsertTimelinePerson({ name: "Shallum", alsoKnownAs: "Shallum king of Israel",
    gender: "male", tags: ["king"],
    description: "Assassinated Zechariah and reigned one month before Menahem killed him in turn." });
  await upsertTimelinePerson({ name: "Menahem", alsoKnownAs: "Menahem king of Israel",
    gender: "male", tags: ["king"],
    description: "Seized the throne by killing Shallum. Bought off the Assyrian king Tiglath-pileser III with a thousand talents of silver extracted from Israel's wealthy men — the beginning of Israel's vassalage to Assyria." });
  await upsertTimelinePerson({ name: "Pekahiah", alsoKnownAs: "Pekahiah king of Israel",
    gender: "male", tags: ["king"],
    description: "Son of Menahem. Reigned two years before his own officer Pekah assassinated him in the citadel of the palace in Samaria." });

  // --- Minor judges absent from the DB (5) ---
  await upsertTimelinePerson({ name: "Tola", alsoKnownAs: "Tola son of Puah",
    gender: "male", tags: ["judge"],
    description: "Judge from the tribe of Issachar who led Israel twenty-three years from Shamir in the hill country of Ephraim. One of the 'minor judges' recorded without a narrative of his deeds." });
  await upsertTimelinePerson({ name: "Jair", alsoKnownAs: "Jair the Gileadite",
    gender: "male", tags: ["judge"],
    description: "Judge who led Israel twenty-two years. Had thirty sons who rode thirty donkeys and controlled thirty towns in Gilead." });
  await upsertTimelinePerson({ name: "Ibzan", alsoKnownAs: "Ibzan of Bethlehem",
    gender: "male", tags: ["judge"],
    description: "Judge for seven years. Had thirty sons and thirty daughters, marrying them all outside his clan." });
  await upsertTimelinePerson({ name: "Elon", alsoKnownAs: "Elon the Zebulunite",
    gender: "male", tags: ["judge"],
    description: "Judge from the tribe of Zebulun who led Israel ten years." });
  await upsertTimelinePerson({ name: "Abdon", alsoKnownAs: "Abdon son of Hillel",
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

async function stampDates(rows: Row[], track: TimelineTrack, confidence: DateConfidence, noteFor: (name: string) => string): Promise<Map<string, string>> {
  // Returns the resolved (name -> id) map so callers needing a follow-up
  // update (e.g. the minor-prophet confidence downgrade below) can address
  // rows by primary key instead of re-resolving by name, which can collide
  // with other people sharing that name elsewhere in the DB.
  const ids = new Map<string, string>();
  for (const [name, aka, startBc, endBc] of rows) {
    const id = await resolvePerson(name, aka);
    if (!id) {
      console.warn(`  MISSING: ${name} (aka="${aka}") — not found, skipping`);
      continue;
    }
    ids.set(name, id);
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
  return ids;
}

async function seedTimelineDates() {
  console.log("Stamping timeline dates...");
  await stampDates(JUDAH_KINGS,  "judah_king",    "firm", () => "");
  await stampDates(ISRAEL_KINGS, "israel_king",   "firm", () => "");
  await stampDates(UNITED_KINGS, "united_king",   "good", () => "");
  await stampDates(MAJOR_PROPHETS, "major_prophet", "good", () => "");
  const minorProphetIds = await stampDates(MINOR_PROPHETS, "minor_prophet", "good",
    (name) => UNCERTAIN_NOTES[name] ?? "");
  await stampDates(JUDGES, "judge", "uncertain", () => JUDGES_NOTE);

  // The three genuinely-disputed prophets are downgraded after the fact so
  // the bulk minor-prophet pass stays simple. Resolved by the id captured
  // during the MINOR_PROPHETS pass above — never by name alone, since the
  // DB contains other people sharing these names (e.g. multiple Obadiahs,
  // multiple Zechariahs) outside the minor_prophet track.
  if (!DRY_RUN) {
    for (const name of Object.keys(UNCERTAIN_NOTES)) {
      const id = minorProphetIds.get(name);
      if (!id) continue; // already reported as MISSING above
      await db.execute({
        sql: `UPDATE people SET date_confidence = 'uncertain' WHERE id = ?`,
        args: [id],
      });
    }
  }
}

type EventDef = {
  key: string; title: string; yearBc: number; era: string; description: string;
  dateUncertaintyNote?: string; dateConfidence?: DateConfidence;
};

const EVENTS: EventDef[] = [
  { key: "split", title: "The kingdom splits", yearBc: 931, era: "Divided Kingdom",
    description: "After Rehoboam refuses to lighten Solomon's heavy labor demands, ten northern tribes break away under Jeroboam. Israel and Judah are never reunited." },
  { key: "samaria", title: "Fall of Samaria", yearBc: 722, era: "Divided Kingdom",
    description: "Assyria captures Samaria after a siege and deports the northern population, resettling foreign peoples in their place. The northern kingdom of Israel ends permanently." },
  { key: "sennacherib", title: "Sennacherib's siege of Jerusalem fails", yearBc: 701, era: "Divided Kingdom",
    description: "Assyria overruns Judah's fortified cities and surrounds Jerusalem, but the city is delivered and Sennacherib withdraws — an outcome recorded in both Scripture and Assyrian annals, which conspicuously never claim the city was taken." },
  { key: "carchemish", title: "Babylon defeats Egypt at Carchemish", yearBc: 605, era: "Exile",
    description: "Nebuchadnezzar's victory makes Babylon the dominant power and brings Judah under its control. The first group of exiles, including Daniel, is taken to Babylon." },
  { key: "jerusalem", title: "Fall of Jerusalem and the Temple", yearBc: 586, era: "Exile",
    description: "After a long siege, Babylon breaches Jerusalem, burns the Temple, and carries Judah into exile. Zedekiah is blinded and taken in chains." },
  { key: "babylon", title: "Babylon falls to Cyrus", yearBc: 539, era: "Return",
    description: "The Medo-Persian army, under Cyrus's general Ugbaru, takes Babylon with little or no resistance. Belshazzar is killed the same night, and Cyrus himself enters the city in triumph about two weeks later. The Babylonian empire ends.",
    dateUncertaintyNote: "The Nabonidus (Babylonian) Chronicle, a contemporary record, says Ugbaru's forces entered Babylon without a battle and that Cyrus arrived separately, seventeen days afterward. A different story — that Persian troops diverted the Euphrates and entered under the river-gates by night — comes from Herodotus and Xenophon, Greek writers active a century or more later, and is generally treated by historians as legend rather than fact." },
  { key: "decree", title: "Cyrus decrees the return", yearBc: 538, era: "Return",
    description: "Cyrus issues a decree permitting the exiles to return to Jerusalem and rebuild the Temple, and restores the Temple vessels Nebuchadnezzar had carried off." },
  { key: "temple", title: "The second Temple is completed", yearBc: 516, era: "Return",
    description: "Spurred on by Haggai and Zechariah, the returned exiles finish rebuilding the Temple, roughly seventy years after its destruction." },
  { key: "wall", title: "Nehemiah rebuilds Jerusalem's wall", yearBc: 445, era: "Return",
    description: "Nehemiah leads the rebuilding of Jerusalem's wall in fifty-two days despite sustained opposition, restoring the city's security and identity." },
  { key: "nineveh", title: "Fall of Nineveh", yearBc: 612, era: "Divided Kingdom",
    description: "A coalition of Babylonians and Medes storms Nineveh, Assyria's capital, and destroys it. The empire that had deported the northern kingdom over a century earlier collapses for good." },
];

const eventIds: Record<string, string> = {};

async function seedEvents() {
  console.log("Seeding historical events...");
  for (const e of EVENTS) {
    const dateConfidence: DateConfidence = e.dateConfidence ?? "firm";
    const dateUncertaintyNote = e.dateUncertaintyNote ?? "";
    const existing = await db.execute({
      sql: `SELECT id, description, era, year_bc, date_uncertainty_note, date_confidence
            FROM historical_events WHERE title = ? LIMIT 1`,
      args: [e.title],
    });
    const row = existing.rows[0] as unknown as {
      id: string; description: string; era: string; year_bc: number;
      date_uncertainty_note: string; date_confidence: string;
    } | undefined;

    if (row) {
      eventIds[e.key] = row.id;
      const changed = row.description !== e.description || row.era !== e.era || row.year_bc !== e.yearBc
        || row.date_uncertainty_note !== dateUncertaintyNote || row.date_confidence !== dateConfidence;
      if (changed) {
        console.log(`  ${DRY_RUN ? "would update" : "updating"} event: ${e.title}`);
        if (!DRY_RUN) {
          await db.execute({
            sql: `UPDATE historical_events
                  SET description = ?, era = ?, year_bc = ?, date_uncertainty_note = ?, date_confidence = ?
                  WHERE id = ?`,
            args: [e.description, e.era, e.yearBc, dateUncertaintyNote, dateConfidence, row.id],
          });
        }
      }
      continue;
    }

    const id = crypto.randomUUID();
    eventIds[e.key] = id;
    console.log(`  ${DRY_RUN ? "would insert" : "inserting"} event: ${e.title} (${e.yearBc} BC)`);
    if (!DRY_RUN) {
      await db.execute({
        sql: `INSERT INTO historical_events (id,title,year_bc,era,description,date_uncertainty_note,date_confidence,created_at)
              VALUES (?,?,?,?,?,?,?,datetime('now'))`,
        args: [id, e.title, e.yearBc, e.era, e.description, dateUncertaintyNote, dateConfidence],
      });
    }
  }
}

type LinkDef = {
  prophet: string; aka: string; book: string; cs: number; vs: number; ce: number; ve: number;
  eventKey: string; explanation: string; uncertaintyNote?: string;
};

const LINKS: LinkDef[] = [
  { prophet: "Isaiah", aka: "Isaiah son of Amoz", book: "Isaiah", cs: 37, vs: 33, ce: 37, ve: 35, eventKey: "sennacherib",
    explanation: "Isaiah told Hezekiah the Assyrian king would not shoot an arrow into Jerusalem or even reach it. Sennacherib withdrew without taking the city." },
  { prophet: "Isaiah", aka: "Isaiah son of Amoz", book: "Isaiah", cs: 39, vs: 5, ce: 39, ve: 7, eventKey: "jerusalem",
    explanation: "Isaiah warned Hezekiah that everything in his palace would one day be carried off to Babylon, and his own descendants taken. It happened roughly a century later." },
  { prophet: "Isaiah", aka: "Isaiah son of Amoz", book: "Isaiah", cs: 44, vs: 28, ce: 45, ve: 1, eventKey: "decree",
    explanation: "Isaiah named Cyrus as the ruler who would order Jerusalem rebuilt — written long before Cyrus came to power.",
    uncertaintyNote: "Scholars divide over whether Isaiah 40-66 was written by the 8th-century prophet Isaiah son of Amoz, which would make the naming of Cyrus a specific predictive prophecy, or by a later author writing during the exile itself. This timeline follows the traditional attribution to Isaiah son of Amoz." },
  { prophet: "Jeremiah", aka: "", book: "Jeremiah", cs: 25, vs: 11, ce: 25, ve: 12, eventKey: "jerusalem",
    explanation: "Jeremiah foretold that Judah would serve Babylon and the land would lie desolate. Jerusalem fell in 586 BC." },
  { prophet: "Jeremiah", aka: "", book: "Jeremiah", cs: 29, vs: 10, ce: 29, ve: 10, eventKey: "decree",
    explanation: "Jeremiah promised God would bring the exiles back after seventy years in Babylon. Cyrus's decree in 538 BC began that return." },
  { prophet: "Hosea", aka: "Hosea son of Beeri", book: "Hosea", cs: 13, vs: 16, ce: 13, ve: 16, eventKey: "samaria",
    explanation: "Hosea warned that Samaria would bear its guilt for rebelling against God. Assyria destroyed the city in 722 BC." },
  { prophet: "Micah", aka: "Micah of Moresheth", book: "Micah", cs: 3, vs: 12, ce: 3, ve: 12, eventKey: "jerusalem",
    explanation: "Micah declared Jerusalem would become a heap of rubble. Jeremiah's hearers still remembered this prophecy a century later (Jer 26:18)." },
  { prophet: "Nahum", aka: "Nahum the Elkoshite", book: "Nahum", cs: 3, vs: 18, ce: 3, ve: 19, eventKey: "nineveh",
    explanation: "Nahum announced the destruction of Nineveh, declaring that Assyria's wound was fatal and no one would mourn its fall. Nineveh fell to the Medo-Babylonian coalition in 612 BC." },
  { prophet: "Daniel", aka: "Belteshazzar", book: "Daniel", cs: 5, vs: 25, ce: 5, ve: 28, eventKey: "babylon",
    explanation: "Reading the writing on the wall, Daniel told Belshazzar his kingdom was finished and given to the Medes and Persians. Babylon fell that same night." },
  { prophet: "Haggai", aka: "", book: "Haggai", cs: 1, vs: 7, ce: 1, ve: 8, eventKey: "temple",
    explanation: "Haggai rebuked the returned exiles for leaving the Temple in ruins while living in paneled houses, and urged them to rebuild. The Temple was finished in 516 BC." },
];

async function seedProphecyLinks() {
  console.log("Seeding prophecy links...");
  for (const l of LINKS) {
    const prophetId = await resolvePerson(l.prophet, l.aka);
    if (!prophetId) { console.warn(`  MISSING prophet: ${l.prophet} (aka="${l.aka}")`); continue; }
    const eventId = eventIds[l.eventKey];
    if (!eventId) { console.warn(`  MISSING event key: ${l.eventKey}`); continue; }
    const uncertaintyNote = l.uncertaintyNote ?? "";

    // Look up by the prophecy's own identity (who said it, where it's
    // recorded) rather than by fulfillment event, so a corrected
    // misattribution repoints the existing row instead of leaving the old,
    // wrong fulfillment_event_id behind as an orphaned duplicate.
    const existing = await db.execute({
      sql: `SELECT id, fulfillment_event_id, explanation, uncertainty_note FROM prophecy_links
            WHERE prophet_person_id = ? AND prophecy_book = ? AND prophecy_chapter_start = ? AND prophecy_verse_start = ?
            LIMIT 1`,
      args: [prophetId, l.book, l.cs, l.vs],
    });
    const row = existing.rows[0] as unknown as {
      id: string; fulfillment_event_id: string; explanation: string; uncertainty_note: string;
    } | undefined;

    if (row) {
      // Explanation and uncertainty_note are always kept in sync with the
      // seed data (an explanation-only correction is not a no-op just
      // because the fulfillment event didn't change); fulfillment_event_id
      // is only touched when it actually differs.
      const changed = row.fulfillment_event_id !== eventId
        || row.explanation !== l.explanation || row.uncertainty_note !== uncertaintyNote;
      if (changed) {
        console.log(`  ${DRY_RUN ? "would update" : "updating"}: ${l.prophet} ${l.book} ${l.cs}:${l.vs} -> ${l.eventKey}`);
        if (!DRY_RUN) {
          await db.execute({
            sql: `UPDATE prophecy_links SET fulfillment_event_id = ?, explanation = ?, uncertainty_note = ? WHERE id = ?`,
            args: [eventId, l.explanation, uncertaintyNote, row.id],
          });
        }
      }
      continue;
    }

    console.log(`  ${DRY_RUN ? "would link" : "linking"}: ${l.prophet} ${l.book} ${l.cs}:${l.vs} -> ${l.eventKey}`);
    if (!DRY_RUN) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO prophecy_links
              (id,prophet_person_id,prophecy_book,prophecy_chapter_start,prophecy_verse_start,
               prophecy_chapter_end,prophecy_verse_end,fulfillment_event_id,explanation,uncertainty_note,created_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))`,
        args: [crypto.randomUUID(), prophetId, l.book, l.cs, l.vs, l.ce, l.ve, eventId, l.explanation, uncertaintyNote],
      });
    }
  }
}

// Which book narrates each event. Stored in scripture_refs with person_id=''
// and event_id set, so the existing book-tag machinery covers events too.
const EVENT_REFS: { key: string; book: string; cs: number; vs: number; ce: number; ve: number; note: string }[] = [
  { key: "split",       book: "1 Kings",   cs: 12, vs: 1,  ce: 12, ve: 24, note: "The northern tribes reject Rehoboam" },
  { key: "samaria",     book: "2 Kings",   cs: 17, vs: 1,  ce: 17, ve: 23, note: "Assyria captures Samaria and deports Israel" },
  { key: "sennacherib", book: "2 Kings",   cs: 19, vs: 32, ce: 19, ve: 36, note: "Sennacherib withdraws from Jerusalem" },
  { key: "carchemish",  book: "Daniel",    cs: 1,  vs: 1,  ce: 1,  ve: 2,  note: "Nebuchadnezzar besieges Jerusalem; first exiles taken" },
  { key: "jerusalem",   book: "2 Kings",   cs: 25, vs: 1,  ce: 25, ve: 21, note: "Jerusalem falls and the Temple is burned" },
  { key: "babylon",     book: "Daniel",    cs: 5,  vs: 30, ce: 5,  ve: 31, note: "Belshazzar is killed and Babylon falls" },
  { key: "decree",      book: "Ezra",      cs: 1,  vs: 1,  ce: 1,  ve: 4,  note: "Cyrus decrees the return and rebuilding" },
  { key: "temple",      book: "Ezra",      cs: 6,  vs: 14, ce: 6,  ve: 15, note: "The second Temple is completed" },
  { key: "wall",        book: "Nehemiah",  cs: 6,  vs: 15, ce: 6,  ve: 15, note: "The wall is finished in fifty-two days" },
  { key: "nineveh",     book: "Nahum",     cs: 3,  vs: 1,  ce: 3,  ve: 7,  note: "Nahum describes Nineveh's fall" },
];

async function seedEventRefs() {
  console.log("Tagging events with their narrating book...");
  for (const r of EVENT_REFS) {
    const eventId = eventIds[r.key];
    if (!eventId) { console.warn(`  MISSING event key: ${r.key}`); continue; }
    // Match on the full verse range, not just chapter_start — two refs for
    // the same event/book differing only by verse span would otherwise be
    // indistinguishable and the second would silently never insert or update.
    const existing = await db.execute({
      sql: `SELECT id, note FROM scripture_refs
            WHERE event_id = ? AND book = ? AND chapter_start = ? AND verse_start = ? AND chapter_end = ? AND verse_end = ?
            LIMIT 1`,
      args: [eventId, r.book, r.cs, r.vs, r.ce, r.ve],
    });
    const row = existing.rows[0] as unknown as { id: string; note: string } | undefined;

    if (row) {
      if (row.note !== r.note) {
        console.log(`  ${DRY_RUN ? "would update" : "updating"}: ${r.key} -> ${r.book} ${r.cs}:${r.vs} note`);
        if (!DRY_RUN) {
          await db.execute({
            sql: "UPDATE scripture_refs SET note = ? WHERE id = ?",
            args: [r.note, row.id],
          });
        }
      }
      continue;
    }

    console.log(`  ${DRY_RUN ? "would tag" : "tagging"}: ${r.key} -> ${r.book} ${r.cs}:${r.vs}`);
    if (!DRY_RUN) {
      await db.execute({
        sql: `INSERT INTO scripture_refs
              (id,person_id,event_id,book,chapter_start,verse_start,chapter_end,verse_end,note,created_at)
              VALUES (?,'',?,?,?,?,?,?,?,datetime('now'))`,
        args: [crypto.randomUUID(), eventId, r.book, r.cs, r.vs, r.ce, r.ve, r.note],
      });
    }
  }
}

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== LIVE RUN ===");
  await seedMissingPeople();
  await seedTimelineDates();
  await seedEvents();
  await seedEventRefs();
  await seedProphecyLinks();
  console.log("Done.");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
