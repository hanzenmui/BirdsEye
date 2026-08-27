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

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
