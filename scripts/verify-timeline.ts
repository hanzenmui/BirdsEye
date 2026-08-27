// Verification suite for the timeline dataset. This project has no test
// framework; these assertions are the test suite. Run: npx tsx scripts/verify-timeline.ts
import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import { resolve } from "path";

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
      r.rows.map((x: any) => `${x.an}/${x.bn}`).join(", "));
  }
  // Every timeline person needs a valid track and a sane span.
  const bad = await db.execute(`
    SELECT name, timeline_track, timeline_start_bc, timeline_end_bc FROM people
    WHERE timeline_start_bc IS NOT NULL
      AND (timeline_track = '' OR timeline_end_bc IS NULL OR timeline_end_bc > timeline_start_bc)`);
  check("every timeline person has a track and start >= end (BC counts down)",
    bad.rows.length === 0, bad.rows.map((x: any) => x.name).join(", "));

  // Uncertain-dated figures must carry an explanatory note — the whole point
  // of the confidence tier is that the UI can be honest about it.
  const noNote = await db.execute(`
    SELECT name FROM people WHERE date_confidence = 'uncertain' AND date_uncertainty_note = ''`);
  check("every uncertain figure has a note", noNote.rows.length === 0,
    noNote.rows.map((x: any) => x.name).join(", "));
}

async function main() {
  console.log("Timeline data verification\n");

  // --- Schema present ---
  const cols = await db.execute("PRAGMA table_info(people)");
  const colNames = cols.rows.map((r: any) => r.name);
  for (const c of ["timeline_start_bc","timeline_end_bc","timeline_track","date_uncertainty_note","date_confidence"]) {
    check(`people.${c} exists`, colNames.includes(c));
  }
  const refCols = await db.execute("PRAGMA table_info(scripture_refs)");
  check("scripture_refs.event_id exists",
    refCols.rows.map((r: any) => r.name).includes("event_id"));

  const tables = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('historical_events','prophecy_links')"
  );
  const tNames = tables.rows.map((r: any) => r.name);
  check("historical_events table exists", tNames.includes("historical_events"));
  check("prophecy_links table exists", tNames.includes("prophecy_links"));

  // --- API shape ---
  await checkApiShape();

  // --- Lane integrity ---
  await checkLaneIntegrity();

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
