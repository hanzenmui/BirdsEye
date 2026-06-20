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
  await safeInsertPerson({ key: "ahasuerus", name: "Ahasuerus", alsoKnownAs: "Xerxes I king of Persia",
    gender: "male",
    description: "King of Persia who ruled from India to Ethiopia over 127 provinces — historically identified as Xerxes I (r. 486–465 BC). Hosted a 180-day banquet displaying his wealth and power. Deposed Queen Vashti for refusing to appear before his guests. Chose Esther as queen from a kingdom-wide search. Allowed Haman's edict to annihilate the Jews, then reversed it after Esther's intercession. Had Haman hanged on the gallows Haman had built for Mordecai.",
    tags: ["king"] });

  await safeInsertPerson({ key: "vashti", name: "Vashti",
    gender: "female",
    description: "Queen of Persia before Esther. Refused to appear before King Ahasuerus and his guests when summoned during a royal banquet — likely to display her beauty before a crowd of drunk men. Deposed by royal decree on the advice of his counselors, who feared her refusal would set a precedent for wives throughout the empire to disobey their husbands. Her resistance created the vacancy that Esther filled.",
    tags: ["queen"] });

  await safeInsertPerson({ key: "mordecai", name: "Mordecai",
    gender: "male",
    description: "Benjaminite Jew in Susa, son of Jair, descendant of Kish — the same Kish as Saul's father. Raised his orphaned cousin Esther as his own daughter. Discovered and reported a plot to assassinate Ahasuerus (recorded in the royal chronicles). Refused to bow to Haman, triggering the empire-wide plot against the Jews. Advised Esther to intercede, telling her 'who knows whether you have not come to the kingdom for such a time as this?' After Haman's fall he was given Haman's signet ring and position; he and Esther instituted the feast of Purim.",
    tags: ["tribe of israel"] });

  await safeInsertPerson({ key: "esther", name: "Esther", alsoKnownAs: "Hadassah",
    gender: "female",
    description: "Jewish orphan raised by her cousin Mordecai in Susa. Her Hebrew name was Hadassah ('myrtle'). Beautiful in form and face, she was chosen queen after a year of beauty treatments. Kept her Jewish identity secret at Mordecai's instruction. When Haman's edict threatened to annihilate all Jews in the empire, Mordecai urged her to act. After three days of fasting she approached the king unsummoned — a capital offense — and won his favor. Revealed Haman's plot at a private banquet; Haman was immediately hanged. Worked with Mordecai to issue a counter-edict allowing Jews to defend themselves. Instituted the annual feast of Purim.",
    tags: ["queen", "tribe of israel"] });

  await safeInsertPerson({ key: "haman", name: "Haman", alsoKnownAs: "Haman the Agagite",
    gender: "male",
    description: "Chief minister of Ahasuerus, an Agagite — traditionally linked to the Amalekite line of King Agag whom Saul had spared. His pride was stung when Mordecai refused to bow to him. Rather than take personal revenge, he sought to destroy every Jew in the empire. Cast lots (purim) to choose an auspicious date and obtained the king's signet ring. Planned to hang Mordecai on a 75-foot gallows. Was forced to publicly honor Mordecai instead. Exposed by Esther at the royal banquet; hanged on the very gallows he had built. His ten sons were also killed.",
    tags: ["antagonist"] });

  await safeInsertPerson({ key: "hegai", name: "Hegai",
    gender: "male",
    description: "King's eunuch in charge of the women in the harem. Pleased with Esther and gave her special favor: the best place in the harem, seven chosen maids, and moved her to the best part of the harem. His favor shaped Esther's preparation for her appearance before the king.",
    tags: ["other"] });
}

// ── Relationships ─────────────────────────────────────────────────────────────
async function seedRelationships() {
  await insertRel("ahasuerus", "spouse_of",  "vashti",   "Vashti deposed as queen (Esth 1:19)");
  await insertRel("ahasuerus", "spouse_of",  "esther",   "Esther chosen as queen after Vashti (Esth 2:17)");
  await insertRel("ahasuerus", "ruler_of",   "haman",    "Haman was Ahasuerus's chief minister (Esth 3:1)");
  await insertRel("mordecai",  "parent_of",  "esther",   "Mordecai raised his orphaned cousin Esther (Esth 2:7)");
  await insertRel("haman",     "enemy_of",   "mordecai", "Mordecai's refusal to bow triggered Haman's genocidal plot");
  await insertRel("haman",     "enemy_of",   "esther",   "Haman's edict threatened Esther's people");
  await insertRel("esther",    "ally_of",    "mordecai", "'Such a time as this' — worked together to save the Jews");
  await insertRel("esther",    "enemy_of",   "haman",    "Esther exposed Haman to the king (Esth 7:6)");
  await insertRel("hegai",     "servant_of", "ahasuerus","Hegai managed the king's harem (Esth 2:8)");
  await insertRel("hegai",     "ally_of",    "esther",   "Gave Esther special favor and best placement (Esth 2:9)");
}

// ── Scripture references ───────────────────────────────────────────────────────
async function seedRefs() {
  await insertRef("ahasuerus", "Esther",  1,  1, 10,  3, "Hosts banquet; deposes Vashti; chooses Esther; reverses Haman's edict");
  await insertRef("vashti",    "Esther",  1,  9,  1, 22, "Refuses to appear; deposed by royal decree");
  await insertRef("mordecai",  "Esther",  2,  5, 10,  3, "Raises Esther; discovers plot; refuses to bow; rewarded");
  await insertRef("esther",    "Esther",  2,  7, 10,  3, "Chosen queen; intercedes for her people; institutes Purim");
  await insertRef("haman",     "Esther",  3,  1,  8,  8, "Plots genocide; plans to hang Mordecai; exposed and hanged");
  await insertRef("hegai",     "Esther",  2,  8,  2, 15, "Eunuch who favored Esther and guided her preparation");
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Seeding Esther people...");
  await seedPeople();
  console.log("Seeding Esther relationships...");
  await seedRelationships();
  console.log("Seeding Esther scripture references...");
  await seedRefs();

  const pc = await db.execute("SELECT COUNT(*) as c FROM people");
  const rc = await db.execute("SELECT COUNT(*) as c FROM relationships");
  const sc = await db.execute("SELECT COUNT(*) as c FROM scripture_refs");
  console.log(`\n✓ Esther seed complete.`);
  console.log(`  Total people now: ${(pc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total relationships now: ${(rc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total scripture refs now: ${(sc.rows[0] as unknown as { c: number }).c}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
