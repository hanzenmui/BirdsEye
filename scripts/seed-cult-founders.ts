// Adds the three cult founders as ordinary Person records and links each to
// their tradition via tradition_people. Deliberately separate from
// seed-church-history.ts (which seeds the mainstream After New Testament
// timeline cast) and seed-traditions.ts's own TRADITION_PEOPLE array (which
// only links people who already exist -- these three didn't).
//
// These three get NO timeline_track / timeline_start_bc / timeline_end_bc,
// so they never appear on the Timeline's After New Testament story --
// consistent with Hanzen's explicit instruction that Mormons, Jehovah's
// Witnesses and Christian Science stay entirely separate from the historic
// Christianity narrative, on the Family Tree and here alike. They ARE
// ordinary browsable People records (testament CH), the same as any other
// After New Testament figure, since founding a religious movement is a
// biographical fact regardless of where that movement sits relative to
// historic Christianity.
//
// Idempotent -- safe to re-run; a second run with unchanged data produces
// neither inserts nor updates. Run: npx tsx scripts/seed-cult-founders.ts
// [--dry-run]
import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN ?? process.env.TURSO_DATABASE_TURSO_AUTH_TOKEN,
});

const DRY_RUN = process.argv.includes("--dry-run");

interface FounderRow {
  name: string; aka: string; gender: string; description: string;
  traditionName: string;
}

const FOUNDERS: FounderRow[] = [
  {
    name: "Joseph Smith", aka: "Joseph Smith Jr., founder of the Latter Day Saint movement",
    gender: "male",
    description: "Claimed to be visited by an angel who directed him to golden plates, which he translated into the Book of Mormon. Organized the Church of Christ (later the Church of Jesus Christ of Latter-day Saints) at Fayette, New York in 1830. Killed by a mob while jailed at Carthage, Illinois in 1844.",
    traditionName: "The Church of Jesus Christ of Latter-day Saints",
  },
  {
    name: "Charles Taze Russell", aka: "Charles Taze Russell, founder of the Bible Student movement",
    gender: "male",
    description: "Founded the Bible Student movement in Allegheny, Pennsylvania in the 1870s, publishing Zion's Watch Tower from 1879. His organization took the name Jehovah's Witnesses in 1931, fifteen years after his death, under his successor J. F. Rutherford.",
    traditionName: "Jehovah's Witnesses",
  },
  {
    name: "Mary Baker Eddy", aka: "Mary Baker Eddy, founder of Christian Science",
    gender: "female",
    description: "Published Science and Health with Key to the Scriptures in 1875, teaching that sickness and matter itself are ultimately unreal and that healing comes through correct spiritual understanding. Chartered the Church of Christ, Scientist in Boston in 1879.",
    traditionName: "Christian Science",
  },
];

async function resolvePersonRow(name: string, aka: string): Promise<{ id: string; description: string } | null> {
  const r = await db.execute({
    sql: "SELECT id, description FROM people WHERE name = ? AND also_known_as = ?",
    args: [name, aka],
  });
  if (r.rows.length > 1) {
    throw new Error(`Ambiguous person match: ${r.rows.length} rows for (name="${name}", aka="${aka}") -- refusing to guess.`);
  }
  return (r.rows[0] as unknown as { id: string; description: string } | undefined) ?? null;
}

async function upsertPerson(f: FounderRow): Promise<string> {
  const existing = await resolvePersonRow(f.name, f.aka);
  if (existing) {
    if (existing.description !== f.description) {
      console.log(`  ${DRY_RUN ? "would update" : "updating"}: ${f.name} description`);
      if (!DRY_RUN) {
        await db.execute({ sql: "UPDATE people SET description = ? WHERE id = ?", args: [f.description, existing.id] });
      }
    }
    return existing.id;
  }
  const id = crypto.randomUUID();
  console.log(`  ${DRY_RUN ? "would insert" : "inserting"}: ${f.name} (${f.aka})`);
  if (!DRY_RUN) {
    await db.execute({
      sql: `INSERT INTO people (id,name,also_known_as,gender,testament,birth_year,death_year,description,tags,created_at)
            VALUES (?,?,?,?,'CH','','',?,?,datetime('now'))`,
      args: [id, f.name, f.aka, f.gender, f.description, JSON.stringify(["founder"])],
    });
  }
  return id;
}

async function resolveTraditionId(name: string): Promise<string | null> {
  const r = await db.execute({ sql: "SELECT id FROM traditions WHERE name = ? LIMIT 1", args: [name] });
  return (r.rows[0] as unknown as { id: string } | undefined)?.id ?? null;
}

async function linkFounder(personId: string, traditionName: string) {
  const traditionId = await resolveTraditionId(traditionName);
  if (!traditionId) { console.warn(`  MISSING tradition: "${traditionName}"`); return; }

  const existing = await db.execute({
    sql: "SELECT id FROM tradition_people WHERE tradition_id = ? AND person_id = ? AND role = 'founder' LIMIT 1",
    args: [traditionId, personId],
  });
  if (existing.rows.length > 0) return;

  console.log(`  ${DRY_RUN ? "would link" : "linking"}: founder -> ${traditionName}`);
  if (!DRY_RUN) {
    await db.execute({
      sql: `INSERT INTO tradition_people (id,tradition_id,person_id,role,notes,created_at) VALUES (?,?,?,'founder','',datetime('now'))`,
      args: [crypto.randomUUID(), traditionId, personId],
    });
  }
}

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== LIVE RUN ===");
  console.log("Seeding cult founders...");
  for (const f of FOUNDERS) {
    const personId = await upsertPerson(f);
    await linkFounder(personId, f.traditionName);
  }
  console.log("Done.");
}

main().catch(e => { console.error(e); process.exit(1); });
