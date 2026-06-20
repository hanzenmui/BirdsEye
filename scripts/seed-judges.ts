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
  // ── Judge 1: Othniel (Judg 3) ─────────────────────────────────────────
  await safeInsertPerson({ key: "othniel", name: "Othniel",
    gender: "male",
    description: "Son of Kenaz, Caleb's younger brother (Judg 3:9). Captured Debir and received Achsah (Caleb's daughter) as his wife. Became the first judge of Israel after the conquest, delivering Israel from Cushan-rishathaim, king of Aram-Naharaim. He judged Israel forty years. A model judge: the Spirit of the Lord came upon him, he went to war, prevailed, and there was peace during his lifetime.",
    tags: ["judge", "warrior", "tribe of israel"] });

  await safeInsertPerson({ key: "cushan", name: "Cushan-rishathaim",
    gender: "male",
    description: "King of Aram-Naharaim (Mesopotamia). The first foreign oppressor God raised up against Israel after Joshua's generation died. Oppressed Israel for eight years until Othniel delivered them. His name in Hebrew sounds like 'double wickedness from Cushan.'",
    tags: ["king", "antagonist"] });

  // ── Judge 2: Ehud (Judg 3) ────────────────────────────────────────────
  await safeInsertPerson({ key: "ehud", name: "Ehud",
    gender: "male",
    description: "Son of Gera, a Benjaminite, and left-handed. Second judge of Israel. Fashioned a double-edged sword eighteen inches long and strapped it to his right thigh, concealed under his robe. Brought tribute to Eglon king of Moab, then returned alone claiming to have a secret message from God. Killed Eglon by driving the sword into his belly — so fat that the handle disappeared. Escaped while servants waited, then rallied Israel to defeat Moab. Israel had peace for eighty years.",
    tags: ["judge", "warrior", "tribe of israel"] });

  await safeInsertPerson({ key: "eglon", name: "Eglon",
    gender: "male",
    description: "King of Moab who oppressed Israel for eighteen years, with Ammonite and Amalekite allies. Described as a very fat man. Killed in his upper room by Ehud with a concealed sword — the blade disappeared into his flesh.",
    tags: ["king", "antagonist", "moabite"] });

  // ── Judge 3: Shamgar (Judg 3) ─────────────────────────────────────────
  await safeInsertPerson({ key: "shamgar", name: "Shamgar", alsoKnownAs: "Shamgar son of Anath",
    gender: "male",
    description: "Son of Anath. Third judge of Israel, though his account is only one verse. Killed six hundred Philistines with an oxgoad and delivered Israel. Likely a Canaanite or semi-Canaanite hero incorporated into Israel's tradition; his mother's name 'Anath' is a Canaanite goddess.",
    tags: ["judge", "warrior"] });

  // ── Judges 4–5: Deborah, Barak, Jael, Sisera, Jabin ─────────────────
  await safeInsertPerson({ key: "deborah", name: "Deborah", alsoKnownAs: "Deborah wife of Lappidoth",
    gender: "female",
    description: "Prophetess, wife of Lappidoth, and the only female judge of Israel. She held court under the Palm of Deborah between Ramah and Bethel in the hills of Ephraim. Summoned Barak son of Abinoam and commanded him to take ten thousand men to Mount Tabor to fight Sisera. When Barak refused to go without her, she prophesied that the honor of the victory would go to a woman. Led the battle, sang the Song of Deborah celebrating the victory. One of the most celebrated figures in all of Judges.",
    tags: ["judge", "prophetess", "warrior"] });

  await safeInsertPerson({ key: "barak", name: "Barak", alsoKnownAs: "Barak son of Abinoam",
    gender: "male",
    description: "Son of Abinoam from Kedesh-Naphtali. Military commander summoned by Deborah to lead Israel against Sisera. Refused to go without Deborah's presence, so the honor of killing Sisera went to Jael instead. Led ten thousand men down Mount Tabor; God threw Sisera's nine hundred iron chariots into confusion. Defeated the entire army. Named in Hebrews 11 as a hero of faith.",
    tags: ["judge", "warrior", "tribe of israel"] });

  await safeInsertPerson({ key: "sisera", name: "Sisera",
    gender: "male",
    description: "Commander of King Jabin's army, based at Harosheth Haggoyim. Had nine hundred iron chariots. His army was routed by Israel under Barak at the Kishon River. He fled on foot to the tent of Jael, a Kenite woman whose clan was at peace with Jabin. She gave him milk, covered him, and when he slept drove a tent peg through his temple. The Song of Deborah vividly describes his mother waiting in vain at the window for his return.",
    tags: ["warrior", "antagonist"] });

  await safeInsertPerson({ key: "jabin", name: "Jabin", alsoKnownAs: "Jabin king of Hazor",
    gender: "male",
    description: "King of Canaan who ruled from Hazor. Oppressed Israel for twenty years with his nine hundred iron chariots under Sisera's command. After Sisera's death, Israel grew stronger against Jabin until they destroyed him.",
    tags: ["king", "antagonist"] });

  await safeInsertPerson({ key: "jael", name: "Jael", alsoKnownAs: "Jael wife of Heber",
    gender: "female",
    description: "Wife of Heber the Kenite, a clan at peace with Jabin's Hazor. When Sisera fled to her tent, she received him warmly — gave him milk, covered him, and swore to guard him. When he slept she drove a tent peg through his temple with a hammer. Deborah's song declares: 'Most blessed of women is Jael.' She acted outside the expected diplomatic alignment of her household.",
    tags: ["warrior"] });

  await safeInsertPerson({ key: "heber", name: "Heber", alsoKnownAs: "Heber the Kenite",
    gender: "male",
    description: "Kenite man, a descendant of Hobab (Moses's father-in-law). His clan had separated from the other Kenites and camped near Kedesh. His family was at peace with Jabin king of Hazor. His wife Jael killed Sisera.",
    tags: ["other"] });

  // ── Judge 5: Gideon (Judg 6–8) ───────────────────────────────────────
  await safeInsertPerson({ key: "gideon", name: "Gideon", alsoKnownAs: "Jerubbaal",
    gender: "male",
    description: "Son of Joash the Abiezrite, from the tribe of Manasseh. Also called Jerubbaal ('let Baal contend') after he tore down his father's Baal altar. Fifth judge of Israel. Called by the Angel of the Lord while threshing wheat in a winepress to hide from the Midianites. Tested God with a fleece of wool. Led three hundred men with torches, jars, and trumpets — no swords — to rout the vast Midianite army at night. Captured and killed the Midianite kings Zebah and Zalmunna. Refused the offer of kingship: 'The Lord will rule over you.' Made a golden ephod that became an idol. Had seventy sons by his wives and one son, Abimelech, by a concubine in Shechem.",
    tags: ["judge", "warrior", "tribe of israel"] });

  await safeInsertPerson({ key: "joash_gideon", name: "Joash", alsoKnownAs: "Joash father of Gideon",
    gender: "male",
    description: "Father of Gideon, of the clan of Abiezer in Manasseh. Owned a Baal altar and an Asherah pole that Gideon tore down at God's command. When the townspeople demanded Gideon's death, Joash defended him: 'If Baal is a god, let him contend for himself.'",
    tags: ["tribe of israel"] });

  await safeInsertPerson({ key: "zebah", name: "Zebah",
    gender: "male",
    description: "One of the two kings of Midian captured by Gideon east of the Jordan at Karkor. Gideon killed him personally to avenge his brothers who had been slain at Tabor.",
    tags: ["king", "antagonist"] });

  await safeInsertPerson({ key: "zalmunna", name: "Zalmunna",
    gender: "male",
    description: "Co-king of Midian with Zebah, captured by Gideon. Both admitted having killed Gideon's brothers at Tabor, sealing their fate. Gideon executed him personally.",
    tags: ["king", "antagonist"] });

  await safeInsertPerson({ key: "abimelech", name: "Abimelech", alsoKnownAs: "Abimelech son of Gideon",
    gender: "male",
    description: "Son of Gideon by a concubine from Shechem. Persuaded the men of Shechem to back his bid for power by reminding them he was their kinsman. Killed seventy of his brothers on a single stone — only Jotham, the youngest, escaped. Made king by Shechem. Ruled three years before quarreling with the Shechemites. Destroyed Shechem and slaughtered its people. Attacked Thebez, where a woman dropped an upper millstone on his head, fracturing his skull. He quickly ordered his armor-bearer to run him through so no one could say 'a woman killed him.'",
    tags: ["king", "antagonist"] });

  await safeInsertPerson({ key: "jotham", name: "Jotham", alsoKnownAs: "Jotham son of Gideon",
    gender: "male",
    description: "Youngest son of Gideon and the only one to escape Abimelech's massacre of his brothers. Climbed Mount Gerizim and delivered the famous Parable of the Trees to the men of Shechem: the trees sought a king, asking the olive, fig, and vine, all of whom refused; finally the thornbush accepted and threatened to devour anyone who did not take refuge in it. Jotham cursed Abimelech and Shechem and fled. His curse was fulfilled when Shechem and Abimelech destroyed each other.",
    tags: ["tribe of israel"] });

  // ── Judge 9: Jephthah (Judg 11–12) ───────────────────────────────────
  await safeInsertPerson({ key: "jephthah", name: "Jephthah",
    gender: "male",
    description: "Son of Gilead by a prostitute. Driven away by his legitimate brothers who denied him any share of the inheritance. Led a band of men in the land of Tob. Recalled by the elders of Gilead to fight the Ammonites and promised leadership if he succeeded. Made a rash vow to sacrifice whatever came out of his door first if God gave him victory. Won the battle. His only daughter came out dancing. He fulfilled his vow — interpreted by most as dedicating her to lifelong virginity rather than death, though the text is ambiguous. Killed 42,000 Ephraimites who could not pronounce 'Shibboleth.' Judged Israel six years.",
    tags: ["judge", "warrior", "tribe of israel"] });

  await safeInsertPerson({ key: "jephthah_daughter", name: "Jephthah's Daughter",
    gender: "female",
    description: "Only child of Jephthah. Came out with tambourines and dancing to meet her father after his victory over Ammon — the first to exit his door, making her the subject of his rash vow. Asked for two months to go into the hills with her companions to mourn her virginity. Returned and her father 'did to her as he had vowed.' The daughters of Israel commemorated her four days every year. She is unnamed in the text.",
    tags: ["tribe of israel"] });

  // ── Judge 12: Samson (Judg 13–16) ────────────────────────────────────
  await safeInsertPerson({ key: "manoah", name: "Manoah",
    gender: "male",
    description: "Danite from Zorah, father of Samson. His wife was barren until the Angel of the Lord appeared and announced Samson's birth. Manoah prayed for the angel to return and teach them how to raise the child. When the angel ascended in the flame of the altar, Manoah feared death for having seen God. He and his wife traveled to Timnah for Samson's wedding.",
    tags: ["tribe of israel"] });

  await safeInsertPerson({ key: "samson", name: "Samson",
    gender: "male",
    description: "Son of Manoah, a Danite Nazirite from birth. The last of the great judges, famous for his supernatural strength tied to his uncut hair. Killed a lion with bare hands. Set 300 foxes loose with torches to burn Philistine fields. Killed a thousand Philistines with a donkey's jawbone. Carried Gaza's city gates to a hilltop. His weakness was Delilah, bribed by the Philistine lords to discover his secret. Had his eyes gouged out and was put to work grinding grain. At a feast in Dagon's temple he pushed down the pillars, killing more Philistines in his death than in his life. Judged Israel twenty years.",
    tags: ["judge", "warrior", "nazirite", "tribe of israel"] });

  await safeInsertPerson({ key: "delilah", name: "Delilah",
    gender: "female",
    description: "A woman from the Valley of Sorek, beloved by Samson. Bribed by the five Philistine lords (1,100 pieces of silver each) to discover the secret of his strength. Three times Samson deceived her; the third time she wept and nagged until he told her about his Nazirite vow. While he slept, she had his head shaved. Called out 'the Philistines are upon you, Samson!' for the fourth time — this time he could not break free. Her name became synonymous with betrayal through seduction.",
    tags: ["antagonist"] });
}

// ── Relationships ─────────────────────────────────────────────────────────────
async function seedRelationships() {
  // ── Othniel ───────────────────────────────────────────────────────────
  await insertRelByName("Caleb", "sibling_of", "Othniel", "Othniel is son of Kenaz, Caleb's brother (Josh 15:17)");
  await insertRelByName("Achsah", "spouse_of", "Othniel", "Othniel won Achsah by capturing Debir (Josh 15:17)");
  await insertRel("othniel", "enemy_of", "cushan", "Othniel delivered Israel from Cushan-rishathaim (Judg 3:10)");

  // ── Ehud / Eglon ──────────────────────────────────────────────────────
  await insertRel("ehud", "enemy_of", "eglon", "Ehud killed Eglon with a concealed sword (Judg 3:21)");

  // ── Deborah / Barak / Sisera / Jabin ──────────────────────────────────
  await insertRel("deborah", "mentor_of", "barak", "Deborah summoned and commissioned Barak (Judg 4:6)");
  await insertRel("sisera", "servant_of", "jabin",  "Sisera commanded Jabin's army (Judg 4:2)");
  await insertRel("barak",  "enemy_of",   "sisera", "Barak routed Sisera's forces at Kishon (Judg 4:15)");
  await insertRel("jael",   "enemy_of",   "sisera", "Jael killed Sisera with a tent peg (Judg 4:21)");
  await insertRel("jael",   "spouse_of",  "heber",  "Jael wife of Heber the Kenite (Judg 4:17)");
  await insertRelNameToLocal("Hobab", "ancestor_of", "heber", "Heber is a descendant of Hobab/Jethro (Judg 4:11)");

  // ── Gideon / family ───────────────────────────────────────────────────
  await insertRel("joash_gideon", "parent_of", "gideon",    "Gideon son of Joash the Abiezrite (Judg 6:11)");
  await insertRel("gideon", "parent_of", "abimelech", "Abimelech is Gideon's son by Shechemite concubine (Judg 8:31)");
  await insertRel("gideon", "parent_of", "jotham",   "Jotham is Gideon's youngest son (Judg 9:5)");
  await insertRel("gideon", "enemy_of",  "zebah",    "Gideon pursued and killed Zebah (Judg 8:21)");
  await insertRel("gideon", "enemy_of",  "zalmunna", "Gideon executed Zalmunna (Judg 8:21)");
  await insertRel("abimelech", "enemy_of", "jotham", "Abimelech killed 70 brothers; Jotham alone escaped (Judg 9:5)");
  await insertRelNameToLocal("Manasseh", "ancestor_of", "gideon", "Gideon from tribe of Manasseh, clan of Abiezer (Judg 6:15)");

  // ── Jephthah ──────────────────────────────────────────────────────────
  await insertRel("jephthah", "parent_of",  "jephthah_daughter", "Only child; subject of the vow (Judg 11:34)");
  await insertRelNameToLocal("Gad", "ancestor_of", "jephthah", "Jephthah is from Gilead in Transjordan (Judg 11:1)");

  // ── Samson ────────────────────────────────────────────────────────────
  await insertRel("manoah",  "parent_of", "samson", "Manoah father of Samson (Judg 13:24)");
  await insertRel("delilah", "enemy_of",  "samson", "Delilah betrayed Samson to the Philistines (Judg 16:18)");
  await insertRelNameToLocal("Dan", "ancestor_of", "samson", "Samson is a Danite from Zorah (Judg 13:2)");
  await insertRelNameToLocal("Dan", "ancestor_of", "manoah", "Manoah is a Danite from Zorah (Judg 13:2)");
}

// ── Scripture references ───────────────────────────────────────────────────────
async function seedRefs() {
  // ── Othniel ───────────────────────────────────────────────────────────
  await insertRef("othniel", "Joshua",  15, 17, 15, 17, "Captures Debir; receives Achsah as wife");
  await insertRef("othniel", "Judges",   3,  7,  3, 11, "First judge; delivers Israel from Cushan-rishathaim");
  await insertRef("cushan",  "Judges",   3,  8,  3, 10, "Oppressor of Israel for eight years");

  // ── Ehud ──────────────────────────────────────────────────────────────
  await insertRef("ehud",   "Judges",   3, 12, 3, 30, "Left-handed judge; kills Eglon; leads rout of Moab");
  await insertRef("eglon",  "Judges",   3, 12, 3, 25, "Fat king of Moab; killed by Ehud in his upper room");

  // ── Shamgar ───────────────────────────────────────────────────────────
  await insertRef("shamgar", "Judges",  3, 31, 3, 31, "Kills 600 Philistines with an oxgoad");

  // ── Deborah, Barak, Sisera, Jabin, Jael, Heber ───────────────────────
  await insertRef("deborah", "Judges",  4,  4,  5, 31, "Prophetess and judge; Song of Deborah");
  await insertRef("barak",   "Judges",  4,  6,  5, 15, "Leads ten thousand to defeat Sisera; named in Heb 11");
  await insertRef("sisera",  "Judges",  4,  2,  5, 30, "Army commander; nine hundred iron chariots; killed by Jael");
  await insertRef("jabin",   "Judges",  4,  2,  4, 24, "Canaanite king at Hazor; oppressed Israel twenty years");
  await insertRef("jael",    "Judges",  4, 17,  5, 27, "Kills Sisera with tent peg; blessed in Deborah's song");
  await insertRef("heber",   "Judges",  4, 11,  4, 17, "Kenite whose clan camped near Kedesh; wife kills Sisera");

  // ── Gideon ────────────────────────────────────────────────────────────
  await insertRef("gideon",      "Judges",  6,  1,  8, 35, "Called by God; fleece; 300 warriors; defeats Midian");
  await insertRef("joash_gideon","Judges",  6, 11,  6, 32, "Father of Gideon; defends him after Baal altar torn down");
  await insertRef("zebah",       "Judges",  8,  5,  8, 21, "Midianite king captured and killed by Gideon");
  await insertRef("zalmunna",    "Judges",  8,  5,  8, 21, "Midianite co-king captured and killed by Gideon");
  await insertRef("abimelech",   "Judges",  9,  1,  9, 57, "Kills 70 brothers; rules Shechem; killed by a millstone");
  await insertRef("jotham",      "Judges",  9,  5,  9, 21, "Survives massacre; delivers Parable of the Trees");

  // ── Jephthah ──────────────────────────────────────────────────────────
  await insertRef("jephthah",          "Judges", 11,  1, 12, 15, "Judge; rash vow; defeats Ammon; Shibboleth test");
  await insertRef("jephthah_daughter", "Judges", 11, 34, 11, 40, "Subject of Jephthah's vow; mourned by daughters of Israel");

  // ── Samson ────────────────────────────────────────────────────────────
  await insertRef("manoah",  "Judges", 13,  2, 13, 25, "Receives angelic announcement of Samson's birth");
  await insertRef("samson",  "Judges", 13, 24, 16, 31, "Nazirite judge; foxes; jawbone; Gaza gates; Delilah; Dagon's temple");
  await insertRef("delilah", "Judges", 16,  4, 16, 22, "Betrays Samson to the Philistines for silver");
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Seeding Judges people...");
  await seedPeople();
  console.log("Seeding Judges relationships...");
  await seedRelationships();
  console.log("Seeding Judges scripture references...");
  await seedRefs();

  const pc = await db.execute("SELECT COUNT(*) as c FROM people");
  const rc = await db.execute("SELECT COUNT(*) as c FROM relationships");
  const sc = await db.execute("SELECT COUNT(*) as c FROM scripture_refs");
  console.log(`\n✓ Judges seed complete.`);
  console.log(`  Total people now: ${(pc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total relationships now: ${(rc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total scripture refs now: ${(sc.rows[0] as unknown as { c: number }).c}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
