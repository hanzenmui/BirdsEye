import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN ?? process.env.TURSO_DATABASE_TURSO_AUTH_TOKEN,
});

const DRY_RUN = process.argv.includes("--dry-run");

// One-time cleanup: relationships.person_a_name/person_b_name are
// denormalized for display, but PATCH /api/people/[id] never propagated a
// name edit into existing relationship rows until this fix. Finds any
// relationship whose stored name has drifted from the current people.name
// and syncs it.
async function main() {
  console.log(DRY_RUN ? "=== DRY RUN — no statements will be executed ===" : "=== LIVE RUN — mutating database ===");

  const staleA = await db.execute(`
    SELECT r.id, r.person_a_name AS stored, p.name AS current
    FROM relationships r JOIN people p ON p.id = r.person_a_id
    WHERE r.person_a_name != p.name
  `);
  const staleB = await db.execute(`
    SELECT r.id, r.person_b_name AS stored, p.name AS current
    FROM relationships r JOIN people p ON p.id = r.person_b_id
    WHERE r.person_b_name != p.name
  `);

  console.log(`Found ${staleA.rows.length} stale person_a_name row(s), ${staleB.rows.length} stale person_b_name row(s).\n`);

  for (const r of staleA.rows as unknown as { id: string; stored: string; current: string }[]) {
    console.log(`  A: "${r.stored}" -> "${r.current}" (relationship ${r.id})`);
    if (!DRY_RUN) {
      await db.execute({ sql: `UPDATE relationships SET person_a_name = ? WHERE id = ?`, args: [r.current, r.id] });
    }
  }
  for (const r of staleB.rows as unknown as { id: string; stored: string; current: string }[]) {
    console.log(`  B: "${r.stored}" -> "${r.current}" (relationship ${r.id})`);
    if (!DRY_RUN) {
      await db.execute({ sql: `UPDATE relationships SET person_b_name = ? WHERE id = ?`, args: [r.current, r.id] });
    }
  }

  console.log(`\n${DRY_RUN ? "[DRY RUN] Would sync" : "Synced"} ${staleA.rows.length + staleB.rows.length} row(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
