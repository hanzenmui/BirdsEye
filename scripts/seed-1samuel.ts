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
  if (!dbId) { console.warn(`  ⚠ ${name} not found in DB — skipping`); return false; }
  ids[key] = dbId; names[key] = name;
  return true;
}

// ── People ────────────────────────────────────────────────────────────────────
async function seedPeople() {
  // ── Hannah and Samuel's family ────────────────────────────────────────
  await safeInsertPerson({ key: "elkanah", name: "Elkanah",
    gender: "male",
    description: "Ephraimite from Ramathaim-Zophim, of the family of Zuph. Father of Samuel by Hannah. A devout man who went to Shiloh yearly to sacrifice. Had two wives — Hannah and Peninnah. Showed special favor to Hannah despite her barrenness.",
    tags: ["tribe of israel"] });

  await safeInsertPerson({ key: "peninnah", name: "Peninnah",
    gender: "female",
    description: "Elkanah's second wife, who had children. She provoked Hannah relentlessly because of Hannah's barrenness, causing Hannah to weep and not eat. Her taunting drove Hannah to her desperate prayer at Shiloh.",
    tags: ["tribe of israel"] });

  await safeInsertPerson({ key: "hannah", name: "Hannah",
    gender: "female",
    description: "Wife of Elkanah, barren and deeply distressed. Prayed fervently at Shiloh, vowing to give her son to the Lord as a Nazirite for life. Eli the priest mistook her silent prayer for drunkenness. God remembered her and she conceived Samuel. Her song of praise (1 Sam 2:1-10) anticipates Mary's Magnificat. She kept her vow, bringing Samuel to Eli after weaning him, and visited him yearly bringing a little robe. Eventually had five more children.",
    tags: ["matriarch", "tribe of israel"] });

  // ── Eli and sons ──────────────────────────────────────────────────────
  await safeInsertPerson({ key: "eli", name: "Eli",
    gender: "male",
    description: "High priest and judge at Shiloh for forty years. Raised Samuel after Hannah dedicated him to the Lord. Weak father who failed to restrain his wicked sons Hophni and Phinehas. Received a word of judgment against his house from a man of God and from the young Samuel himself. Died at 98 when he fell backward from his seat and broke his neck upon hearing that the ark had been captured and his sons killed.",
    tags: ["priest", "judge"] });

  await safeInsertPerson({ key: "hophni", name: "Hophni", alsoKnownAs: "Hophni son of Eli",
    gender: "male",
    description: "Son of Eli the priest. Described as a worthless man who did not know the Lord. He and his brother Phinehas abused their priestly office by taking meat from worshippers by force before it was offered and by sleeping with women at the entrance to the tent of meeting. Both died on the same day at the battle of Aphek when the Philistines captured the ark.",
    tags: ["priest", "antagonist"] });

  await safeInsertPerson({ key: "phinehas_eli", name: "Phinehas", alsoKnownAs: "Phinehas son of Eli",
    gender: "male",
    description: "Son of Eli the priest, brother of Hophni. Equally wicked: abused his priestly office and slept with women at the tabernacle. Killed in the same battle at Aphek when the ark was taken. Not to be confused with Phinehas son of Eleazar (Aaron's grandson). His wife gave birth to Ichabod ('the glory has departed') as she died in labor.",
    tags: ["priest", "antagonist"] });

  // ── Samuel ────────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "samuel", name: "Samuel",
    gender: "male",
    description: "Son of Elkanah and Hannah, dedicated to God before birth. Raised by Eli at Shiloh. Received his first prophetic word against Eli's house as a child. Grew up and established himself as a prophet throughout Israel from Dan to Beersheba. Last of the judges and first of the prophets after Moses. Anointed Saul as Israel's first king, then anointed David after Saul's rejection. Summoned from death by the witch of Endor. His bones were buried at Ramah.",
    tags: ["judge", "prophet", "nazirite"] });

  // ── Saul and his family ───────────────────────────────────────────────
  await safeInsertPerson({ key: "kish", name: "Kish",
    gender: "male",
    description: "Father of Saul, a Benjaminite of the clan of Matri. Described as a man of standing. Owned donkeys whose loss sent Saul and a servant searching, during which they consulted Samuel and Saul was privately anointed king.",
    tags: ["tribe of israel"] });

  await safeInsertPerson({ key: "saul", name: "Saul",
    gender: "male",
    description: "Son of Kish, a Benjaminite — tall, handsome, head and shoulders above others. First king of Israel, anointed by Samuel. Early victories over Ammon and Philistia were followed by disobedience: sparing Agag contrary to God's command and offering an unauthorized sacrifice. Samuel told him God had rejected him as king. His decline was marked by an evil spirit, jealousy of David, and consulting the witch of Endor. Died at the battle of Mount Gilboa — wounded by archers, he fell on his own sword.",
    tags: ["king", "tribe of israel"] });

  await safeInsertPerson({ key: "jonathan", name: "Jonathan",
    gender: "male",
    description: "Eldest son of King Saul. Courageous warrior who climbed a cliff with only his armor-bearer and routed a Philistine garrison. Made a covenant of love with David, giving him his robe, armor, sword, bow, and belt. Repeatedly protected David from Saul's murderous intentions. Tried to reconcile his father to David. Died with his father and brothers at the battle of Mount Gilboa. David's lament for him: 'Your love for me was wonderful, more wonderful than that of women.'",
    tags: ["warrior", "tribe of israel"] });

  await safeInsertPerson({ key: "merab", name: "Merab",
    gender: "female",
    description: "Elder daughter of Saul, promised to David as a wife for killing Goliath but then given to Adriel son of Barzillai. Her five sons were later given to the Gibeonites by David to atone for Saul's sins against them.",
    tags: ["tribe of israel"] });

  await safeInsertPerson({ key: "michal", name: "Michal",
    gender: "female",
    description: "Younger daughter of Saul. Loved David and helped him escape through a window when Saul sent men to kill him, placing an idol in his bed as a decoy. Given to Paltiel while David was a fugitive. David demanded her back after becoming king. Later she despised David for dancing before the ark and was reprimanded; she had no children to the day of her death.",
    tags: ["tribe of israel"] });

  await safeInsertPerson({ key: "abner", name: "Abner", alsoKnownAs: "Abner son of Ner",
    gender: "male",
    description: "Son of Ner, Saul's uncle, commander of Saul's army. Introduced David to Saul after Goliath's death. Supported Ish-bosheth as king after Saul's death in opposition to David. Killed Asahel (Joab's brother) in self-defense at the pool of Gibeon. Later switched allegiance to David after a quarrel with Ish-bosheth. Killed by Joab at Hebron in revenge for Asahel, without David's knowledge.",
    tags: ["warrior", "tribe of israel"] });

  // ── David ─────────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "david", name: "David",
    gender: "male",
    description: "Youngest son of Jesse of Bethlehem, tribe of Judah. Shepherd, musician, and warrior. Privately anointed by Samuel while still a youth after God rejected Saul. Killed Goliath with a sling stone and became a national hero. Deep friendship with Jonathan. Fugitive from Saul for years. Succeeded Saul as king, first over Judah (7 years in Hebron) then over all Israel (33 years in Jerusalem). Brought the ark to Jerusalem. Composed many Psalms. Committed adultery with Bathsheba and had her husband Uriah killed — confronted by the prophet Nathan. His reign was marked by family tragedy: Amnon's rape of Tamar, Absalom's rebellion. A man described as being after God's own heart, whose throne God promised would endure forever.",
    tags: ["king", "warrior", "poet", "tribe of israel", "messianic line", "ancestor"] });

  // ── Goliath ───────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "goliath", name: "Goliath",
    gender: "male",
    description: "Philistine champion from Gath, over nine feet tall (six cubits and a span). Wore a bronze helmet, scale armor weighing 125 pounds, bronze shin guards, and a bronze javelin. Challenged Israel to single combat for forty days. Killed by David with a single sling stone to the forehead, then beheaded with his own sword. His brother Lahmi is mentioned in Chronicles; other giants from Gath also appear in 2 Samuel 21.",
    tags: ["warrior", "antagonist", "giant"] });

  // ── Priests of Nob ────────────────────────────────────────────────────
  await safeInsertPerson({ key: "ahimelech", name: "Ahimelech", alsoKnownAs: "Ahimelech son of Ahitub",
    gender: "male",
    description: "Priest at Nob who gave David the showbread and Goliath's sword when David claimed to be on a secret royal mission. Doeg the Edomite witnessed this and reported it to Saul. Ahimelech protested his innocence before Saul; eighty-five priests of Nob were massacred at Saul's order. Only his son Abiathar escaped to warn David.",
    tags: ["priest"] });

  await safeInsertPerson({ key: "abiathar", name: "Abiathar",
    gender: "male",
    description: "Son of Ahimelech, sole survivor of Saul's massacre of the priests of Nob. Escaped and fled to David, bringing the ephod with him. Served as David's priest throughout his outlaw years and entire reign — the only legitimate ark-keeper outside of Zadok for decades. Consulted the ephod for David at Keilah and Ziklag. Carried the ark during Absalom's revolt and was part of David's intelligence network. Fatal error: supported Adonijah's bid for the throne instead of Solomon's. Solomon exiled him to Anathoth, fulfilling the prophecy against Eli's house (1 Kgs 2:27).",
    tags: ["priest"] });

  await safeInsertPerson({ key: "doeg", name: "Doeg", alsoKnownAs: "Doeg the Edomite",
    gender: "male",
    description: "Edomite who was Saul's chief shepherd. Witnessed Ahimelech give David bread and a sword at Nob. When Saul's guards refused to kill the priests, Doeg carried out Saul's order himself, killing 85 priests and the entire town of Nob — men, women, children, and livestock. David credited him with Saul's massacre in Psalm 52.",
    tags: ["antagonist"] });

  // ── Abigail, Nabal, Ahinoam ───────────────────────────────────────────
  await safeInsertPerson({ key: "nabal", name: "Nabal",
    gender: "male",
    description: "Wealthy Calebite from Maon who owned three thousand sheep and a thousand goats. His name means 'fool.' When David's men requested provisions in return for protecting Nabal's shepherds, Nabal refused contemptuously. David prepared to kill every male in Nabal's household. Abigail intercepted David with gifts. When told what nearly happened, Nabal's heart failed him and he died ten days later. David then took Abigail as his wife.",
    tags: ["antagonist"] });

  await safeInsertPerson({ key: "abigail", name: "Abigail",
    gender: "female",
    description: "Wife of Nabal the Calebite, described as intelligent and beautiful. When Nabal foolishly refused David's request, she prepared gifts without telling her husband and rode out to intercept David, bowing before him and deflecting his fury with eloquent humility. After Nabal died she became David's wife, following him to Hebron and Gath. Mother of David's son Chileab (also called Daniel).",
    tags: ["matriarch", "ancestor"] });

  await safeInsertPerson({ key: "ahinoam", name: "Ahinoam", alsoKnownAs: "Ahinoam of Jezreel",
    gender: "female",
    description: "Woman from Jezreel whom David took as a wife alongside Abigail. Mother of David's firstborn son Amnon. Traveled with David during his years of flight and to Hebron.",
    tags: ["matriarch", "ancestor"] });

  // ── Achish ────────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "achish", name: "Achish", alsoKnownAs: "Achish king of Gath",
    gender: "male",
    description: "Philistine king of Gath. David fled to him twice: first feigning madness to escape (Achish dismissed him), and later as a vassal with his six hundred men, where Achish gave him Ziklag. Trusted David but was persuaded by the other Philistine lords to send him away before the battle at Aphek where Saul died.",
    tags: ["king"] });
}

// ── Relationships ─────────────────────────────────────────────────────────────
async function seedRelationships() {
  // ── Elkanah's family ──────────────────────────────────────────────────
  await insertRel("elkanah",  "spouse_of",  "hannah",  "Hannah is Elkanah's favored wife (1 Sam 1:5)");
  await insertRel("elkanah",  "spouse_of",  "peninnah","Elkanah's other wife (1 Sam 1:2)");
  await insertRel("elkanah",  "parent_of",  "samuel",  "Samuel son of Elkanah and Hannah (1 Sam 1:20)");
  await insertRel("hannah",   "parent_of",  "samuel",  "Hannah's vowed son, dedicated to God (1 Sam 1:27)");

  // ── Eli's family ──────────────────────────────────────────────────────
  await insertRel("eli",      "parent_of",  "hophni",      "Hophni son of Eli (1 Sam 1:3)");
  await insertRel("eli",      "parent_of",  "phinehas_eli","Phinehas son of Eli (1 Sam 1:3)");
  await insertRel("eli",      "mentor_of",  "samuel",      "Eli raised Samuel at Shiloh (1 Sam 3)");

  // ── Saul's family ─────────────────────────────────────────────────────
  await insertRel("kish",     "parent_of",  "saul",    "Saul son of Kish the Benjaminite (1 Sam 9:1-2)");
  await insertRel("saul",     "parent_of",  "jonathan","Jonathan, Saul's eldest son (1 Sam 14:1)");
  await insertRel("saul",     "parent_of",  "merab",   "Merab, Saul's elder daughter (1 Sam 14:49)");
  await insertRel("saul",     "parent_of",  "michal",  "Michal, Saul's younger daughter (1 Sam 14:49)");
  await insertRel("saul",     "enemy_of",   "david",   "Saul hunted David for years out of jealousy (1 Sam 19–26)");
  await insertRel("jonathan", "ally_of",    "david",   "Covenant of love; protected David from Saul (1 Sam 18:3-4)");
  await insertRel("michal",   "spouse_of",  "david",   "Michal given to David; later reclaimed by him (1 Sam 18:27)");

  // ── Saul's military ───────────────────────────────────────────────────
  await insertRelNameToLocal("Benjamin", "ancestor_of", "saul",   "Saul from tribe of Benjamin (1 Sam 9:1)");
  await insertRelNameToLocal("Benjamin", "ancestor_of", "kish",   "Kish from tribe of Benjamin (1 Sam 9:1)");
  await insertRel("abner",    "servant_of", "saul",    "Abner was commander of Saul's army (1 Sam 14:50)");

  // ── David ─────────────────────────────────────────────────────────────
  await insertRelByName("Jesse", "parent_of", "David", "David son of Jesse of Bethlehem (1 Sam 16:13)");
  await insertRelNameToLocal("Judah", "ancestor_of", "david", "David from tribe of Judah, Bethlehem (1 Sam 17:12)");
  await insertRel("david",    "enemy_of",   "goliath", "David killed Goliath with a sling stone (1 Sam 17:49)");
  await insertRel("david",    "spouse_of",  "abigail", "David married Abigail after Nabal's death (1 Sam 25:42)");
  await insertRel("david",    "spouse_of",  "ahinoam", "Ahinoam of Jezreel, David's wife (1 Sam 25:43)");
  await insertRel("nabal",    "spouse_of",  "abigail", "Nabal's wife who saved David's men (1 Sam 25:3)");

  // ── Priests of Nob ────────────────────────────────────────────────────
  await insertRel("ahimelech","ally_of",    "david",   "Gave David showbread and Goliath's sword (1 Sam 21:6)");
  await insertRel("ahimelech","parent_of",  "abiathar","Abiathar, sole survivor of Nob massacre (1 Sam 22:20)");
  await insertRel("abiathar", "ally_of",    "david",   "Fled to David with the ephod; served him the rest of his life");
  await insertRel("doeg",     "enemy_of",   "ahimelech","Massacred 85 priests at Saul's order (1 Sam 22:18)");
  await insertRel("doeg",     "servant_of", "saul",    "Saul's chief shepherd, informant (1 Sam 21:7)");
}

// ── Scripture references ───────────────────────────────────────────────────────
async function seedRefs() {
  await insertRef("elkanah",    "1 Samuel",  1,  1,  1,  8, "Yearly pilgrimage to Shiloh; two wives described");
  await insertRef("peninnah",   "1 Samuel",  1,  2,  1,  7, "Provoked Hannah because of her barrenness");
  await insertRef("hannah",     "1 Samuel",  1,  1,  2, 11, "Prayer at Shiloh; song of praise; Samuel dedicated");
  await insertRef("eli",        "1 Samuel",  1,  9, 14,  3, "High priest at Shiloh; misjudges Hannah; raises Samuel; death");
  await insertRef("hophni",     "1 Samuel",  1,  3,  4, 11, "Wicked son of Eli; killed when ark taken");
  await insertRef("phinehas_eli","1 Samuel", 1,  3,  4, 22, "Wicked son of Eli; wife dies naming son Ichabod");
  await insertRef("samuel",     "1 Samuel",  1, 20, 28, 20, "Prophet, judge, king-maker; anoints Saul and David");
  await insertRef("kish",       "1 Samuel",  9,  1,  9,  5, "Father of Saul; his donkeys trigger Saul meeting Samuel");
  await insertRef("saul",       "1 Samuel",  9,  1, 31, 13, "First king of Israel; anointed, reigned, rejected, died");
  await insertRef("jonathan",   "1 Samuel", 13,  3, 31, 13, "Son of Saul; friend of David; died at Gilboa");
  await insertRef("merab",      "1 Samuel", 14, 49, 18, 19, "Saul's elder daughter; promised then withheld from David");
  await insertRef("michal",     "1 Samuel", 14, 49, 19, 17, "Loves David; helps him escape; given to Paltiel");
  await insertRef("abner",      "1 Samuel", 14, 50, 17, 55, "Commander of Saul's army; introduces David to Saul");
  await insertRef("david",      "1 Samuel", 16,  1, 31, 13, "Anointed by Samuel; kills Goliath; flees Saul");
  await insertRef("goliath",    "1 Samuel", 17,  1, 17, 51, "Philistine champion; forty-day taunt; killed by David");
  await insertRef("ahimelech",  "1 Samuel", 21,  1, 22, 20, "Gives David showbread and sword; massacred by Doeg");
  await insertRef("abiathar",   "1 Samuel", 22, 20, 23, 12, "Escapes Nob; joins David; ephod consulted at Keilah");
  await insertRef("doeg",       "1 Samuel", 21,  7, 22, 22, "Witnesses David at Nob; massacres 85 priests");
  await insertRef("nabal",      "1 Samuel", 25,  2, 25, 38, "Refuses David; dies ten days after Abigail's intervention");
  await insertRef("abigail",    "1 Samuel", 25,  2, 25, 44, "Intervenes to save Nabal's household; marries David");
  await insertRef("ahinoam",    "1 Samuel", 25, 43, 30,  5, "David's wife from Jezreel; mother of Amnon");
  await insertRef("achish",     "1 Samuel", 21, 10, 29, 11, "Philistine king of Gath; David feigns madness; grants Ziklag");
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Seeding 1 Samuel people...");
  await seedPeople();
  console.log("Seeding 1 Samuel relationships...");
  await seedRelationships();
  console.log("Seeding 1 Samuel scripture references...");
  await seedRefs();

  const pc = await db.execute("SELECT COUNT(*) as c FROM people");
  const rc = await db.execute("SELECT COUNT(*) as c FROM relationships");
  const sc = await db.execute("SELECT COUNT(*) as c FROM scripture_refs");
  console.log(`\n✓ 1 Samuel seed complete.`);
  console.log(`  Total people now: ${(pc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total relationships now: ${(rc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total scripture refs now: ${(sc.rows[0] as unknown as { c: number }).c}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
