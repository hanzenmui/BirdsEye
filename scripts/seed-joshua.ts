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

async function loadExisting(key: string, name: string): Promise<boolean> {
  const dbId = await lookupId(name);
  if (!dbId) { console.warn(`  ⚠ ${name} not found in DB — skipping refs`); return false; }
  ids[key] = dbId; names[key] = name;
  return true;
}

// ── People ────────────────────────────────────────────────────────────────────
async function seedPeople() {
  // ── Rahab ─────────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "rahab", name: "Rahab",
    gender: "female",
    description: "Canaanite innkeeper (traditionally described as a prostitute) in Jericho who hid the two Israelite spies sent by Joshua. She acknowledged that the Lord had given the land to Israel and secured a promise of safety for her family. Hung a scarlet cord from her window as the agreed sign. She and her household alone survived the fall of Jericho. Later married Salmon and became the mother of Boaz, placing her in the direct Davidic and messianic lineage.",
    tags: ["canaanite", "ancestor", "messianic line"] });

  // ── Achan ─────────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "achan", name: "Achan", alsoKnownAs: "Achar",
    gender: "male",
    description: "Son of Carmi, of the clan of Zabdi (Zimri), from the tribe of Judah. Violated the ban (herem) on Jericho by secretly taking a Babylonian robe, 200 shekels of silver, and a wedge of gold and hiding them under his tent. His sin caused Israel's catastrophic defeat at Ai. Identified by lot, he confessed and was stoned along with his family and possessions in the Valley of Achor. His name was later rendered 'Achar' (meaning 'trouble') in Chronicles.",
    tags: ["tribe of israel"] });

  // ── Achsah ────────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "achsah", name: "Achsah",
    gender: "female",
    description: "Daughter of Caleb. Offered as a bride to whoever captured Debir. Othniel son of Kenaz captured it and married her. She persuaded her father to give her springs of water in addition to the Negev land — he gave her upper and lower springs. She appears in both Joshua and Judges.",
    tags: ["tribe of israel"] });

  // ── Five Amorite kings (Josh 10) ──────────────────────────────────────
  await safeInsertPerson({ key: "adoni_zedek", name: "Adoni-zedek", alsoKnownAs: "Adoni-zedek king of Jerusalem",
    gender: "male",
    description: "King of Jerusalem who organized a coalition of five Amorite kings against Gibeon after it made peace with Israel. Attacked Gibeon; Joshua marched to their rescue. During the battle the sun stood still. All five kings were found hiding in a cave at Makkedah, brought out, executed, and hung on trees. Adoni-zedek was the ringleader of the coalition.",
    tags: ["king", "antagonist", "amorite"] });

  await safeInsertPerson({ key: "hoham", name: "Hoham", alsoKnownAs: "Hoham king of Hebron",
    gender: "male",
    description: "King of Hebron, one of the five Amorite kings who joined Adoni-zedek's coalition against Gibeon. Captured hiding in a cave at Makkedah and executed by Joshua.",
    tags: ["king", "antagonist", "amorite"] });

  await safeInsertPerson({ key: "piram", name: "Piram", alsoKnownAs: "Piram king of Jarmuth",
    gender: "male",
    description: "King of Jarmuth, one of the five Amorite kings in the coalition against Gibeon. Captured and executed at Makkedah.",
    tags: ["king", "antagonist", "amorite"] });

  await safeInsertPerson({ key: "japhia_lachish", name: "Japhia", alsoKnownAs: "Japhia king of Lachish",
    gender: "male",
    description: "King of Lachish, one of the five Amorite kings in the coalition against Gibeon. Not to be confused with Japhia son of David (2 Sam 5:15). Captured and executed at Makkedah.",
    tags: ["king", "antagonist", "amorite"] });

  await safeInsertPerson({ key: "debir_king", name: "Debir", alsoKnownAs: "Debir king of Eglon",
    gender: "male",
    description: "King of Eglon (not the city of the same name), one of the five Amorite kings who joined the coalition against Gibeon. Captured and executed at Makkedah. The city Debir was separately captured by Caleb's son-in-law Othniel.",
    tags: ["king", "antagonist", "amorite"] });
}

// ── Relationships ─────────────────────────────────────────────────────────────
async function seedRelationships() {
  // ── Rahab ─────────────────────────────────────────────────────────────
  await insertRelByName("Rahab", "ally_of", "Joshua", "Hid Joshua's spies and helped Israel take Jericho (Josh 2)");

  // ── Achan ─────────────────────────────────────────────────────────────
  await insertRelNameToLocal("Judah", "ancestor_of", "achan", "Achan is of the tribe of Judah (Josh 7:1)");
  await insertRelByName("Achan", "enemy_of", "Joshua", "His theft caused Israel's defeat at Ai (Josh 7)");

  // ── Achsah ────────────────────────────────────────────────────────────
  await insertRelByName("Caleb", "parent_of", "Achsah", "Caleb offered Achsah to whoever captured Debir (Josh 15:16)");

  // ── Five Amorite kings coalition ──────────────────────────────────────
  await insertRel("adoni_zedek", "ally_of", "hoham",       "Coalition of five kings (Josh 10:3)");
  await insertRel("adoni_zedek", "ally_of", "piram",       "Coalition of five kings (Josh 10:3)");
  await insertRel("adoni_zedek", "ally_of", "japhia_lachish", "Coalition of five kings (Josh 10:3)");
  await insertRel("adoni_zedek", "ally_of", "debir_king",  "Coalition of five kings (Josh 10:3)");
  await insertRelByName("Adoni-zedek", "enemy_of", "Joshua", "Led five-king coalition; defeated at Gibeon (Josh 10)");
}

// ── Scripture references ───────────────────────────────────────────────────────
async function seedRefs() {
  // ── Rahab ─────────────────────────────────────────────────────────────
  await insertRef("rahab", "Joshua",  2,  1,  2, 24, "Hides the two spies; receives promise of safety");
  await insertRef("rahab", "Joshua",  6, 17,  6, 25, "Rahab and household spared when Jericho falls");

  // ── Achan ─────────────────────────────────────────────────────────────
  await insertRef("achan", "Joshua",  7,  1,  7, 26, "Steals devoted things; Israel defeated at Ai; stoned in Valley of Achor");

  // ── Achsah ────────────────────────────────────────────────────────────
  await insertRef("achsah", "Joshua", 15, 16, 15, 19, "Marries Othniel; asks Caleb for springs of water");

  // ── Amorite kings ─────────────────────────────────────────────────────
  await insertRef("adoni_zedek",  "Joshua", 10,  1, 10, 27, "Organizes coalition; executed at Makkedah");
  await insertRef("hoham",        "Joshua", 10,  3, 10, 27, "King of Hebron; executed at Makkedah");
  await insertRef("piram",        "Joshua", 10,  3, 10, 27, "King of Jarmuth; executed at Makkedah");
  await insertRef("japhia_lachish","Joshua",10,  3, 10, 27, "King of Lachish; executed at Makkedah");
  await insertRef("debir_king",   "Joshua", 10,  3, 10, 27, "King of Eglon; executed at Makkedah");

  // ── Refs for existing people in Joshua ───────────────────────────────
  if (await loadExisting("joshua_ex", "Joshua")) {
    await insertRef("joshua_ex", "Joshua",  1,  1,  1, 18, "Commissioned by God; inherits Moses's role");
    await insertRef("joshua_ex", "Joshua",  3,  1,  3, 17, "Leads Israel through the Jordan on dry ground");
    await insertRef("joshua_ex", "Joshua",  6,  1,  6, 27, "Commands the fall of Jericho");
    await insertRef("joshua_ex", "Joshua", 10, 12, 10, 14, "Prays; sun stands still over Gibeon");
    await insertRef("joshua_ex", "Joshua", 23,  1, 24, 28, "Farewell addresses; covenant renewal at Shechem");
  }
  if (await loadExisting("caleb_ex", "Caleb")) {
    await insertRef("caleb_ex", "Joshua", 14,  6, 14, 15, "Claims Hebron as his inheritance; still strong at 85");
    await insertRef("caleb_ex", "Joshua", 15, 13, 15, 19, "Drives out giants; gives Achsah springs of water");
  }
  if (await loadExisting("eleazar_ex", "Eleazar")) {
    await insertRef("eleazar_ex", "Joshua", 14,  1, 14,  1, "Oversees the allotment of Canaan with Joshua");
    await insertRef("eleazar_ex", "Joshua", 19, 51, 19, 51, "Completes the division of the land by lot");
    await insertRef("eleazar_ex", "Joshua", 21,  1, 21,  3, "Levitical cities allocated before Eleazar and Joshua");
    await insertRef("eleazar_ex", "Joshua", 24, 33, 24, 33, "Death of Eleazar; buried at Gibeah of Phinehas");
  }
  if (await loadExisting("phinehas_ex", "Phinehas")) {
    await insertRef("phinehas_ex", "Joshua", 22, 13, 22, 34, "Leads delegation to challenge the Transjordanian altar");
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Seeding Joshua people...");
  await seedPeople();
  console.log("Seeding Joshua relationships...");
  await seedRelationships();
  console.log("Seeding Joshua scripture references...");
  await seedRefs();

  const pc = await db.execute("SELECT COUNT(*) as c FROM people");
  const rc = await db.execute("SELECT COUNT(*) as c FROM relationships");
  const sc = await db.execute("SELECT COUNT(*) as c FROM scripture_refs");
  console.log(`\n✓ Joshua seed complete.`);
  console.log(`  Total people now: ${(pc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total relationships now: ${(rc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total scripture refs now: ${(sc.rows[0] as unknown as { c: number }).c}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
