// Verification suite for the timeline dataset. This project has no test
// framework; these assertions are the test suite. Run: npx tsx scripts/verify-timeline.ts
import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import { resolve } from "path";
import { BOOK_COVERAGE } from "../lib/types";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN ?? process.env.TURSO_DATABASE_TURSO_AUTH_TOKEN,
});

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (ok) { console.log(`  PASS  ${label}`); }
  else { console.log(`  FAIL  ${label}${detail ? " — " + detail : ""}`); failures++; }
}

async function checkApiShape() {
  // The route is the only consumer-facing surface; assert the SQL it runs
  // returns the shape the UI plan will depend on.
  const people = await db.execute(
    "SELECT * FROM people WHERE timeline_start_bc IS NOT NULL ORDER BY timeline_start_bc DESC"
  );
  const events = await db.execute("SELECT * FROM historical_events ORDER BY year_bc DESC");
  const links = await db.execute("SELECT * FROM prophecy_links");
  check("timeline people present", people.rows.length > 0, `got ${people.rows.length}`);
  check("historical events present", events.rows.length > 0, `got ${events.rows.length}`);
  check("prophecy links present", links.rows.length > 0, `got ${links.rows.length}`);
}

async function checkLaneIntegrity() {
  // Single-row lanes must not have two people whose reigns overlap — that
  // would mean a data error (or a co-regency needing an explicit decision).
  for (const track of ["judah_king", "israel_king", "united_king"]) {
    const r = await db.execute({
      sql: `SELECT a.name AS an, b.name AS bn FROM people a JOIN people b
            ON a.timeline_track = b.timeline_track AND a.id < b.id
            WHERE a.timeline_track = ?
              AND a.timeline_start_bc > b.timeline_end_bc
              AND b.timeline_start_bc > a.timeline_end_bc`,
      args: [track],
    });
    check(`${track}: no overlapping reigns in single-row lane`, r.rows.length === 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      r.rows.map((x: any) => `${x.an}/${x.bn}`).join(", "));
  }
  // Every timeline person needs a valid track and a sane span.
  const bad = await db.execute(`
    SELECT name, timeline_track, timeline_start_bc, timeline_end_bc FROM people
    WHERE timeline_start_bc IS NOT NULL
      AND (timeline_track = '' OR timeline_end_bc IS NULL OR timeline_end_bc > timeline_start_bc)`);
  check("every timeline person has a track and start >= end (BC counts down)",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bad.rows.length === 0, bad.rows.map((x: any) => x.name).join(", "));

  // Enum vocabularies aren't validated at the type level for seeded data —
  // a typo like "minor_prophets" would typecheck and seed silently. Assert
  // real membership here instead of trusting TypeScript alone.
  const badTrack = await db.execute(`
    SELECT name, timeline_track FROM people
    WHERE timeline_start_bc IS NOT NULL
      AND timeline_track NOT IN ('judah_king','israel_king','united_king','judge','major_prophet','minor_prophet')`);
  check("every timeline person has a recognized timeline_track", badTrack.rows.length === 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    badTrack.rows.map((x: any) => `${x.name}=${x.timeline_track}`).join(", "));

  const badConfidence = await db.execute(`
    SELECT name, date_confidence FROM people
    WHERE timeline_start_bc IS NOT NULL
      AND date_confidence NOT IN ('firm','good','uncertain')`);
  check("every timeline person has a recognized date_confidence", badConfidence.rows.length === 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    badConfidence.rows.map((x: any) => `${x.name}=${x.date_confidence}`).join(", "));

  // Uncertain-dated figures must carry an explanatory note — the whole point
  // of the confidence tier is that the UI can be honest about it.
  const noNote = await db.execute(`
    SELECT name FROM people WHERE date_confidence = 'uncertain' AND date_uncertainty_note = ''`);
  check("every uncertain figure has a note", noNote.rows.length === 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    noNote.rows.map((x: any) => x.name).join(", "));
}

async function checkProphecyIntegrity() {
  const orphanEvent = await db.execute(`
    SELECT pl.id FROM prophecy_links pl
    LEFT JOIN historical_events e ON e.id = pl.fulfillment_event_id
    WHERE e.id IS NULL`);
  check("every prophecy link points at a real event", orphanEvent.rows.length === 0,
    `${orphanEvent.rows.length} orphaned`);

  const orphanProphet = await db.execute(`
    SELECT pl.id FROM prophecy_links pl
    LEFT JOIN people p ON p.id = pl.prophet_person_id
    WHERE p.id IS NULL`);
  check("every prophecy link points at a real person", orphanProphet.rows.length === 0,
    `${orphanProphet.rows.length} orphaned`);

  // A prophecy must be spoken before it is fulfilled. Catches transposed dates.
  const backwards = await db.execute(`
    SELECT p.name, e.title FROM prophecy_links pl
    JOIN people p ON p.id = pl.prophet_person_id
    JOIN historical_events e ON e.id = pl.fulfillment_event_id
    WHERE p.timeline_start_bc < e.year_bc`);
  check("no prophecy is fulfilled before its prophet began", backwards.rows.length === 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    backwards.rows.map((x: any) => `${x.name}->${x.title}`).join(", "));

  const noExplain = await db.execute(`SELECT id FROM prophecy_links WHERE explanation = ''`);
  check("every prophecy link has a plain-language explanation", noExplain.rows.length === 0);

  // Without a book tag an event can never appear under any book checkbox.
  const untagged = await db.execute(`
    SELECT e.title FROM historical_events e
    LEFT JOIN scripture_refs sr ON sr.event_id = e.id
    WHERE sr.id IS NULL`);
  check("every event is tagged to a book", untagged.rows.length === 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    untagged.rows.map((x: any) => x.title).join(", "));

  // An event-owned ref must not also claim a person, and vice versa.
  const bothOwners = await db.execute(`
    SELECT id FROM scripture_refs WHERE event_id IS NOT NULL AND event_id != '' AND person_id != ''`);
  check("no scripture_ref claims both a person and an event", bothOwners.rows.length === 0);

  // Regression guard for the By Book counts: no person-owned ref may have an
  // empty person_id, or Explorer's countByBook Set gets a phantom member.
  const emptyPerson = await db.execute(`
    SELECT id FROM scripture_refs WHERE person_id = '' AND (event_id IS NULL OR event_id = '')`);
  check("no orphaned scripture_ref with neither owner", emptyPerson.rows.length === 0);
}

// The Books layer's prophetic spans (lib/types.ts BOOK_COVERAGE) intentionally
// mirror each prophet's ministry dates in the DB. Nothing enforces that at the
// type level, so assert it here — otherwise editing a prophet's dates in the
// seed would silently leave the book's bar pointing somewhere else.
async function checkBookCoverageMatchesProphets() {
  const PROPHET_BOOKS: [string, string, string][] = [
    // [book, prophet name, prophet also_known_as]
    ["Isaiah", "Isaiah", "Isaiah son of Amoz"],
    ["Jeremiah", "Jeremiah", ""],
    ["Ezekiel", "Ezekiel", ""],
    ["Daniel", "Daniel", "Belteshazzar"],
    ["Hosea", "Hosea", "Hosea son of Beeri"],
    ["Joel", "Joel", "Joel son of Pethuel"],
    ["Amos", "Amos", ""],
    ["Obadiah", "Obadiah", "Obadiah the prophet"],
    ["Jonah", "Jonah", "Jonah son of Amittai"],
    ["Micah", "Micah", "Micah of Moresheth"],
    ["Nahum", "Nahum", "Nahum the Elkoshite"],
    ["Habakkuk", "Habakkuk", ""],
    ["Zephaniah", "Zephaniah", ""],
    ["Haggai", "Haggai", ""],
    ["Zechariah", "Zechariah", "Zechariah son of Berechiah"],
    ["Malachi", "Malachi", ""],
  ];
  const mismatches: string[] = [];
  for (const [book, name, aka] of PROPHET_BOOKS) {
    const cov = BOOK_COVERAGE[book];
    if (!cov) { mismatches.push(`${book}: no BOOK_COVERAGE entry`); continue; }
    const r = await db.execute({
      sql: "SELECT timeline_start_bc s, timeline_end_bc e FROM people WHERE name = ? AND also_known_as = ?",
      args: [name, aka],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = r.rows[0] as any;
    if (!row) { mismatches.push(`${book}: prophet ${name} not found`); continue; }
    if (row.s !== cov.startBc || row.e !== cov.endBc) {
      mismatches.push(`${book}: coverage ${cov.startBc}-${cov.endBc} vs prophet ${row.s}-${row.e}`);
    }
  }
  check("prophetic book coverage matches each prophet's ministry dates",
    mismatches.length === 0, mismatches.join("; "));
}

async function main() {
  console.log("Timeline data verification\n");

  // --- Schema present ---
  const cols = await db.execute("PRAGMA table_info(people)");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const colNames = cols.rows.map((r: any) => r.name);
  for (const c of ["timeline_start_bc","timeline_end_bc","timeline_track","date_uncertainty_note","date_confidence"]) {
    check(`people.${c} exists`, colNames.includes(c));
  }
  const refCols = await db.execute("PRAGMA table_info(scripture_refs)");
  check("scripture_refs.event_id exists",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    refCols.rows.map((r: any) => r.name).includes("event_id"));

  const tables = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('historical_events','prophecy_links')"
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tNames = tables.rows.map((r: any) => r.name);
  check("historical_events table exists", tNames.includes("historical_events"));
  check("prophecy_links table exists", tNames.includes("prophecy_links"));

  // --- API shape ---
  await checkApiShape();

  // --- Lane integrity ---
  await checkLaneIntegrity();

  // --- Prophecy / event referential integrity ---
  await checkProphecyIntegrity();
  await checkBookCoverageMatchesProphets();

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
