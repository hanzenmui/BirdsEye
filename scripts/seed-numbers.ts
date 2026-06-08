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

// Checks DB by name before inserting. If found, maps existing id — no duplicate.
async function safeInsertPerson(p: {
  key: string; name: string; alsoKnownAs?: string; gender: string;
  description: string; tags: string[];
}): Promise<void> {
  const existing = await db.execute({
    sql: "SELECT id FROM people WHERE name = ? LIMIT 1",
    args: [p.name],
  });
  const row = existing.rows[0] as unknown as { id: string } | undefined;
  if (row) {
    ids[p.key] = row.id;
    names[p.key] = p.name;
    return;
  }
  names[p.key] = p.name;
  await db.execute({
    sql: `INSERT OR IGNORE INTO people (id,name,also_known_as,gender,testament,birth_year,death_year,description,tags,created_at)
          VALUES (?,?,?,?,'OT','','',?,?,datetime('now'))`,
    args: [id(p.key), p.name, p.alsoKnownAs ?? '', p.gender, p.description, JSON.stringify(p.tags)],
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

async function insertRelByName(aName: string, type: string, bName: string, notes?: string) {
  const aRow = await db.execute({ sql: "SELECT id FROM people WHERE name = ? LIMIT 1", args: [aName] });
  const bRow = await db.execute({ sql: "SELECT id FROM people WHERE name = ? LIMIT 1", args: [bName] });
  const aId = (aRow.rows[0] as unknown as { id: string } | undefined)?.id;
  const bId = (bRow.rows[0] as unknown as { id: string } | undefined)?.id;
  if (!aId || !bId) {
    console.warn(`  ⚠ Could not link ${aName} → ${bName} (one not found)`);
    return;
  }
  await db.execute({
    sql: `INSERT OR IGNORE INTO relationships (id,person_a_id,person_a_name,type,person_b_id,person_b_name,notes,created_at)
          VALUES (?,?,?,?,?,?,?,datetime('now'))`,
    args: [crypto.randomUUID(), aId, aName, type, bId, bName, notes ?? ''],
  });
}

// Links an ancestor by DB name-lookup to a locally-tracked person by key.
// Used for tribe → prince links where the prince key is unambiguous but their
// name alone (e.g. "Eliab") could collide with another DB entry.
async function insertRelNameToLocal(aName: string, type: string, bKey: string, notes?: string) {
  const aRow = await db.execute({ sql: "SELECT id FROM people WHERE name = ? LIMIT 1", args: [aName] });
  const aId = (aRow.rows[0] as unknown as { id: string } | undefined)?.id;
  if (!aId) {
    console.warn(`  ⚠ Could not find ${aName} for link to ${bKey}`);
    return;
  }
  await db.execute({
    sql: `INSERT OR IGNORE INTO relationships (id,person_a_id,person_a_name,type,person_b_id,person_b_name,notes,created_at)
          VALUES (?,?,?,?,?,?,?,datetime('now'))`,
    args: [crypto.randomUUID(), aId, aName, type, id(bKey), names[bKey] ?? bKey, notes ?? ''],
  });
}

// ── People ────────────────────────────────────────────────────────────────────
async function seedPeople() {
  // ── Twelve tribal princes (Num 1, 2, 7, 10) ──────────────────────────
  await safeInsertPerson({ key: "nahshon", name: "Nahshon", alsoKnownAs: "Nahshon son of Amminadab",
    gender: "male",
    description: "Son of Amminadab, prince of the tribe of Judah. Led Judah's regiment in the first census. Presented the first offering at the tabernacle dedication. His sister Elisheba married Aaron. Ancestor of Boaz and King David.",
    tags: ["leader", "tribe of israel", "messianic line"] });

  await safeInsertPerson({ key: "nethanel", name: "Nethanel", alsoKnownAs: "Nethanel son of Zuar",
    gender: "male",
    description: "Son of Zuar, prince of the tribe of Issachar. Led his tribe's census count and presented offerings at the tabernacle dedication on the second day.",
    tags: ["leader", "tribe of israel"] });

  await safeInsertPerson({ key: "eliab_helon", name: "Eliab", alsoKnownAs: "Eliab son of Helon",
    gender: "male",
    description: "Son of Helon, prince of the tribe of Zebulun. Led his tribe's census count and presented offerings at the tabernacle dedication on the third day.",
    tags: ["leader", "tribe of israel"] });

  await safeInsertPerson({ key: "elizur", name: "Elizur", alsoKnownAs: "Elizur son of Shedeur",
    gender: "male",
    description: "Son of Shedeur, prince of the tribe of Reuben. Led his tribe's census count and presented offerings at the tabernacle dedication on the fourth day.",
    tags: ["leader", "tribe of israel"] });

  await safeInsertPerson({ key: "shelumiel", name: "Shelumiel", alsoKnownAs: "Shelumiel son of Zurishaddai",
    gender: "male",
    description: "Son of Zurishaddai, prince of the tribe of Simeon. Led his tribe's census count and presented offerings at the tabernacle dedication on the fifth day.",
    tags: ["leader", "tribe of israel"] });

  await safeInsertPerson({ key: "eliasaph", name: "Eliasaph", alsoKnownAs: "Eliasaph son of Deuel",
    gender: "male",
    description: "Son of Deuel (also written Reuel), prince of the tribe of Gad. Led his tribe's census count and presented offerings at the tabernacle dedication on the sixth day.",
    tags: ["leader", "tribe of israel"] });

  await safeInsertPerson({ key: "elishama", name: "Elishama", alsoKnownAs: "Elishama son of Ammihud",
    gender: "male",
    description: "Son of Ammihud, prince of the tribe of Ephraim. Led his tribe's census count and presented offerings at the tabernacle dedication on the seventh day.",
    tags: ["leader", "tribe of israel"] });

  await safeInsertPerson({ key: "gamaliel", name: "Gamaliel", alsoKnownAs: "Gamaliel son of Pedahzur",
    gender: "male",
    description: "Son of Pedahzur, prince of the tribe of Manasseh. Led his tribe's census count and presented offerings at the tabernacle dedication on the eighth day.",
    tags: ["leader", "tribe of israel"] });

  await safeInsertPerson({ key: "abidan", name: "Abidan", alsoKnownAs: "Abidan son of Gideoni",
    gender: "male",
    description: "Son of Gideoni, prince of the tribe of Benjamin. Led his tribe's census count and presented offerings at the tabernacle dedication on the ninth day.",
    tags: ["leader", "tribe of israel"] });

  await safeInsertPerson({ key: "ahiezer", name: "Ahiezer", alsoKnownAs: "Ahiezer son of Ammishaddai",
    gender: "male",
    description: "Son of Ammishaddai, prince of the tribe of Dan. Led his tribe's census count and presented offerings at the tabernacle dedication on the tenth day.",
    tags: ["leader", "tribe of israel"] });

  await safeInsertPerson({ key: "pagiel", name: "Pagiel", alsoKnownAs: "Pagiel son of Ocran",
    gender: "male",
    description: "Son of Ocran, prince of the tribe of Asher. Led his tribe's census count and presented offerings at the tabernacle dedication on the eleventh day.",
    tags: ["leader", "tribe of israel"] });

  await safeInsertPerson({ key: "ahira", name: "Ahira", alsoKnownAs: "Ahira son of Enan",
    gender: "male",
    description: "Son of Enan, prince of the tribe of Naphtali. Led his tribe's census count and presented the final offering at the tabernacle dedication on the twelfth day.",
    tags: ["leader", "tribe of israel"] });

  // ── Levitical clan heads (Num 3–4) ────────────────────────────────────
  await safeInsertPerson({ key: "gershon", name: "Gershon", alsoKnownAs: "Gershom son of Levi",
    gender: "male",
    description: "Eldest son of Levi. His clan was responsible for carrying the tabernacle coverings, curtains, and hangings during the wilderness march. They camped on the west side of the tabernacle under the supervision of Ithamar son of Aaron.",
    tags: ["priestly line"] });

  await safeInsertPerson({ key: "merari", name: "Merari",
    gender: "male",
    description: "Youngest son of Levi. His clan carried the structural elements of the tabernacle — the frames, crossbars, posts, and bases — and were given wagons and oxen for the task. They camped on the north side.",
    tags: ["priestly line"] });

  await safeInsertPerson({ key: "izhar", name: "Izhar",
    gender: "male",
    description: "Son of Kohath, grandson of Levi. Father of Korah, Nepheg, and Zichri. Part of the inner Kohathite clan entrusted with the most sacred tabernacle objects. His son Korah's rebellion brought devastating judgment on his line.",
    tags: ["priestly line"] });

  // ── Korah's rebellion (Num 16–17) ─────────────────────────────────────
  await safeInsertPerson({ key: "korah", name: "Korah",
    gender: "male",
    description: "Son of Izhar, grandson of Kohath, a Levite. Led a coalition of 250 community leaders against Moses and Aaron, claiming all the congregation was equally holy and questioning their exclusive authority. The earth opened and swallowed Korah and his household; fire consumed the 250 who offered incense. His sons, however, survived — their descendants became celebrated Temple musicians and wrote several Psalms.",
    tags: ["priestly line", "antagonist"] });

  await safeInsertPerson({ key: "dathan", name: "Dathan",
    gender: "male",
    description: "Son of Eliab, a Reubenite. Joined Korah's rebellion against Moses, accusing him of failing to bring Israel into the Promised Land and of making himself a prince over them. Refused to appear before Moses. Swallowed by the earth along with his household when the ground split open.",
    tags: ["antagonist"] });

  await safeInsertPerson({ key: "abiram", name: "Abiram",
    gender: "male",
    description: "Son of Eliab, a Reubenite, brother of Dathan. Co-conspirator with Dathan and Korah. Sent a defiant reply when Moses summoned him. Swallowed by the earth along with his household.",
    tags: ["antagonist"] });

  // ── Balaam narrative (Num 22–24) ──────────────────────────────────────
  await safeInsertPerson({ key: "balak", name: "Balak",
    gender: "male",
    description: "Son of Zippor, king of Moab. Terrified by Israel's advance through Transjordan, he sent delegations to hire the diviner Balaam to curse them. Despite three attempts from three different hilltops, God turned every curse into a blessing. His plan failed entirely, and Balaam's final oracle foretold the destruction of Moab.",
    tags: ["king", "antagonist", "moabite"] });

  await safeInsertPerson({ key: "balaam", name: "Balaam", alsoKnownAs: "Balaam son of Beor",
    gender: "male",
    description: "Son of Beor, a pagan diviner from Pethor. Hired by Balak of Moab to curse Israel, but God put only words of blessing in his mouth. His donkey saw the angel of the Lord blocking the road and spoke to him before he did. Delivered four oracles including the messianic prophecy: 'A star will come out of Jacob; a scepter will rise out of Israel.' Later blamed in Numbers 31 for advising Midian to seduce Israel into the Baal Peor apostasy.",
    tags: ["prophet", "antagonist"] });

  // ── Peor incident (Num 25) ────────────────────────────────────────────
  await safeInsertPerson({ key: "zimri", name: "Zimri", alsoKnownAs: "Zimri son of Salu",
    gender: "male",
    description: "Son of Salu, a leader in the tribe of Simeon. During the plague at Peor, while Israel was weeping at the entrance of the tent of meeting, he brazenly brought a Midianite woman into the camp in full view of Moses and the entire assembly. Killed by Phinehas with a spear, piercing both of them. His act and its consequences ended a plague that had already claimed 24,000 lives.",
    tags: ["antagonist"] });

  await safeInsertPerson({ key: "cozbi", name: "Cozbi", alsoKnownAs: "Cozbi daughter of Zur",
    gender: "female",
    description: "Daughter of Zur, a Midianite chieftain and one of the five Midianite kings. Brought into the Israelite camp by Zimri son of Salu during the Peor plague. Killed alongside Zimri by Phinehas. Her death and Phinehas's zeal ended the plague.",
    tags: ["midianite", "antagonist"] });

  // ── Zelophehad and his daughters (Num 27, 36) ─────────────────────────
  await safeInsertPerson({ key: "zelophehad", name: "Zelophehad",
    gender: "male",
    description: "Son of Hepher, from the clan of Gilead, tribe of Manasseh. Died in the wilderness having committed no crime other than being part of Korah's generation — and leaving only daughters, no sons. His five daughters petitioned Moses for his inheritance, and God ruled in their favor, establishing the legal precedent that daughters may inherit when there are no male heirs.",
    tags: ["tribe of israel"] });

  await safeInsertPerson({ key: "mahlah", name: "Mahlah", alsoKnownAs: "Mahlah daughter of Zelophehad",
    gender: "female",
    description: "Eldest daughter of Zelophehad. She and her four sisters successfully petitioned Moses and Eleazar for their father's inheritance. God confirmed their case as just. Later commanded to marry within their tribe so the land would not pass to another tribe.",
    tags: ["tribe of israel"] });

  await safeInsertPerson({ key: "noah_z", name: "Noah", alsoKnownAs: "Noah daughter of Zelophehad",
    gender: "female",
    description: "Daughter of Zelophehad. One of five sisters who petitioned for their father's inheritance with no male heir. Not to be confused with Noah the patriarch. God ruled in their favor and their case became binding law in Israel.",
    tags: ["tribe of israel"] });

  await safeInsertPerson({ key: "hoglah", name: "Hoglah", alsoKnownAs: "Hoglah daughter of Zelophehad",
    gender: "female",
    description: "Daughter of Zelophehad. One of five sisters whose successful petition established the right of daughters to inherit when there are no sons.",
    tags: ["tribe of israel"] });

  await safeInsertPerson({ key: "milcah_z", name: "Milcah", alsoKnownAs: "Milcah daughter of Zelophehad",
    gender: "female",
    description: "Daughter of Zelophehad. One of five sisters whose inheritance case became landmark law. Not to be confused with Milcah wife of Nahor (Abraham's brother). Her tribe later required her to marry within Manasseh to keep the land allotment.",
    tags: ["tribe of israel"] });

  await safeInsertPerson({ key: "tirzah_z", name: "Tirzah", alsoKnownAs: "Tirzah daughter of Zelophehad",
    gender: "female",
    description: "Youngest daughter of Zelophehad. One of five sisters whose petition changed Israelite inheritance law. Her name was later given to a prominent Canaanite city that became the first capital of the northern kingdom.",
    tags: ["tribe of israel"] });
}

// ── Relationships ──────────────────────────────────────────────────────────────
async function seedRelationships() {
  // ── Levitical chain ───────────────────────────────────────────────────
  await insertRelByName("Levi", "parent_of", "Gershon");
  await insertRelByName("Levi", "parent_of", "Merari");
  await insertRelByName("Kohath", "parent_of", "Izhar");
  await insertRel("izhar", "parent_of", "korah");

  // ── Korah rebellion ───────────────────────────────────────────────────
  await insertRelByName("Korah", "adversary_of", "Moses", "Led rebellion against Moses and Aaron (Num 16)");
  await insertRelByName("Dathan", "adversary_of", "Moses", "Joined Korah's rebellion (Num 16)");
  await insertRelByName("Abiram", "adversary_of", "Moses", "Joined Korah's rebellion (Num 16)");

  // ── Balaam / Balak ────────────────────────────────────────────────────
  await insertRel("balak", "ally_of", "balaam", "Balak hired Balaam to curse Israel (Num 22)");
  await insertRelByName("Balak", "adversary_of", "Moses", "Attempted to curse Israel through Balaam");
  await insertRelByName("Balaam", "adversary_of", "Moses", "Later blamed for advising Midian at Peor (Num 31:16)");

  // ── Phinehas / Peor ───────────────────────────────────────────────────
  await insertRelByName("Phinehas", "adversary_of", "Zimri", "Phinehas killed Zimri and Cozbi, ending the plague (Num 25:7)");
  await insertRel("zimri", "ally_of", "cozbi", "Brought Cozbi into the camp at Peor (Num 25:6)");

  // ── Zelophehad daughters ──────────────────────────────────────────────
  await insertRel("zelophehad", "parent_of", "mahlah");
  await insertRel("zelophehad", "parent_of", "noah_z");
  await insertRel("zelophehad", "parent_of", "hoglah");
  await insertRel("zelophehad", "parent_of", "milcah_z");
  await insertRel("zelophehad", "parent_of", "tirzah_z");

  // ── Tribal princes → tribe ancestors ─────────────────────────────────
  // insertRelNameToLocal used here: looks up tribe patriarch by name (unambiguous),
  // uses local key for the prince (avoids name collisions like "Eliab").
  await insertRelNameToLocal("Judah",    "ancestor_of", "nahshon",    "Nahshon is prince of Judah (Num 1:7)");
  await insertRelNameToLocal("Issachar", "ancestor_of", "nethanel",   "Nethanel is prince of Issachar (Num 1:8)");
  await insertRelNameToLocal("Zebulun",  "ancestor_of", "eliab_helon","Eliab son of Helon is prince of Zebulun (Num 1:9)");
  await insertRelNameToLocal("Reuben",   "ancestor_of", "elizur",     "Elizur is prince of Reuben (Num 1:5)");
  await insertRelNameToLocal("Simeon",   "ancestor_of", "shelumiel",  "Shelumiel is prince of Simeon (Num 1:6)");
  await insertRelNameToLocal("Gad",      "ancestor_of", "eliasaph",   "Eliasaph is prince of Gad (Num 1:14)");
  await insertRelNameToLocal("Ephraim",  "ancestor_of", "elishama",   "Elishama is prince of Ephraim (Num 1:10)");
  await insertRelNameToLocal("Manasseh", "ancestor_of", "gamaliel",   "Gamaliel is prince of Manasseh (Num 1:10)");
  await insertRelNameToLocal("Benjamin", "ancestor_of", "abidan",     "Abidan is prince of Benjamin (Num 1:11)");
  await insertRelNameToLocal("Dan",      "ancestor_of", "ahiezer",    "Ahiezer is prince of Dan (Num 1:12)");
  await insertRelNameToLocal("Asher",    "ancestor_of", "pagiel",     "Pagiel is prince of Asher (Num 1:13)");
  await insertRelNameToLocal("Naphtali", "ancestor_of", "ahira",      "Ahira is prince of Naphtali (Num 1:15)");

  // Nahshon ↔ Elisheba (Aaron's wife is Nahshon's sister, Exod 6:23)
  await insertRelByName("Nahshon", "sibling_of", "Elisheba", "Elisheba is Nahshon's sister (Exod 6:23)");

  // Zelophehad → Manasseh ancestor link
  await insertRelNameToLocal("Manasseh", "ancestor_of", "zelophehad", "Zelophehad is from the clan of Manasseh (Num 27:1)");
}

// ── Scripture references ───────────────────────────────────────────────────────
async function seedRefs() {
  // ── Twelve princes — census appointment (Num 1) ───────────────────────
  await insertRef("elizur",     "Numbers", 1,  5,  1,  5, "Appointed prince of Reuben");
  await insertRef("shelumiel",  "Numbers", 1,  6,  1,  6, "Appointed prince of Simeon");
  await insertRef("nahshon",    "Numbers", 1,  7,  1,  7, "Appointed prince of Judah");
  await insertRef("nethanel",   "Numbers", 1,  8,  1,  8, "Appointed prince of Issachar");
  await insertRef("eliab_helon","Numbers", 1,  9,  1,  9, "Appointed prince of Zebulun");
  await insertRef("elishama",   "Numbers", 1, 10,  1, 10, "Appointed prince of Ephraim");
  await insertRef("gamaliel",   "Numbers", 1, 10,  1, 10, "Appointed prince of Manasseh");
  await insertRef("abidan",     "Numbers", 1, 11,  1, 11, "Appointed prince of Benjamin");
  await insertRef("ahiezer",    "Numbers", 1, 12,  1, 12, "Appointed prince of Dan");
  await insertRef("pagiel",     "Numbers", 1, 13,  1, 13, "Appointed prince of Asher");
  await insertRef("eliasaph",   "Numbers", 1, 14,  1, 14, "Appointed prince of Gad");
  await insertRef("ahira",      "Numbers", 1, 15,  1, 15, "Appointed prince of Naphtali");

  // ── Twelve princes — tabernacle dedication offerings (Num 7) ──────────
  await insertRef("nahshon",    "Numbers", 7, 12, 7, 17, "First offering at tabernacle dedication");
  await insertRef("nethanel",   "Numbers", 7, 18, 7, 23, "Second offering");
  await insertRef("eliab_helon","Numbers", 7, 24, 7, 29, "Third offering");
  await insertRef("elizur",     "Numbers", 7, 30, 7, 35, "Fourth offering");
  await insertRef("shelumiel",  "Numbers", 7, 36, 7, 41, "Fifth offering");
  await insertRef("eliasaph",   "Numbers", 7, 42, 7, 47, "Sixth offering");
  await insertRef("elishama",   "Numbers", 7, 48, 7, 53, "Seventh offering");
  await insertRef("gamaliel",   "Numbers", 7, 54, 7, 59, "Eighth offering");
  await insertRef("abidan",     "Numbers", 7, 60, 7, 65, "Ninth offering");
  await insertRef("ahiezer",    "Numbers", 7, 66, 7, 71, "Tenth offering");
  await insertRef("pagiel",     "Numbers", 7, 72, 7, 77, "Eleventh offering");
  await insertRef("ahira",      "Numbers", 7, 78, 7, 83, "Twelfth offering");

  // ── Levitical clan heads ───────────────────────────────────────────────
  await insertRef("gershon", "Numbers",  3, 21, 3, 26, "Clan duties: coverings and curtains");
  await insertRef("gershon", "Numbers",  4, 22, 4, 28, "Census of Gershonites");
  await insertRef("merari",  "Numbers",  3, 33, 3, 37, "Clan duties: frames and bases");
  await insertRef("merari",  "Numbers",  4, 29, 4, 33, "Census of Merarites");
  await insertRef("izhar",   "Numbers", 16,  1, 16,  1, "Father of Korah");

  // ── Korah's rebellion ─────────────────────────────────────────────────
  await insertRef("korah",  "Numbers", 16,  1, 16, 35, "Rebellion and judgment");
  await insertRef("korah",  "Numbers", 26, 10, 26, 11, "Second census: Korah's rebellion recalled");
  await insertRef("dathan", "Numbers", 16,  1, 16, 35, "Co-rebel with Korah; swallowed by the earth");
  await insertRef("abiram", "Numbers", 16,  1, 16, 35, "Co-rebel with Korah; swallowed by the earth");

  // ── Balaam and Balak ──────────────────────────────────────────────────
  await insertRef("balak",  "Numbers", 22,  2, 24, 25, "Hires Balaam; three failed attempts to curse Israel");
  await insertRef("balaam", "Numbers", 22,  2, 24, 25, "Four oracles; speaking donkey; messianic prophecy");
  await insertRef("balaam", "Numbers", 31, 16, 31, 16, "Credited with advising Midian to seduce Israel at Peor");

  // ── Peor incident ─────────────────────────────────────────────────────
  await insertRef("zimri", "Numbers", 25,  6, 25, 15, "Killed by Phinehas; ends the Peor plague");
  await insertRef("cozbi", "Numbers", 25,  6, 25, 18, "Midianite woman killed by Phinehas alongside Zimri");

  // ── Zelophehad and daughters ──────────────────────────────────────────
  await insertRef("zelophehad", "Numbers", 27,  1, 27, 11, "No male heir; daughters' petition");
  await insertRef("zelophehad", "Numbers", 36,  1, 36, 12, "Daughters must marry within tribe");
  await insertRef("mahlah",   "Numbers", 27,  1, 27, 11, "Petitions Moses for father's inheritance");
  await insertRef("mahlah",   "Numbers", 36,  1, 36, 12, "Required to marry within Manasseh");
  await insertRef("noah_z",   "Numbers", 27,  1, 27, 11);
  await insertRef("noah_z",   "Numbers", 36,  1, 36, 12);
  await insertRef("hoglah",   "Numbers", 27,  1, 27, 11);
  await insertRef("hoglah",   "Numbers", 36,  1, 36, 12);
  await insertRef("milcah_z", "Numbers", 27,  1, 27, 11);
  await insertRef("milcah_z", "Numbers", 36,  1, 36, 12);
  await insertRef("tirzah_z", "Numbers", 27,  1, 27, 11);
  await insertRef("tirzah_z", "Numbers", 36,  1, 36, 12);
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Seeding Numbers people...");
  await seedPeople();
  console.log("Seeding Numbers relationships...");
  await seedRelationships();
  console.log("Seeding Numbers scripture references...");
  await seedRefs();

  const pc = await db.execute("SELECT COUNT(*) as c FROM people");
  const rc = await db.execute("SELECT COUNT(*) as c FROM relationships");
  const sc = await db.execute("SELECT COUNT(*) as c FROM scripture_refs");
  console.log(`\n✓ Numbers seed complete.`);
  console.log(`  Total people now: ${(pc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total relationships now: ${(rc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total scripture refs now: ${(sc.rows[0] as unknown as { c: number }).c}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
