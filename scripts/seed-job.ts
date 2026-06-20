import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN ?? process.env.TURSO_DATABASE_TURSO_AUTH_TOKEN,
});

const ids: Record<string, string> = {};
const names: Record<string, string> = {};

function id(key: string) {
  if (!ids[key]) ids[key] = crypto.randomUUID();
  return ids[key];
}

async function safeInsertPerson(p: {
  key: string; name: string; alsoKnownAs?: string; gender: string;
  description: string; tags: string[];
}): Promise<void> {
  const aka = p.alsoKnownAs ?? '';
  const existing = await db.execute({
    sql: aka
      ? "SELECT id FROM people WHERE name = ? AND also_known_as = ? LIMIT 1"
      : "SELECT id FROM people WHERE name = ? LIMIT 1",
    args: aka ? [p.name, aka] : [p.name],
  });
  const row = existing.rows[0] as unknown as { id: string } | undefined;
  if (row) { ids[p.key] = row.id; names[p.key] = p.name; return; }
  names[p.key] = p.name;
  await db.execute({
    sql: `INSERT OR IGNORE INTO people (id,name,also_known_as,gender,testament,birth_year,death_year,description,tags,created_at)
          VALUES (?,?,?,?,'OT','','',?,?,datetime('now'))`,
    args: [id(p.key), p.name, aka, p.gender, p.description, JSON.stringify(p.tags)],
  });
}

async function insertRel(aKey: string, type: string, bKey: string, notes?: string) {
  await db.execute({
    sql: `INSERT OR IGNORE INTO relationships (id,person_a_id,person_a_name,type,person_b_id,person_b_name,notes,created_at)
          VALUES (?,?,?,?,?,?,?,datetime('now'))`,
    args: [crypto.randomUUID(), id(aKey), names[aKey] ?? aKey, type, id(bKey), names[bKey] ?? bKey, notes ?? ''],
  });
}

async function insertRef(personKey: string, book: string, cs: number, vs: number, ce?: number, ve?: number, note?: string) {
  await db.execute({
    sql: `INSERT OR IGNORE INTO scripture_refs (id,person_id,book,chapter_start,verse_start,chapter_end,verse_end,note,created_at)
          VALUES (?,?,?,?,?,?,?,?,datetime('now'))`,
    args: [crypto.randomUUID(), id(personKey), book, cs, vs, ce ?? cs, ve ?? vs, note ?? ''],
  });
}

// ── People ────────────────────────────────────────────────────────────────────
async function seedPeople() {
  await safeInsertPerson({ key: "job", name: "Job",
    gender: "male",
    description: "Man from the land of Uz, 'blameless and upright, one who feared God and turned away from evil.' Wealthiest man in the east — 7,000 sheep, 3,000 camels, 500 yoke of oxen. God pointed him out to the Adversary (ha-satan) as his finest servant; the Adversary was allowed to test him by stripping away everything. Job lost his livestock, servants, and all ten children in a single day, then was afflicted with painful sores from head to foot. Through all this he did not curse God. After his three friends and Elihu spoke, God spoke from the whirlwind and rebuked them all — but Job was vindicated. His fortunes were restored double.",
    tags: ["patriarch"] });

  await safeInsertPerson({ key: "eliphaz", name: "Eliphaz", alsoKnownAs: "Eliphaz the Temanite",
    gender: "male",
    description: "First and most prominent of Job's three friends, from Teman in Edom. Presented the traditional retribution theology: suffering is punishment for sin; if Job would repent, God would restore him. Made appeals to personal vision and experience. His three speeches become increasingly harsh. God told him at the end that he had 'not spoken of me what is right, as my servant Job has' and required Job to intercede for him.",
    tags: ["other"] });

  await safeInsertPerson({ key: "bildad", name: "Bildad", alsoKnownAs: "Bildad the Shuhite",
    gender: "male",
    description: "Second of Job's three friends, from Shuah. Appealed more to ancestral tradition and wisdom. Accused Job of pride and insisted God's justice is exact — if Job were pure, God would restore him. His speeches grow shorter through the book, his final speech being only six verses.",
    tags: ["other"] });

  await safeInsertPerson({ key: "zophar", name: "Zophar", alsoKnownAs: "Zophar the Naamathite",
    gender: "male",
    description: "Third of Job's friends, from Naamah. The most blunt and harsh; told Job that whatever he had suffered was less than his guilt deserved. Only speaks twice (chapters 11 and 20), implying that Job's responses silenced him. Like the other two, condemned by God at the end.",
    tags: ["other"] });

  await safeInsertPerson({ key: "elihu", name: "Elihu", alsoKnownAs: "Elihu son of Barachel",
    gender: "male",
    description: "Son of Barachel the Buzite, of the family of Ram. A young man who had held back out of deference to the three older friends. Grew angry with both them (for not answering Job adequately) and with Job (for justifying himself rather than God). Speaks four long speeches emphasizing God's sovereignty and the instructive purpose of suffering. Notably, God does not rebuke Elihu at the end as he does the three friends.",
    tags: ["other"] });
}

// ── Relationships ─────────────────────────────────────────────────────────────
async function seedRelationships() {
  await insertRel("eliphaz", "ally_of", "job",    "One of Job's three friends who came to comfort him (Job 2:11)");
  await insertRel("bildad",  "ally_of", "job",    "One of Job's three friends who came to comfort him (Job 2:11)");
  await insertRel("zophar",  "ally_of", "job",    "One of Job's three friends who came to comfort him (Job 2:11)");
  await insertRel("elihu",   "ally_of", "job",    "Young man who addressed Job after the three friends failed");
  await insertRel("eliphaz", "ally_of", "bildad", "Three friends came together and sat with Job in silence");
  await insertRel("eliphaz", "ally_of", "zophar", "Three friends condemned by God; Job interceded for them");
}

// ── Scripture references ───────────────────────────────────────────────────────
async function seedRefs() {
  await insertRef("job",     "Job",  1,  1, 42, 17, "Tested by the Adversary; loses all; responds from whirlwind; restored");
  await insertRef("eliphaz", "Job",  4,  1,  5, 27, "First speech: vision; suffering as discipline");
  await insertRef("eliphaz", "Job", 15,  1, 15, 35, "Second speech: the wicked suffer");
  await insertRef("eliphaz", "Job", 22,  1, 22, 30, "Third speech: charges Job with specific sins");
  await insertRef("bildad",  "Job",  8,  1,  8, 22, "First speech: God does not reject the blameless");
  await insertRef("bildad",  "Job", 18,  1, 18, 21, "Second speech: the fate of the wicked");
  await insertRef("bildad",  "Job", 25,  1, 25,  6, "Third speech: no one is righteous before God");
  await insertRef("zophar",  "Job", 11,  1, 11, 20, "First speech: Job's guilt exceeds punishment");
  await insertRef("zophar",  "Job", 20,  1, 20, 29, "Second speech: triumph of the wicked is brief");
  await insertRef("elihu",   "Job", 32,  1, 37, 24, "Four speeches: God speaks through suffering; God's sovereignty");
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Seeding Job people...");
  await seedPeople();
  console.log("Seeding Job relationships...");
  await seedRelationships();
  console.log("Seeding Job scripture references...");
  await seedRefs();

  const pc = await db.execute("SELECT COUNT(*) as c FROM people");
  const rc = await db.execute("SELECT COUNT(*) as c FROM relationships");
  const sc = await db.execute("SELECT COUNT(*) as c FROM scripture_refs");
  console.log(`\n✓ Job seed complete.`);
  console.log(`  Total people now: ${(pc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total relationships now: ${(rc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total scripture refs now: ${(sc.rows[0] as unknown as { c: number }).c}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
