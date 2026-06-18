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

async function lookupId(name: string): Promise<string | null> {
  const r = await db.execute({ sql: "SELECT id FROM people WHERE name = ? LIMIT 1", args: [name] });
  return (r.rows[0] as unknown as { id: string } | undefined)?.id ?? null;
}

async function insertRelByName(aName: string, type: string, bName: string, notes?: string) {
  const aId = await lookupId(aName);
  const bId = await lookupId(bName);
  if (!aId || !bId) { console.warn(`  ⚠ Could not link ${aName} → ${bName}`); return; }
  await db.execute({
    sql: `INSERT OR IGNORE INTO relationships (id,person_a_id,person_a_name,type,person_b_id,person_b_name,notes,created_at)
          VALUES (?,?,?,?,?,?,?,datetime('now'))`,
    args: [crypto.randomUUID(), aId, aName, type, bId, bName, notes ?? ''],
  });
}

async function insertRelNameToLocal(aName: string, type: string, bKey: string, notes?: string) {
  const aId = await lookupId(aName);
  if (!aId) { console.warn(`  ⚠ Could not find ${aName} for link to ${bKey}`); return; }
  await db.execute({
    sql: `INSERT OR IGNORE INTO relationships (id,person_a_id,person_a_name,type,person_b_id,person_b_name,notes,created_at)
          VALUES (?,?,?,?,?,?,?,datetime('now'))`,
    args: [crypto.randomUUID(), aId, aName, type, id(bKey), names[bKey] ?? bKey, notes ?? ''],
  });
}

// ── People ────────────────────────────────────────────────────────────────────
async function seedPeople() {
  // ── Naomi's family ────────────────────────────────────────────────────
  await safeInsertPerson({ key: "elimelech", name: "Elimelech",
    gender: "male",
    description: "Husband of Naomi, from Bethlehem in Judah, of the clan of Ephrath. Took his family to Moab during a famine in Israel. Died there, leaving Naomi a widow with two sons.",
    tags: ["tribe of israel", "ancestor"] });

  await safeInsertPerson({ key: "naomi", name: "Naomi", alsoKnownAs: "Mara",
    gender: "female",
    description: "Wife of Elimelech, mother of Mahlon and Chilion. After losing her husband and both sons in Moab, she returned to Bethlehem and told the townswomen to call her 'Mara' (meaning bitter), for the Lord had brought her back empty. Her loyalty to her daughter-in-law Ruth and her wise counsel about the kinsman-redeemer Boaz shaped the entire story. Through Ruth's marriage to Boaz and the birth of Obed, she was restored and held the baby as her own 'son.'",
    tags: ["matriarch", "tribe of israel", "ancestor"] });

  await safeInsertPerson({ key: "mahlon", name: "Mahlon",
    gender: "male",
    description: "Elder son of Elimelech and Naomi, who died in Moab leaving no heir. His wife Ruth chose to return to Bethlehem with Naomi rather than go back to her own people.",
    tags: ["tribe of israel"] });

  await safeInsertPerson({ key: "chilion", name: "Chilion",
    gender: "male",
    description: "Younger son of Elimelech and Naomi, who also died in Moab. His wife Orpah returned to Moab after his death.",
    tags: ["tribe of israel"] });

  // ── Ruth and Orpah ────────────────────────────────────────────────────
  await safeInsertPerson({ key: "ruth", name: "Ruth",
    gender: "female",
    description: "Moabite woman, wife of Mahlon son of Elimelech. After Mahlon's death chose to leave Moab and stay with her mother-in-law Naomi with the words: 'Where you go I will go, and where you stay I will stay. Your people will be my people and your God my God.' Gleaned in the fields of Boaz, a kinsman-redeemer. Married Boaz and bore Obed, father of Jesse, father of David. Her loyalty and faith across ethnic boundaries made her one of only five women named in Matthew's genealogy of Jesus.",
    tags: ["matriarch", "moabite", "ancestor", "messianic line"] });

  await safeInsertPerson({ key: "orpah", name: "Orpah",
    gender: "female",
    description: "Moabite woman, wife of Chilion son of Elimelech. After her husband's death, she initially traveled with Naomi and Ruth toward Judah but, urged twice by Naomi to return to her own people, she kissed Naomi farewell and went back to Moab. She is contrasted with Ruth's unbreakable loyalty.",
    tags: ["moabite"] });

  // ── Boaz and his lineage ──────────────────────────────────────────────
  await safeInsertPerson({ key: "salmon", name: "Salmon",
    gender: "male",
    description: "Son of Nahshon (prince of Judah), father of Boaz. Married Rahab the Canaanite woman of Jericho according to Matthew 1:5, placing her in the Davidic lineage. Appears in the genealogy in Ruth 4:20-21 and Matthew 1:4-5.",
    tags: ["tribe of israel", "ancestor", "messianic line"] });

  await safeInsertPerson({ key: "boaz", name: "Boaz",
    gender: "male",
    description: "Wealthy landowner from Bethlehem, of the clan of Elimelech, son of Salmon (and Rahab). Kinsman-redeemer who married Ruth after the nearer kinsman declined. Showed notable generosity to Ruth: told her to glean only in his fields, leave extra grain for her, share his water, and eat with his workers. Publicly redeemed Elimelech's land and took Ruth as his wife at the city gate with witnesses. Father of Obed, grandfather of Jesse, great-grandfather of David.",
    tags: ["tribe of israel", "ancestor", "messianic line"] });

  await safeInsertPerson({ key: "obed", name: "Obed",
    gender: "male",
    description: "Son of Boaz and Ruth, born in Bethlehem. The women of the town named him Obed (meaning 'servant'). He became a 'son' to Naomi, restoring her family line. Father of Jesse, grandfather of King David. Named in Ruth 4:17 and both gospel genealogies.",
    tags: ["tribe of israel", "ancestor", "messianic line"] });

  await safeInsertPerson({ key: "jesse", name: "Jesse",
    gender: "male",
    description: "Son of Obed, grandson of Boaz and Ruth. Father of King David and six other sons. The 'root of Jesse' became a messianic title (Isa 11:1, 10). Lived in Bethlehem of Judah.",
    tags: ["tribe of israel", "ancestor", "messianic line"] });
}

// ── Relationships ─────────────────────────────────────────────────────────────
async function seedRelationships() {
  // ── Naomi's family ────────────────────────────────────────────────────
  await insertRel("elimelech", "spouse_of", "naomi");
  await insertRel("elimelech", "parent_of", "mahlon");
  await insertRel("elimelech", "parent_of", "chilion");
  await insertRel("naomi",     "parent_of", "mahlon");
  await insertRel("naomi",     "parent_of", "chilion");

  // ── Ruth and Orpah marriages ──────────────────────────────────────────
  await insertRel("mahlon",  "spouse_of", "ruth",   "Ruth's first husband; died in Moab (Ruth 1:4-5)");
  await insertRel("chilion", "spouse_of", "orpah",  "Orpah's husband; died in Moab (Ruth 1:4-5)");

  // ── Ruth → Naomi ──────────────────────────────────────────────────────
  await insertRel("ruth",    "ally_of",   "naomi",  "'Where you go I will go' — loyal companion (Ruth 1:16-17)");

  // ── Boaz lineage ──────────────────────────────────────────────────────
  // Salmon is Nahshon's son; Nahshon already seeded in Numbers
  await insertRelByName("Nahshon", "parent_of", "Salmon", "Salmon son of Nahshon (Ruth 4:20, Matt 1:4-5)");
  await insertRelByName("Rahab",   "spouse_of", "Salmon", "Rahab married Salmon (Matt 1:5)");
  await insertRel("salmon", "parent_of", "boaz",   "Boaz son of Salmon (Ruth 4:21)");
  await insertRel("boaz",   "spouse_of", "ruth",   "Kinsman-redeemer marriage; redeemed Elimelech's land (Ruth 4)");
  await insertRel("boaz",   "parent_of", "obed",   "Obed born to Boaz and Ruth (Ruth 4:17)");
  await insertRel("obed",   "parent_of", "jesse",  "Jesse son of Obed (Ruth 4:17)");

  // ── Tribe connections ─────────────────────────────────────────────────
  await insertRelNameToLocal("Judah", "ancestor_of", "elimelech", "Elimelech of Bethlehem in Judah (Ruth 1:1)");
  await insertRelNameToLocal("Judah", "ancestor_of", "boaz",      "Boaz of the clan of Elimelech, Bethlehem in Judah");
}

// ── Scripture references ───────────────────────────────────────────────────────
async function seedRefs() {
  await insertRef("elimelech", "Ruth",   1,  1,  1,  5, "Takes family to Moab during famine; dies there");
  await insertRef("naomi",     "Ruth",   1,  1,  4, 17, "Central figure of the book; 'call me Mara'");
  await insertRef("mahlon",    "Ruth",   1,  1,  1,  5, "Son of Elimelech; dies in Moab");
  await insertRef("mahlon",    "Ruth",   4,  9,  4, 10, "Ruth named as widow of Mahlon at the gate redemption");
  await insertRef("chilion",   "Ruth",   1,  1,  1,  5, "Son of Elimelech; dies in Moab");
  await insertRef("ruth",      "Ruth",   1,  4,  4, 17, "Entire book: gleaning, Boaz, redemption, birth of Obed");
  await insertRef("orpah",     "Ruth",   1,  4,  1, 14, "Returns to Moab after her husband's death");
  await insertRef("salmon",    "Ruth",   4, 20,  4, 21, "Named in genealogy: Nahshon → Salmon → Boaz");
  await insertRef("boaz",      "Ruth",   2,  1,  4, 22, "Kinsman-redeemer; generosity to Ruth; gate ceremony");
  await insertRef("obed",      "Ruth",   4, 13,  4, 17, "Born to Ruth and Boaz; Naomi nurses him");
  await insertRef("jesse",     "Ruth",   4, 17,  4, 22, "Named in closing genealogy: Obed → Jesse → David");

  // Cross-book refs for Rahab-Salmon link (Rahab seeded in Joshua)
  const rahab = await lookupId("Rahab");
  if (rahab) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO scripture_refs (id,person_id,book,chapter_start,verse_start,chapter_end,verse_end,note,created_at)
            VALUES (?,?,?,?,?,?,?,?,datetime('now'))`,
      args: [crypto.randomUUID(), rahab, "Ruth", 4, 21, 4, 21, "Named in genealogy as Salmon's wife, mother of Boaz (Matt 1:5)"],
    });
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Seeding Ruth people...");
  await seedPeople();
  console.log("Seeding Ruth relationships...");
  await seedRelationships();
  console.log("Seeding Ruth scripture references...");
  await seedRefs();

  const pc = await db.execute("SELECT COUNT(*) as c FROM people");
  const rc = await db.execute("SELECT COUNT(*) as c FROM relationships");
  const sc = await db.execute("SELECT COUNT(*) as c FROM scripture_refs");
  console.log(`\n✓ Ruth seed complete.`);
  console.log(`  Total people now: ${(pc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total relationships now: ${(rc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total scripture refs now: ${(sc.rows[0] as unknown as { c: number }).c}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
