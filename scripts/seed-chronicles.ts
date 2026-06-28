// 1 & 2 Chronicles: Judah king lineage gaps, temple musicians/psalmists, David's warriors, prophets
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

async function loadExisting(key: string, name: string): Promise<boolean> {
  const r = await db.execute({ sql: "SELECT id FROM people WHERE name = ? LIMIT 1", args: [name] });
  const row = r.rows[0] as unknown as { id: string } | undefined;
  if (row) { ids[key] = row.id; names[key] = name; return true; }
  console.warn(`  ⚠ Could not find existing person: ${name}`);
  return false;
}

async function loadExistingByAka(key: string, name: string, aka: string): Promise<boolean> {
  const r = await db.execute({
    sql: "SELECT id FROM people WHERE name = ? AND also_known_as = ? LIMIT 1",
    args: [name, aka],
  });
  const row = r.rows[0] as unknown as { id: string } | undefined;
  if (row) { ids[key] = row.id; names[key] = name; return true; }
  console.warn(`  ⚠ Could not find existing person: ${name} (${aka})`);
  return false;
}

async function insertRelLocalToName(aKey: string, type: string, bName: string, notes?: string) {
  const bId = await lookupId(bName);
  if (!bId) { console.warn(`  ⚠ Could not find ${bName}`); return; }
  await db.execute({
    sql: `INSERT OR IGNORE INTO relationships (id,person_a_id,person_a_name,type,person_b_id,person_b_name,notes,created_at)
          VALUES (?,?,?,?,?,?,?,datetime('now'))`,
    args: [crypto.randomUUID(), id(aKey), names[aKey] ?? aKey, type, bId, bName, notes ?? ''],
  });
}

// ── Load cross-seed people ─────────────────────────────────────────────────────
async function loadCrossSeedPeople() {
  await loadExisting("david", "David");
  await loadExisting("solomon", "Solomon");
  await loadExisting("rehoboam", "Rehoboam");
  await loadExistingByAka("joash_judah", "Joash", "Joash king of Judah");
  await loadExistingByAka("ahaziah_judah", "Ahaziah", "Ahaziah king of Judah");
  await loadExisting("hezekiah", "Hezekiah");
  await loadExistingByAka("uzziah", "Uzziah", "Uzziah king of Judah, Azariah king of Judah");
  await loadExistingByAka("jotham_judah", "Jotham", "Jotham king of Judah, son of Uzziah");
  await loadExistingByAka("ahaz_judah", "Ahaz", "Ahaz king of Judah, son of Jotham");
  await loadExisting("athaliah", "Athaliah");
  await loadExisting("josiah", "Josiah");
  await loadExistingByAka("korah", "Korah", "Korah son of Izhar");  // Numbers seed
}

// ── People ─────────────────────────────────────────────────────────────────────
async function seedPeople() {
  // ── Missing Judah kings (Rehoboam → Hezekiah chain gaps) ──────────────────

  await safeInsertPerson({
    key: "abijam",
    name: "Abijah",
    alsoKnownAs: "Abijam king of Judah, Abijah son of Rehoboam",
    gender: "male",
    description: "Son of Rehoboam and king of Judah (~913–911 BC). Fought and defeated Jeroboam of Israel, citing the Davidic covenant (2 Chr 13:1–22). Also called Abijam in 1 Kings 15.",
    tags: ["king", "judah", "OT"],
  });

  await safeInsertPerson({
    key: "asa",
    name: "Asa",
    alsoKnownAs: "Asa king of Judah, son of Abijam",
    gender: "male",
    description: "Reforming king of Judah (~911–870 BC). Removed idols, expelled male cult prostitutes, and relied on God when the Ethiopians attacked (2 Chr 14–16). Failed to seek God in a later battle and died with diseased feet.",
    tags: ["king", "judah", "reformer", "OT"],
  });

  await safeInsertPerson({
    key: "jehoshaphat",
    name: "Jehoshaphat",
    alsoKnownAs: "Jehoshaphat king of Judah, son of Asa",
    gender: "male",
    description: "One of Judah's better kings (~873–849 BC). Sent teachers throughout the land, established judges, and led the people in prayer against a coalition of enemies (2 Chr 17–20). Famously said 'Trust in the LORD your God and you will be established'.",
    tags: ["king", "judah", "reformer", "OT"],
  });

  await safeInsertPerson({
    key: "jehoram_judah",
    name: "Jehoram",
    alsoKnownAs: "Jehoram king of Judah, Joram king of Judah",
    gender: "male",
    description: "Son of Jehoshaphat, king of Judah (~849–842 BC). Married Athaliah daughter of Ahab and led Judah into idolatry. Killed his brothers to secure the throne. Afflicted with an incurable bowel disease prophesied by Elijah (2 Chr 21; 2 Kgs 8:16–24).",
    tags: ["king", "judah", "OT"],
  });

  await safeInsertPerson({
    key: "amaziah",
    name: "Amaziah",
    alsoKnownAs: "Amaziah king of Judah, son of Joash",
    gender: "male",
    description: "Son of Joash/Jehoash, king of Judah (~796–767 BC). Defeated Edom but then worshipped Edomite gods; challenged Israel's king Jehoash and was badly defeated. Assassinated in Lachish (2 Chr 25; 2 Kgs 14).",
    tags: ["king", "judah", "OT"],
  });

  // ── Temple musicians / psalmists ──────────────────────────────────────────

  await safeInsertPerson({
    key: "asaph",
    name: "Asaph",
    alsoKnownAs: "Asaph son of Berechiah",
    gender: "male",
    description: "Levitical musician appointed by David to lead temple worship, and author of twelve psalms (Ps 50, 73–83). Son of Berechiah, from the clan of Gershon; stood at David's right hand with cymbals (1 Chr 6:39; 15:17; 25:1–9).",
    tags: ["musician", "psalmist", "levite", "OT"],
  });

  await safeInsertPerson({
    key: "heman",
    name: "Heman",
    alsoKnownAs: "Heman the Ezrahite, Heman son of Joel",
    gender: "male",
    description: "Grandson of Samuel and chief musician in the temple. Author of Psalm 88 ('A Song of the Sons of Korah'). Had fourteen sons and three daughters who all served in the music ministry (1 Chr 6:33; 25:1–7).",
    tags: ["musician", "psalmist", "levite", "OT"],
  });

  await safeInsertPerson({
    key: "jeduthun",
    name: "Jeduthun",
    alsoKnownAs: "Jeduthun the seer, Ethan the Ezrahite",
    gender: "male",
    description: "Third of David's three chief temple musicians, alongside Asaph and Heman. Likely the same person as Ethan the Ezrahite, author of Psalm 89. His name appears in the headers of Psalms 39, 62, and 77 (1 Chr 6:44; 16:41–42; 25:1–3).",
    tags: ["musician", "psalmist", "levite", "seer", "OT"],
  });

  // ── David's mighty warriors ────────────────────────────────────────────────

  await safeInsertPerson({
    key: "benaiah",
    name: "Benaiah",
    alsoKnownAs: "Benaiah son of Jehoiada, Benaiah the mighty warrior",
    gender: "male",
    description: "David's elite warrior and commander of the bodyguard. Killed two Moabite champions, a lion in a pit on a snowy day, and a giant Egyptian soldier. Later became Solomon's army commander after supporting his succession (1 Chr 11:22–25; 27:5–6; 1 Kgs 2:35).",
    tags: ["warrior", "soldier", "commander", "OT"],
  });

  // ── Chronicles-unique characters ──────────────────────────────────────────

  await safeInsertPerson({
    key: "jabez",
    name: "Jabez",
    alsoKnownAs: "Jabez of Judah",
    gender: "male",
    description: "A man of Judah in the genealogies whose brief story stands out: he prayed for God to enlarge his territory and bless him, and God granted it. His mother named him Jabez ('pain') because of the painful birth (1 Chr 4:9–10).",
    tags: ["OT"],
  });

  await safeInsertPerson({
    key: "azariah_oded",
    name: "Azariah son of Oded",
    alsoKnownAs: "Azariah son of Oded the prophet",
    gender: "male",
    description: "Prophet who met King Asa returning from victory and urged him to continue the reform: 'The LORD is with you when you are with him; if you seek him, he will be found by you' (2 Chr 15:1–8).",
    tags: ["prophet", "OT"],
  });

  await safeInsertPerson({
    key: "shemaiah_prophet",
    name: "Shemaiah",
    alsoKnownAs: "Shemaiah the man of God, prophet to Rehoboam",
    gender: "male",
    description: "Prophet who told Rehoboam not to fight Israel after the kingdom split (1 Kgs 12:22–24), and later warned him that God would allow Shishak of Egypt to plunder Jerusalem because Judah had abandoned God (2 Chr 12:5–7).",
    tags: ["prophet", "OT"],
  });

  await safeInsertPerson({
    key: "hanani",
    name: "Hanani the seer",
    alsoKnownAs: "Hanani the seer, father of Jehu the prophet",
    gender: "male",
    description: "Prophet who rebuked King Asa for relying on Syria rather than God in a military crisis. Asa had him imprisoned for this (2 Chr 16:7–10).",
    tags: ["prophet", "seer", "OT"],
  });
}

// ── Relationships ──────────────────────────────────────────────────────────────
async function seedRelationships() {
  // Judah king succession chain
  await insertRel("rehoboam", "parent_of", "abijam", "Rehoboam's son who succeeded him (1 Kgs 15:1–8; 2 Chr 13)");
  await insertRel("abijam", "parent_of", "asa", "Asa succeeded his father Abijam (1 Kgs 15:9–10; 2 Chr 14:1)");
  await insertRel("asa", "parent_of", "jehoshaphat", "Jehoshaphat succeeded his father Asa (1 Kgs 22:41; 2 Chr 17:1)");
  await insertRel("jehoshaphat", "parent_of", "jehoram_judah", "Jehoram king of Judah, son of Jehoshaphat (2 Chr 21:1)");
  await insertRel("jehoram_judah", "parent_of", "ahaziah_judah", "Ahaziah king of Judah, son of Jehoram (2 Chr 22:1)");
  // Athaliah was Ahab's daughter (in 2 Kings seed) and became Joash's regent
  await insertRel("jehoram_judah", "spouse_of", "athaliah", "Jehoram married Athaliah daughter of Ahab (2 Chr 21:6)");
  await insertRel("joash_judah", "parent_of", "amaziah", "Amaziah son of Joash/Jehoash king of Judah (2 Chr 25:1; 2 Kgs 14:1)");
  await insertRel("amaziah", "parent_of", "uzziah", "Uzziah (Azariah) succeeded his father Amaziah (2 Kgs 14:21; 2 Chr 26:1)");

  // Temple musicians — all appointed by David
  await insertRel("david", "ally_of", "asaph", "David appointed Asaph as chief musician (1 Chr 15:17; 16:5)");
  await insertRel("david", "ally_of", "heman", "David appointed Heman as a chief musician (1 Chr 6:33; 15:17)");
  await insertRel("david", "ally_of", "jeduthun", "David appointed Jeduthun (Ethan) as a chief musician (1 Chr 15:17; 16:41)");
  await insertRel("asaph", "ally_of", "heman", "Colleagues in the temple music ministry (1 Chr 15:17–19; 2 Chr 5:12)");
  await insertRel("asaph", "ally_of", "jeduthun", "Colleagues in the temple music ministry (1 Chr 15:17–19)");
  await insertRel("heman", "ally_of", "jeduthun", "Colleagues in the temple music ministry (1 Chr 25:1; 2 Chr 5:12)");

  // Heman as descendant of Korah (grandson of Samuel)
  // Heman is son of Joel son of Samuel (1 Chr 6:33)
  await insertRelLocalToName("heman", "descendant_of", "Korah",
    "Heman traced his ancestry through Korah's clan: Korah → Ebiasaph → ... → Elkanah → Joel → Heman (1 Chr 6:33–38)");

  // Benaiah — David's warrior, later Solomon's commander
  await insertRel("david", "ally_of", "benaiah", "Benaiah led David's personal bodyguard (the Kerethites and Pelethites, 1 Chr 27:5–6)");
  await insertRelLocalToName("benaiah", "ally_of", "Solomon", "Sided with Solomon against Adonijah; became army commander under Solomon (1 Kgs 2:35)");

  // Prophets
  await insertRel("azariah_oded", "ally_of", "asa", "Prophesied encouragement to Asa; prompted his great religious reform (2 Chr 15:1–8)");
  await insertRel("shemaiah_prophet", "other", "rehoboam", "Warned Rehoboam not to fight Israel; later rebuked him for abandoning God (1 Kgs 12:22–24; 2 Chr 12:5–7)");
  await insertRel("hanani", "other", "asa", "Rebuked Asa for relying on Syria; Asa had him imprisoned (2 Chr 16:7–10)");
}

// ── Scripture references ───────────────────────────────────────────────────────
async function seedRefs() {
  // Judah kings
  await insertRef("abijam", "1 Kings", 15, 1, 15, 8, "Reign of Abijam/Abijah in 1 Kings");
  await insertRef("abijam", "2 Chronicles", 13, 1, 13, 22, "Abijah's victory over Jeroboam");
  await insertRef("asa", "1 Kings", 15, 9, 15, 24, "Reign of Asa in 1 Kings");
  await insertRef("asa", "2 Chronicles", 14, 1, 16, 14, "Asa's reform and the Ethiopian battle");
  await insertRef("jehoshaphat", "1 Kings", 22, 41, 22, 50, "Jehoshaphat in 1 Kings");
  await insertRef("jehoshaphat", "2 Chronicles", 17, 1, 20, 37, "Jehoshaphat's reign and battle prayer");
  await insertRef("jehoram_judah", "2 Kings", 8, 16, 8, 24, "Jehoram king of Judah in 2 Kings");
  await insertRef("jehoram_judah", "2 Chronicles", 21, 1, 21, 20, "Jehoram's idolatry and Elijah's prophecy");
  await insertRef("amaziah", "2 Kings", 14, 1, 14, 22, "Amaziah in 2 Kings");
  await insertRef("amaziah", "2 Chronicles", 25, 1, 25, 28, "Amaziah's Edom victory and idolatry");

  // Temple musicians — 1 Chronicles
  await insertRef("asaph", "1 Chronicles", 6, 39, 6, 39, "Asaph son of Berechiah in Levite genealogy");
  await insertRef("asaph", "1 Chronicles", 15, 17, 15, 19, "Appointed as chief musician by David");
  await insertRef("asaph", "1 Chronicles", 25, 1, 25, 9, "Asaph and his sons appointed to prophesy with instruments");
  await insertRef("asaph", "Psalms", 50, 1, 50, 23, "A psalm of Asaph (Psalm 50)");
  await insertRef("asaph", "Psalms", 73, 1, 83, 18, "The Asaph psalms (Psalms 73–83)");
  await insertRef("heman", "1 Chronicles", 6, 33, 6, 38, "Heman in the Levite genealogy");
  await insertRef("heman", "1 Chronicles", 25, 1, 25, 7, "Heman and his 14 sons in the music ministry");
  await insertRef("heman", "Psalms", 88, 1, 88, 18, "Psalm 88: A song of Heman the Ezrahite");
  await insertRef("jeduthun", "1 Chronicles", 16, 41, 16, 42, "Jeduthun appointed with Heman for thanksgiving");
  await insertRef("jeduthun", "1 Chronicles", 25, 1, 25, 3, "Jeduthun's six sons in the music ministry");
  await insertRef("jeduthun", "Psalms", 39, 1, 39, 1, "Psalm 39: according to Jeduthun");
  await insertRef("jeduthun", "Psalms", 62, 1, 62, 1, "Psalm 62: according to Jeduthun");
  await insertRef("jeduthun", "Psalms", 77, 1, 77, 1, "Psalm 77: according to Jeduthun");
  await insertRef("jeduthun", "Psalms", 89, 1, 89, 52, "Psalm 89: possibly by Ethan the Ezrahite (same as Jeduthun)");

  // Benaiah
  await insertRef("benaiah", "1 Chronicles", 11, 22, 11, 25, "Benaiah's exploits: lion in a pit, Moabite champions, Egyptian giant");
  await insertRef("benaiah", "1 Chronicles", 27, 5, 27, 6, "Benaiah commands David's bodyguard");
  await insertRef("benaiah", "1 Kings", 2, 35, 2, 35, "Appointed as Solomon's army commander");

  // Jabez
  await insertRef("jabez", "1 Chronicles", 4, 9, 4, 10, "Prayer of Jabez: 'enlarge my territory'");

  // Prophets
  await insertRef("azariah_oded", "2 Chronicles", 15, 1, 15, 8, "Azariah's prophecy to Asa encouraging reform");
  await insertRef("shemaiah_prophet", "1 Kings", 12, 22, 12, 24, "Shemaiah tells Rehoboam not to fight Israel");
  await insertRef("shemaiah_prophet", "2 Chronicles", 12, 5, 12, 7, "Shemaiah rebukes Rehoboam for abandoning God");
  await insertRef("hanani", "2 Chronicles", 16, 7, 16, 10, "Hanani rebuked Asa; imprisoned for it");
}

async function main() {
  console.log("Seeding Chronicles...");
  await loadCrossSeedPeople();
  await seedPeople();
  console.log("  People done");
  await seedRelationships();
  console.log("  Relationships done");
  await seedRefs();
  console.log("  Scripture refs done");
  console.log("Chronicles seed complete.");
}

main().catch(console.error);
