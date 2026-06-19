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
  // ── Saul's surviving line ─────────────────────────────────────────────
  await safeInsertPerson({ key: "ish_bosheth", name: "Ish-bosheth", alsoKnownAs: "Esh-baal",
    gender: "male",
    description: "Son of Saul, whose original name was Esh-baal ('man of Baal'). After Saul's death at Gilboa, Abner made him king over all Israel from Mahanaim, opposing David's rule in Hebron. A weak king: he quarreled with Abner over Saul's concubine Rizpah, driving Abner to defect to David. Murdered in his bed by Baanah and Rechab; his head was brought to David, who executed the assassins. His son Mephibosheth survived.",
    tags: ["king", "tribe of israel"] });

  await safeInsertPerson({ key: "mephibosheth", name: "Mephibosheth", alsoKnownAs: "Merib-baal",
    gender: "male",
    description: "Son of Jonathan, grandson of Saul. Crippled in both feet when his nurse dropped him while fleeing after Gilboa (he was five). David honored his covenant with Jonathan by restoring all of Saul's lands to Mephibosheth and inviting him to eat at the royal table for life. His servant Ziba later slandered him to David during Absalom's revolt.",
    tags: ["tribe of israel"] });

  // ── David's commanders ────────────────────────────────────────────────
  await safeInsertPerson({ key: "zeruiah", name: "Zeruiah",
    gender: "female",
    description: "David's sister (or half-sister), mother of Joab, Abishai, and Asahel — three of David's most formidable warriors. She herself is rarely a speaking character but is mentioned constantly as the identifier of her sons. The recurring phrase 'sons of Zeruiah' became shorthand for a difficult, fierce temperament that David sometimes found hard to manage.",
    tags: ["tribe of israel", "ancestor"] });

  await safeInsertPerson({ key: "joab", name: "Joab",
    gender: "male",
    description: "Son of Zeruiah, David's nephew and chief military commander throughout his reign. Brilliant general who captured Jerusalem, led victories over Ammon and Aram, and managed David's armies for decades. Also ruthless: killed Abner in revenge for his brother Asahel, killed Absalom against David's explicit order, and later sided with Adonijah against Solomon. Executed by Solomon at David's deathbed request.",
    tags: ["warrior", "tribe of israel"] });

  await safeInsertPerson({ key: "abishai", name: "Abishai", alsoKnownAs: "Abishai son of Zeruiah",
    gender: "male",
    description: "Son of Zeruiah, brother of Joab and Asahel. One of David's three greatest warriors. Went with David into Saul's camp at night and urged killing the sleeping king; David refused. Killed 300 men with his spear in one encounter. Saved David's life when Ishbi-benob the giant nearly struck him down. Wanted to kill Shimei when he cursed David.",
    tags: ["warrior", "tribe of israel"] });

  await safeInsertPerson({ key: "asahel", name: "Asahel", alsoKnownAs: "Asahel son of Zeruiah",
    gender: "male",
    description: "Son of Zeruiah, brother of Joab, described as swift as a gazelle. Pursued Abner after the battle at Gibeon. When Abner warned him off, Asahel refused to turn aside. Abner struck him with the butt of his spear, killing him. His death became the reason Joab murdered Abner in apparent blood revenge.",
    tags: ["warrior", "tribe of israel"] });

  // ── Bathsheba, Uriah, Nathan ──────────────────────────────────────────
  await safeInsertPerson({ key: "bathsheba", name: "Bathsheba", alsoKnownAs: "Bath-shua",
    gender: "female",
    description: "Wife of Uriah the Hittite. Seen bathing on a rooftop by David, who sent for her; she became pregnant. After David arranged Uriah's death, he took her as his wife. Their first child died as a consequence of Nathan's prophecy. She then bore Solomon, Shimea, Shobab, and Nathan. Later, at David's old age, she advocated successfully to Nathan and David for Solomon's coronation over Adonijah. Mother of Israel's wisest king.",
    tags: ["matriarch", "ancestor", "messianic line"] });

  await safeInsertPerson({ key: "uriah", name: "Uriah", alsoKnownAs: "Uriah the Hittite",
    gender: "male",
    description: "Hittite soldier in David's army, one of David's Thirty elite warriors. Husband of Bathsheba. When David tried to cover up Bathsheba's pregnancy by sending Uriah home from the battlefield, Uriah refused to go to his wife while the ark and Israel's army remained in the field. David then arranged his death by ordering Joab to position him at the front of the fighting and withdraw. His loyal integrity stands in stark contrast to David's sin.",
    tags: ["warrior"] });

  await safeInsertPerson({ key: "nathan", name: "Nathan",
    gender: "male",
    description: "Prophet during David's reign. Told David he could not build the Temple but that God would build David's 'house' — a covenant of eternal dynasty (2 Sam 7). Confronted David after the Bathsheba-Uriah affair with the parable of the ewe lamb: 'You are the man.' Announced the death of David's first son with Bathsheba and the name 'Jedidiah' (Beloved of God) for Solomon. Later ensured Solomon's coronation against Adonijah's claim.",
    tags: ["prophet"] });

  // ── David's children ──────────────────────────────────────────────────
  await safeInsertPerson({ key: "amnon", name: "Amnon",
    gender: "male",
    description: "David's firstborn son by Ahinoam of Jezreel. Became obsessed with his half-sister Tamar, raped her on false pretense of illness, then immediately hated her with even greater intensity. Tamar's full brother Absalom waited two years before having him killed at a sheep-shearing feast. David mourned Amnon's death.",
    tags: ["tribe of israel"] });

  await safeInsertPerson({ key: "tamar_david", name: "Tamar", alsoKnownAs: "Tamar daughter of David",
    gender: "female",
    description: "Daughter of David, full sister of Absalom. Beautiful; raped by her half-brother Amnon who then despised her. She lived desolate in Absalom's house after the assault. Her name was later given to Absalom's daughter. Not to be confused with Tamar wife of Judah (Genesis) or Tamar mother of Absalom's daughter.",
    tags: ["tribe of israel"] });

  await safeInsertPerson({ key: "absalom", name: "Absalom",
    gender: "male",
    description: "Third son of David, born to Maacah daughter of the king of Geshur. Described as the most handsome man in all Israel — no blemish from head to foot, with hair so thick it weighed five pounds when cut annually. Killed Amnon in revenge for Tamar's rape; fled to Geshur for three years. Returned to Jerusalem; reconciled with David. Stole the hearts of Israel through flattery at the city gate. Declared himself king in Hebron; briefly occupied Jerusalem. Killed against David's orders by Joab when his hair caught in a terebinth tree. David's lament: 'O my son Absalom! My son, my son Absalom!'",
    tags: ["tribe of israel"] });

  // ── David's adversaries and counselors ────────────────────────────────
  await safeInsertPerson({ key: "ahithophel", name: "Ahithophel",
    gender: "male",
    description: "David's most trusted counselor, described as one whose advice was like inquiring of God. Betrayed David by joining Absalom's rebellion — possibly because Bathsheba was his granddaughter and Uriah his kinsman. Advised Absalom to sleep with David's concubines publicly to signal an irreversible break. When Absalom rejected his military advice in favor of Hushai's, Ahithophel went home, set his affairs in order, and hanged himself.",
    tags: ["other"] });

  await safeInsertPerson({ key: "hushai", name: "Hushai", alsoKnownAs: "Hushai the Arkite",
    gender: "male",
    description: "David's friend and spy planted in Absalom's court during the rebellion. Pretended to transfer loyalty to Absalom. Countered Ahithophel's sound military advice with a plan that gave David time to escape across the Jordan. His intervention was decisive: 'The Lord had determined to frustrate the good advice of Ahithophel.' Sent intelligence to David through the priests Zadok and Abiathar.",
    tags: ["other"] });

  await safeInsertPerson({ key: "shimei", name: "Shimei", alsoKnownAs: "Shimei son of Gera",
    gender: "male",
    description: "Benjaminite from Saul's clan. Came out cursing David as he fled Jerusalem during Absalom's revolt, throwing stones and dust, calling him a man of blood. Abishai wanted to kill him on the spot; David restrained him, saying perhaps the Lord had told Shimei to curse. After Absalom's defeat, Shimei came humbly to David at the Jordan and was pardoned — though David told Solomon not to let him die peacefully. Solomon later had him executed when he violated the terms of house arrest.",
    tags: ["tribe of israel"] });
}

// ── Relationships ─────────────────────────────────────────────────────────────
async function seedRelationships() {
  // ── Saul's line ───────────────────────────────────────────────────────
  await insertRelByName("Saul",    "parent_of",  "Ish-bosheth", "Ish-bosheth, Saul's son; rival king (2 Sam 2:8)");
  await insertRelByName("Jonathan","parent_of",  "Mephibosheth","Jonathan's crippled son (2 Sam 4:4)");
  await insertRel("ish_bosheth", "servant_of", "abner",
    "Abner made Ish-bosheth king but really held the power"); // abner from 1 Samuel, ref by name below
  await insertRelByName("Abner",   "servant_of", "Ish-bosheth", "Abner installed and propped up Ish-bosheth (2 Sam 2:8-9)");
  await insertRelByName("David",   "ally_of",    "Mephibosheth","David honored Jonathan's memory by restoring Mephibosheth (2 Sam 9)");

  // ── Zeruiah's sons ────────────────────────────────────────────────────
  await insertRelByName("David",   "sibling_of", "Zeruiah",     "Zeruiah is David's sister (1 Chr 2:16)");
  await insertRel("zeruiah", "parent_of", "joab");
  await insertRel("zeruiah", "parent_of", "abishai");
  await insertRel("zeruiah", "parent_of", "asahel");
  await insertRelByName("Joab",    "enemy_of",   "Abner",       "Joab killed Abner in revenge for Asahel (2 Sam 3:27)");
  await insertRelByName("Joab",    "servant_of", "David",       "Commander of David's armies throughout his reign");
  await insertRel("joab",    "enemy_of", "absalom",
    "Killed Absalom against David's orders (2 Sam 18:14)");

  // ── Bathsheba, Uriah, David ───────────────────────────────────────────
  await insertRel("uriah",    "spouse_of",  "bathsheba", "Uriah's wife taken by David (2 Sam 11:3)");
  await insertRelByName("David",   "spouse_of",  "Bathsheba",   "David married Bathsheba after Uriah's death (2 Sam 11:27)");
  await insertRelByName("David",   "enemy_of",   "Uriah",       "David arranged Uriah's death (2 Sam 11:15)");
  await insertRelByName("Nathan",  "mentor_of",  "David",       "Nathan confronted David over Bathsheba/Uriah (2 Sam 12:7)");

  // ── David's children ──────────────────────────────────────────────────
  await insertRelByName("David",   "parent_of",  "Amnon",       "Amnon, David's firstborn by Ahinoam (2 Sam 3:2)");
  await insertRelByName("David",   "parent_of",  "Absalom",     "Absalom, David's third son by Maacah (2 Sam 3:3)");
  await insertRelByName("Ahinoam", "parent_of",  "Amnon",       "Amnon son of Ahinoam of Jezreel (2 Sam 3:2)");
  await insertRel("amnon",   "enemy_of",   "tamar_david", "Amnon raped his half-sister Tamar (2 Sam 13:14)");
  await insertRel("absalom", "sibling_of", "tamar_david", "Tamar is Absalom's full sister (2 Sam 13:1)");
  await insertRel("absalom", "enemy_of",   "amnon",       "Absalom had Amnon killed for raping Tamar (2 Sam 13:29)");
  await insertRelByName("David",   "parent_of",  "Tamar",       "Tamar daughter of David (2 Sam 13:1)");

  // ── Absalom's revolt ──────────────────────────────────────────────────
  await insertRel("absalom",    "enemy_of",   "ahithophel",
    "Ahithophel defected to Absalom; killed himself when counsel rejected");
  await insertRelByName("Ahithophel","ally_of",    "Absalom",     "Ahithophel joined Absalom's revolt (2 Sam 15:12)");
  await insertRelByName("Hushai",    "ally_of",    "David",       "David's spy in Absalom's court (2 Sam 15:37)");
  await insertRel("hushai",    "enemy_of",   "ahithophel", "Hushai countered Ahithophel's advice, saving David");
  await insertRel("shimei",    "enemy_of",   "david",       "Cursed David while he fled Absalom (2 Sam 16:5-8)");
}

// ── Scripture references ───────────────────────────────────────────────────────
async function seedRefs() {
  await insertRef("ish_bosheth",  "2 Samuel",  2,  8,  4, 12, "Made king by Abner; murdered in his bed");
  await insertRef("mephibosheth", "2 Samuel",  4,  4,  4,  4, "Dropped by nurse; crippled at five");
  await insertRef("mephibosheth", "2 Samuel",  9,  1,  9, 13, "David restores Jonathan's son to honor the covenant");
  await insertRef("zeruiah",      "2 Samuel",  2, 18,  3, 39, "Sons of Zeruiah repeatedly mentioned");
  await insertRef("joab",         "2 Samuel",  2, 13, 24, 25, "David's general; kills Abner, Absalom; leads armies");
  await insertRef("abishai",      "2 Samuel",  2, 18, 21, 17, "Valiant warrior; saves David; wants to kill Shimei");
  await insertRef("asahel",       "2 Samuel",  2, 18,  2, 32, "Swift warrior; pursues Abner; killed by him");
  await insertRef("bathsheba",    "2 Samuel", 11,  2, 12, 25, "David's sin; Uriah killed; first child dies; Solomon born");
  await insertRef("uriah",        "2 Samuel", 11,  3, 11, 24, "Loyal soldier; betrayed and killed by David");
  await insertRef("nathan",       "2 Samuel",  7,  1,  7, 17, "Nathan's covenant promise to David");
  await insertRef("nathan",       "2 Samuel", 12,  1, 12, 25, "Parable of the ewe lamb; 'You are the man'");
  await insertRef("amnon",        "2 Samuel",  3,  2, 13, 38, "David's firstborn; rapes Tamar; killed by Absalom");
  await insertRef("tamar_david",  "2 Samuel", 13,  1, 13, 22, "Raped by Amnon; lives desolate in Absalom's house");
  await insertRef("absalom",      "2 Samuel",  3,  3, 19, 10, "Most handsome in Israel; revolt; killed by Joab");
  await insertRef("ahithophel",   "2 Samuel", 15, 12, 17, 23, "Joins Absalom; counsel rejected; hangs himself");
  await insertRef("hushai",       "2 Samuel", 15, 32, 17, 23, "David's spy; foils Ahithophel's advice");
  await insertRef("shimei",       "2 Samuel", 16,  5, 19, 23, "Curses David; pardoned; told to Solomon for later");
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Seeding 2 Samuel people...");
  await seedPeople();
  console.log("Seeding 2 Samuel relationships...");
  await seedRelationships();
  console.log("Seeding 2 Samuel scripture references...");
  await seedRefs();

  const pc = await db.execute("SELECT COUNT(*) as c FROM people");
  const rc = await db.execute("SELECT COUNT(*) as c FROM relationships");
  const sc = await db.execute("SELECT COUNT(*) as c FROM scripture_refs");
  console.log(`\n✓ 2 Samuel seed complete.`);
  console.log(`  Total people now: ${(pc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total relationships now: ${(rc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total scripture refs now: ${(sc.rows[0] as unknown as { c: number }).c}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
