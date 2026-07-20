import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN ?? process.env.TURSO_DATABASE_TURSO_AUTH_TOKEN,
});

const DRY_RUN = process.argv.includes("--dry-run");

// One-time cleanup: the `relationships` table has no unique constraint on
// (person_a_id, type, person_b_id) beyond its `id` primary key, so
// INSERT OR IGNORE + a fresh UUID is not actually idempotent. This finds
// exact duplicate relationship rows, keeps the earliest (by created_at,
// tie-broken by id) per group, and deletes the rest.
async function main() {
  console.log(DRY_RUN ? "=== DRY RUN — no statements will be executed ===" : "=== LIVE RUN — mutating database ===");

  const groups = await db.execute(
    `SELECT person_a_id, person_a_name, type, person_b_id, person_b_name, COUNT(*) as c
     FROM relationships
     GROUP BY person_a_id, type, person_b_id
     HAVING COUNT(*) > 1
     ORDER BY person_a_name`
  );

  console.log(`Found ${groups.rows.length} duplicate relationship group(s).\n`);

  let totalDeleted = 0;

  for (const g of groups.rows as unknown as {
    person_a_id: string; person_a_name: string; type: string;
    person_b_id: string; person_b_name: string; c: number;
  }[]) {
    const rows = await db.execute({
      sql: `SELECT id, created_at FROM relationships
            WHERE person_a_id = ? AND type = ? AND person_b_id = ?
            ORDER BY created_at ASC, id ASC`,
      args: [g.person_a_id, g.type, g.person_b_id],
    });

    const all = rows.rows as unknown as { id: string; created_at: string }[];
    const [keep, ...remove] = all;

    console.log(`${g.person_a_name} --${g.type}--> ${g.person_b_name}  (${all.length} rows)`);
    console.log(`  keeping: ${keep.id} (created_at ${keep.created_at})`);
    for (const r of remove) {
      console.log(`  ${DRY_RUN ? "would delete" : "deleting"}: ${r.id} (created_at ${r.created_at})`);
      if (!DRY_RUN) {
        await db.execute({ sql: `DELETE FROM relationships WHERE id = ?`, args: [r.id] });
      }
      totalDeleted++;
    }
    console.log();
  }

  console.log(`${DRY_RUN ? "[DRY RUN] Would delete" : "Deleted"} ${totalDeleted} duplicate row(s) across ${groups.rows.length} group(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
