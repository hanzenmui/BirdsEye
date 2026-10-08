// Copy public library tables into a local-only preview. Source is SELECT-only;
// no getDb() call is made until the live connection settings have been removed.
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LIBRARY_TABLES } from "../lib/recovery";
import { getReadyDb } from "../lib/db";

async function main() {
  config({ path: ".env.local", quiet: true });
  if (!process.env.TURSO_DATABASE_URL) throw new Error("No library source configured");
  const source = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN ?? process.env.TURSO_DATABASE_TURSO_AUTH_TOKEN });
  const rows = await Promise.all(LIBRARY_TABLES.map(name => source.execute(`SELECT * FROM ${name}`)));
  const sourceIndexes = new Set((await source.execute("SELECT name FROM sqlite_master WHERE type='index'")).rows.map(r => String(r.name)));
  source.close();
  const scratch = await mkdtemp(join(tmpdir(), "birdseye-study-preview-"));
  process.env.TURSO_DATABASE_URL = "";
  process.env.DB_MODE = "local";
  process.env.SQLITE_PATH = join(scratch, "preview.db");
  const dest = await getReadyDb();
  await dest.transaction(async tx => {
    // Preserve the current library exactly, including legacy duplicate links.
    // Do not silently drop those rows just to satisfy a newer empty DB's index.
    for (const index of ["idx_relationships_unique", "idx_prophecy_links_unique", "idx_tradition_edges_unique", "idx_tradition_people_unique"]) {
      if (!sourceIndexes.has(index)) await tx.run(`DROP INDEX IF EXISTS ${index}`);
    }
    for (let i = 0; i < LIBRARY_TABLES.length; i++) {
      const table = LIBRARY_TABLES[i];
      const columns = new Set((await tx.query<{ name: string }>(`PRAGMA table_info(${table})`)).map(c => c.name));
      for (const row of rows[i].rows) {
        const keys = Object.keys(row).filter(k => columns.has(k));
        await tx.run(`INSERT INTO ${table} (${keys.map(k => `"${k}"`).join(",")}) VALUES (${keys.map((_, j) => `$${j + 1}`).join(",")})`, keys.map(k => row[k] as string | number | null));
      }
    }
  });
  console.log(`Preview database: ${process.env.SQLITE_PATH}`);
  console.log(`Copied ${rows[0].rows.length} people. The source library was read only; all preview edits stay local.`);
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Preview preparation failed"); process.exitCode = 1; });
