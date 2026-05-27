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

async function insertPerson(p: {
  key: string; name: string; alsoKnownAs?: string; gender: string;
  description: string; tags: string[];
}) {
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

// ── Load existing Genesis IDs so we can link to them ─────────────────────────
// These keys must match what seed-genesis.ts used exactly.
function genesis(key: string, name: string) {
  names[key] = name;
  // id() will create a fresh UUID — we need the real one from the DB
  // We'll resolve them after inserting via name lookup in insertRel
}

async function loadGenesisIds() {
  const rows = await db.execute("SELECT id, name, also_known_as FROM people");
  for (const r of rows.rows as { id: string; name: string; also_known_as: string }[]) {
    // Map by lowercase name and also_known_as
    const key = r.name.toLowerCase().replace(/\s+/g, "_");
    ids[key] = r.id;
    names[key] = r.name;
  }
}

// Better: load by name lookup at relationship time
async function getPersonId(name: string): Promise<string | null> {
  const row = await db.execute({
    sql: "SELECT id FROM people WHERE name = ? OR also_known_as LIKE ? LIMIT 1",
    args: [name, `%${name}%`],
  });
  return (row.rows[0] as { id: string } | undefined)?.id ?? null;
}

// For cross-book relationships, link by name
async function insertRelByName(aName: string, type: string, bName: string, notes?: string) {
  const aId = await getPersonId(aName);
  const bId = await getPersonId(bName);
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

// ── People ────────────────────────────────────────────────────────────────────
async function seedPeople() {
  // ── Levi's descendants ────────────────────────────────────────────────
  await insertPerson({ key: "kohath", name: "Kohath", gender: "male",
    description: "Son of Levi, grandson of Jacob. Father of Amram, Izhar, Hebron, and Uzziel. Ancestor of Moses and Aaron. His clan was entrusted with the most holy objects of the tabernacle.",
    tags: ["priestly line"] });

  await insertPerson({ key: "amram", name: "Amram", gender: "male",
    description: "Son of Kohath, grandson of Levi. Married his aunt Jochebed. Father of Miriam, Aaron, and Moses. Lived 137 years.",
    tags: ["priestly line"] });

  await insertPerson({ key: "jochebed", name: "Jochebed", gender: "female",
    description: "Daughter of Levi (Amram's aunt). Mother of Moses, Aaron, and Miriam. Placed the infant Moses in a basket among the Nile reeds to save him from Pharaoh's decree. Later hired by Pharaoh's daughter to nurse the child — her own son.",
    tags: ["matriarch", "priestly line"] });

  // ── Moses, Aaron, Miriam ──────────────────────────────────────────────
  await insertPerson({ key: "miriam", name: "Miriam", gender: "female",
    description: "Daughter of Amram and Jochebed, older sister of Moses and Aaron. Watched over the infant Moses at the Nile. Led the women of Israel in song after crossing the Red Sea. Later challenged Moses' authority and was struck with leprosy, then healed after Moses' intercession. Died at Kadesh.",
    tags: ["prophetess", "leader"] });

  await insertPerson({ key: "aaron", name: "Aaron", gender: "male",
    description: "Son of Amram and Jochebed, older brother of Moses. Served as Moses' spokesman before Pharaoh. Became the first High Priest of Israel. Made the golden calf when Moses was on Sinai. His descendants formed the Aaronic priesthood. Died on Mount Hor before entering Canaan.",
    tags: ["high priest", "priestly line", "leader"] });

  await insertPerson({ key: "moses", name: "Moses", gender: "male",
    description: "Son of Amram and Jochebed. Placed in a basket on the Nile as an infant, found and raised by Pharaoh's daughter. Fled to Midian after killing an Egyptian. Called by God at the burning bush to lead Israel out of Egypt. Delivered the Ten Plagues. Led the Exodus and received the Law at Sinai. Died on Mount Nebo after 40 years of leading Israel through the wilderness, never entering the Promised Land.",
    tags: ["prophet", "leader", "lawgiver"] });

  // ── Moses' family ─────────────────────────────────────────────────────
  await insertPerson({ key: "jethro", name: "Jethro", alsoKnownAs: "Reuel, Hobab",
    gender: "male",
    description: "Priest of Midian and father-in-law of Moses. Moses fled to his household after killing the Egyptian. Gave Moses his daughter Zipporah in marriage. Later visited the Israelite camp and advised Moses to delegate judicial authority — one of the Bible's earliest organizational leadership principles.",
    tags: ["midianite", "priest"] });

  await insertPerson({ key: "zipporah", name: "Zipporah", gender: "female",
    description: "Daughter of Jethro, wife of Moses. Circumcised her son with a flint knife to avert God's wrath against Moses on the road back to Egypt. Sent back to her father during the wilderness journey, then reunited with Moses at Sinai.",
    tags: ["midianite", "matriarch"] });

  await insertPerson({ key: "gershom", name: "Gershom", gender: "male",
    description: "Firstborn son of Moses and Zipporah. His name means 'a foreigner there,' given because Moses was a foreigner in Midian. His descendants appear later as priests in the period of the judges.",
    tags: [] });

  await insertPerson({ key: "eliezer_moses", name: "Eliezer", alsoKnownAs: "Eliezer son of Moses",
    gender: "male",
    description: "Second son of Moses and Zipporah. Named 'My God is help' because God delivered Moses from Pharaoh.",
    tags: [] });

  // ── Pharaoh's household ───────────────────────────────────────────────
  await insertPerson({ key: "pharaohs_daughter", name: "Pharaoh's Daughter", gender: "female",
    description: "The unnamed daughter of Pharaoh who found the infant Moses in a basket among the reeds of the Nile. She recognized him as a Hebrew child but took pity on him and raised him as her own son. Without her act of compassion, the Exodus story could not have happened.",
    tags: ["egyptian", "royalty"] });

  // ── Aaron's family ────────────────────────────────────────────────────
  await insertPerson({ key: "elisheba", name: "Elisheba", gender: "female",
    description: "Daughter of Amminadab, sister of Nahshon. Wife of Aaron. Mother of Nadab, Abihu, Eleazar, and Ithamar.",
    tags: ["matriarch", "priestly line"] });

  await insertPerson({ key: "nadab", name: "Nadab", gender: "male",
    description: "Eldest son of Aaron and Elisheba. One of four sons consecrated as priests. He and his brother Abihu offered 'strange fire' before the Lord and were consumed by divine fire. Died childless.",
    tags: ["priest", "priestly line"] });

  await insertPerson({ key: "abihu", name: "Abihu", gender: "male",
    description: "Second son of Aaron and Elisheba. With his brother Nadab, offered unauthorized fire before the Lord and was consumed. Died childless.",
    tags: ["priest", "priestly line"] });

  await insertPerson({ key: "eleazar", name: "Eleazar", gender: "male",
    description: "Third son of Aaron. Succeeded his father as High Priest after Aaron's death on Mount Hor. Helped supervise the census and the allotment of the land under Joshua. Ancestor of Ezra and of Zadok.",
    tags: ["high priest", "priestly line"] });

  await insertPerson({ key: "ithamar", name: "Ithamar", gender: "male",
    description: "Youngest son of Aaron and Elisheba. Supervised the construction materials for the tabernacle. His descendants included the High Priest Eli and Samuel's contemporary Abiathar.",
    tags: ["priest", "priestly line"] });

  await insertPerson({ key: "phinehas_aaron", name: "Phinehas", alsoKnownAs: "Phinehas son of Eleazar",
    gender: "male",
    description: "Son of Eleazar, grandson of Aaron. Became High Priest after his father. Famous for zealously executing an Israelite man and a Midianite woman during Israel's apostasy at Peor, which stopped a plague. God made a covenant of peace and an everlasting priesthood with him.",
    tags: ["high priest", "priestly line"] });

  // ── Key figures of the Exodus ─────────────────────────────────────────
  await insertPerson({ key: "bezalel", name: "Bezalel", gender: "male",
    description: "Son of Uri, grandson of Hur, from the tribe of Judah. God filled him with the Spirit and gave him skill in every kind of craftsmanship to design and build the tabernacle and all its furnishings.",
    tags: ["craftsman"] });

  await insertPerson({ key: "hur", name: "Hur", gender: "male",
    description: "From the tribe of Judah, son of Caleb and Ephrath. With Aaron, he held up Moses' hands during the battle against the Amalekites, ensuring Israel's victory. Helped govern Israel when Moses was on Sinai.",
    tags: ["leader"] });

  await insertPerson({ key: "joshua", name: "Joshua", alsoKnownAs: "Hoshea",
    gender: "male",
    description: "Son of Nun from the tribe of Ephraim. Moses' minister and military commander. One of the twelve spies — with Caleb, he alone gave a faithful report and urged Israel to enter Canaan. Succeeded Moses as leader of Israel. Led the conquest of Canaan. Distributed the land among the tribes. Lived 110 years.",
    tags: ["judge", "military leader", "prophet"] });

  await insertPerson({ key: "caleb", name: "Caleb", gender: "male",
    description: "Son of Jephunneh from the tribe of Judah. One of the twelve spies sent into Canaan. With Joshua, he gave a faithful report and urged Israel forward. Rewarded with long life — still strong at 85, he requested and conquered Hebron as his inheritance.",
    tags: ["military leader", "judge"] });

  await insertPerson({ key: "hobab", name: "Hobab", gender: "male",
    description: "Son of Jethro (Reuel), Moses' brother-in-law. Moses asked him to serve as a guide through the wilderness, using his knowledge of the terrain. His descendants settled in the Negev.",
    tags: ["midianite"] });

  // ── Egyptians ─────────────────────────────────────────────────────────
  await insertPerson({ key: "pharaoh_exodus", name: "Pharaoh of the Exodus", gender: "male",
    description: "The unnamed king of Egypt whose heart God hardened through the ten plagues. Despite each successive plague — water to blood, frogs, gnats, flies, livestock disease, boils, hail, locusts, darkness, and death of the firstborn — he repeatedly refused to release the Israelites. Drowned with his army in the Red Sea.",
    tags: ["egyptian", "king", "antagonist"] });

  await insertPerson({ key: "shiphrah", name: "Shiphrah", gender: "female",
    description: "One of two Hebrew midwives who feared God and refused to carry out Pharaoh's order to kill Hebrew male infants. God blessed them for their courage. One of the earliest examples of civil disobedience in Scripture.",
    tags: ["midwife"] });

  await insertPerson({ key: "puah", name: "Puah", gender: "female",
    description: "One of two Hebrew midwives who feared God and refused to kill Hebrew male infants as Pharaoh commanded. Her name may mean 'girl' or 'splendid.' God gave her a family for her faithfulness.",
    tags: ["midwife"] });
}

// ── Relationships ─────────────────────────────────────────────────────────────
async function seedRelationships() {
  // Levi's line
  await insertRel("kohath", "parent_of", "amram");
  await insertRel("amram", "spouse_of", "jochebed");
  await insertRel("amram", "parent_of", "miriam");
  await insertRel("amram", "parent_of", "aaron");
  await insertRel("amram", "parent_of", "moses");
  await insertRel("jochebed", "parent_of", "miriam");
  await insertRel("jochebed", "parent_of", "aaron");
  await insertRel("jochebed", "parent_of", "moses");

  // Moses' family
  await insertRel("moses", "sibling_of", "aaron");
  await insertRel("moses", "sibling_of", "miriam");
  await insertRel("aaron", "sibling_of", "miriam");
  await insertRel("moses", "spouse_of", "zipporah");
  await insertRel("moses", "parent_of", "gershom");
  await insertRel("moses", "parent_of", "eliezer_moses");
  await insertRel("zipporah", "parent_of", "gershom");
  await insertRel("zipporah", "parent_of", "eliezer_moses");
  await insertRel("jethro", "parent_of", "zipporah");
  await insertRel("jethro", "parent_of", "hobab");

  // Aaron's family
  await insertRel("aaron", "spouse_of", "elisheba");
  await insertRel("aaron", "parent_of", "nadab");
  await insertRel("aaron", "parent_of", "abihu");
  await insertRel("aaron", "parent_of", "eleazar");
  await insertRel("aaron", "parent_of", "ithamar");
  await insertRel("elisheba", "parent_of", "nadab");
  await insertRel("elisheba", "parent_of", "abihu");
  await insertRel("elisheba", "parent_of", "eleazar");
  await insertRel("elisheba", "parent_of", "ithamar");
  await insertRel("eleazar", "parent_of", "phinehas_aaron");

  // Bezalel
  await insertRel("hur", "parent_of", "bezalel", "Bezalel is son of Uri, son of Hur");

  // Cross-book links (to Genesis people)
  await insertRelByName("Levi", "parent_of", "Kohath");
  await insertRelByName("Levi", "parent_of", "Jochebed", "Jochebed is daughter of Levi (Num 26:59)");
  await insertRelByName("Ephraim", "ancestor_of", "Joshua", "Joshua is from the tribe of Ephraim (Num 13:8)");
  await insertRelByName("Judah", "ancestor_of", "Bezalel", "Bezalel is from the tribe of Judah");
  await insertRelByName("Judah", "ancestor_of", "Caleb", "Caleb is from the tribe of Judah (Num 13:6)");
}

// ── Scripture references ──────────────────────────────────────────────────────
async function seedRefs() {
  // Jochebed
  await insertRef("jochebed", "Exodus", 2,  1, 2, 10, "Hides Moses; places him in basket");
  await insertRef("jochebed", "Exodus", 6, 20, 6, 20, "Her name given in genealogy");
  await insertRef("jochebed", "Numbers", 26, 59, 26, 59);

  // Miriam
  await insertRef("miriam", "Exodus", 2,  4, 2,  8, "Watches over infant Moses");
  await insertRef("miriam", "Exodus", 15, 20, 15, 21, "Leads women in song at the sea");
  await insertRef("miriam", "Numbers", 12,  1, 12, 16, "Challenges Moses; struck with leprosy");
  await insertRef("miriam", "Numbers", 20,  1, 20,  1, "Death at Kadesh");

  // Aaron
  await insertRef("aaron", "Exodus",  4, 14, 4, 31, "Appointed Moses' spokesman");
  await insertRef("aaron", "Exodus",  7,  1, 11, 10, "Co-leads the plagues before Pharaoh");
  await insertRef("aaron", "Exodus", 17,  8, 17, 16, "Holds up Moses' hands with Hur");
  await insertRef("aaron", "Exodus", 28,  1, 29, 46, "Consecrated as High Priest");
  await insertRef("aaron", "Exodus", 32,  1, 32, 35, "Makes the golden calf");
  await insertRef("aaron", "Numbers", 20, 22, 20, 29, "Death on Mount Hor");

  // Moses
  await insertRef("moses", "Exodus",  1, 22,  2, 25, "Birth and rescue from the Nile");
  await insertRef("moses", "Exodus",  2, 11,  4, 31, "Kills Egyptian; flees to Midian; burning bush");
  await insertRef("moses", "Exodus",  5,  1, 15, 27, "Confronts Pharaoh; plagues; Exodus");
  await insertRef("moses", "Exodus", 19,  1, 40, 38, "At Sinai; receives the Law; tabernacle");
  await insertRef("moses", "Numbers",  1,  1, 36, 13, "Wilderness leadership");
  await insertRef("moses", "Deuteronomy",  1,  1, 34,  8, "Final speeches; death on Nebo");

  // Jethro
  await insertRef("jethro", "Exodus",  2, 16, 2, 22, "Moses arrives; gives him Zipporah");
  await insertRef("jethro", "Exodus", 18,  1, 18, 27, "Visits the camp; advice on delegation");

  // Zipporah
  await insertRef("zipporah", "Exodus",  2, 21, 2, 22, "Given to Moses in marriage");
  await insertRef("zipporah", "Exodus",  4, 24, 4, 26, "Circumcises her son to avert God's wrath");

  // Pharaoh
  await insertRef("pharaoh_exodus", "Exodus",  5,  1, 14, 31, "Refuses; plagues; Red Sea");

  // Shiphrah & Puah
  await insertRef("shiphrah", "Exodus",  1, 15, 1, 21, "Refuse to kill Hebrew infants");
  await insertRef("puah",     "Exodus",  1, 15, 1, 21, "Refuse to kill Hebrew infants");

  // Pharaoh's daughter
  await insertRef("pharaohs_daughter", "Exodus",  2,  5, 2, 10, "Rescues infant Moses from Nile");

  // Joshua
  await insertRef("joshua", "Exodus", 17,  9, 17, 14, "Leads army against Amalek");
  await insertRef("joshua", "Exodus", 24, 13, 24, 13, "Moses' minister on Sinai");
  await insertRef("joshua", "Numbers", 13,  8, 14, 38, "Faithful spy report");
  await insertRef("joshua", "Numbers", 27, 15, 27, 23, "Appointed Moses' successor");
  await insertRef("joshua", "Joshua",  1,  1, 24, 33, "Conquest and distribution of Canaan");

  // Caleb
  await insertRef("caleb", "Numbers", 13,  6, 14, 38, "Faithful spy; urges Israel to go up");
  await insertRef("caleb", "Numbers", 14, 24, 14, 24, "Rewarded for following God fully");
  await insertRef("caleb", "Joshua", 14,  6, 14, 15, "At 85, claims Hebron as inheritance");

  // Aaron's sons
  await insertRef("nadab",   "Leviticus", 10,  1, 10,  7, "Offers strange fire; consumed");
  await insertRef("abihu",   "Leviticus", 10,  1, 10,  7, "Offers strange fire; consumed");
  await insertRef("eleazar", "Numbers",   20, 25, 20, 29, "Succeeds Aaron as High Priest");
  await insertRef("eleazar", "Joshua",    14,  1, 14,  5, "Oversees land distribution with Joshua");
  await insertRef("phinehas_aaron", "Numbers", 25,  6, 25, 18, "Zealous act stops the plague at Peor");

  // Bezalel & Hur
  await insertRef("bezalel", "Exodus", 31,  1, 31, 11, "Filled with God's Spirit; builds tabernacle");
  await insertRef("bezalel", "Exodus", 35, 30, 37, 29);
  await insertRef("hur",     "Exodus", 17, 10, 17, 13, "Holds up Moses' arms with Aaron");
  await insertRef("hur",     "Exodus", 24, 14, 24, 14, "Left in charge with Aaron");

  // Kohath & Amram
  await insertRef("kohath", "Genesis", 46, 11, 46, 11, "Listed among those who went to Egypt");
  await insertRef("kohath", "Exodus",   6, 18, 6, 18);
  await insertRef("amram",  "Exodus",   6, 18, 6, 20);
  await insertRef("amram",  "Numbers", 26, 58, 26, 59);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Seeding Exodus people...");
  await seedPeople();
  console.log("Seeding Exodus relationships...");
  await seedRelationships();
  console.log("Seeding Exodus scripture references...");
  await seedRefs();

  const pc = await db.execute("SELECT COUNT(*) as c FROM people");
  const rc = await db.execute("SELECT COUNT(*) as c FROM relationships");
  const sc = await db.execute("SELECT COUNT(*) as c FROM scripture_refs");
  console.log(`\n✓ Exodus seed complete.`);
  console.log(`  Total people now: ${(pc.rows[0] as { c: number }).c}`);
  console.log(`  Total relationships now: ${(rc.rows[0] as { c: number }).c}`);
  console.log(`  Total scripture refs now: ${(sc.rows[0] as { c: number }).c}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
