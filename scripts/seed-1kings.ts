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
  // ── David's final days and Solomon's rivals ────────────────────────────
  await safeInsertPerson({ key: "adonijah", name: "Adonijah",
    gender: "male",
    description: "David's fourth son by Haggith. When David was old and frail, he declared himself king with support from Joab and Abiathar the priest, holding a feast at En-rogel. Nathan and Bathsheba alerted David, who had Solomon anointed immediately. Adonijah submitted. Later asked for Abishag the Shunammite as his wife — Solomon read this as a bid for the throne and had him executed.",
    tags: ["tribe of israel"] });

  // ── Solomon ───────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "solomon", name: "Solomon", alsoKnownAs: "Jedidiah",
    gender: "male",
    description: "Son of David and Bathsheba, Israel's third king and wisest ruler. At Gibeon God offered him anything; he asked for wisdom. His judgment with the two mothers and the disputed baby became legendary. Built the Temple in Jerusalem over seven years using cedar from Lebanon and supervised 30,000 conscripted laborers. Wrote Proverbs, Ecclesiastes, and Song of Songs. Received the Queen of Sheba. His seven hundred wives and three hundred concubines, many foreign, led him into idolatry in his old age. Kingdom split after his death.",
    tags: ["king", "poet", "ancestor", "messianic line", "tribe of israel"] });

  // ── International alliances ────────────────────────────────────────────
  await safeInsertPerson({ key: "hiram_tyre", name: "Hiram", alsoKnownAs: "Hiram king of Tyre",
    gender: "male",
    description: "King of Tyre (Phoenicia), ally of both David and Solomon. Sent cedar logs and skilled craftsmen to help David build his palace, and later provided vast quantities of cedar, pine, and gold for Solomon's Temple. In return received twenty Galilean towns (which he found unsatisfactory and called 'Cabul'). Also collaborated with Solomon's Red Sea fleet at Ezion-geber.",
    tags: ["king"] });

  await safeInsertPerson({ key: "queen_sheba", name: "Queen of Sheba",
    gender: "female",
    description: "Foreign queen who heard of Solomon's wisdom and came to Jerusalem to test him with hard questions. She brought 120 talents of gold, large quantities of spices, and precious stones. Solomon answered all her questions; 'there was nothing hidden from the king that he could not explain.' She declared his wisdom and wealth exceeded the report she had heard and blessed the Lord. She and her servants returned to her own country.",
    tags: ["queen"] });

  // ── Divided kingdom: south ─────────────────────────────────────────────
  await safeInsertPerson({ key: "rehoboam", name: "Rehoboam",
    gender: "male",
    description: "Son of Solomon by Naamah the Ammonite. Succeeded his father but rejected the elders' advice to lighten Israel's heavy burden of forced labor, following instead his young companions' counsel to promise even harsher treatment. The northern ten tribes revolted under Jeroboam. He ruled Judah from Jerusalem. His reign saw a religious decline and an invasion by Pharaoh Shishak who looted the Temple.",
    tags: ["king", "tribe of israel", "ancestor", "messianic line"] });

  // ── Divided kingdom: north ─────────────────────────────────────────────
  await safeInsertPerson({ key: "jeroboam", name: "Jeroboam", alsoKnownAs: "Jeroboam son of Nebat",
    gender: "male",
    description: "Son of Nebat, an Ephraimite official under Solomon. The prophet Ahijah told him God would give him ten tribes because of Solomon's idolatry. Fled to Egypt when Solomon tried to kill him. Returned after Solomon's death, led the northern revolt, and became first king of Israel (northern kingdom). Set up golden calves at Bethel and Dan saying 'Here are your gods who brought you out of Egypt.' His sin of making priests from non-Levite clans became the standard by which every northern king was condemned.",
    tags: ["king"] });

  await safeInsertPerson({ key: "ahijah_prophet", name: "Ahijah", alsoKnownAs: "Ahijah the Shilonite",
    gender: "male",
    description: "Prophet from Shiloh who tore his new cloak into twelve pieces and gave ten to Jeroboam, symbolizing God's gift of the ten northern tribes. Later, when Jeroboam's son Abijah fell ill, Jeroboam sent his disguised wife to Ahijah; the old and blind prophet still recognized her and delivered a devastating judgment against Jeroboam's house.",
    tags: ["prophet"] });

  // ── Elijah era ─────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "elijah", name: "Elijah", alsoKnownAs: "Elijah the Tishbite",
    gender: "male",
    description: "Prophet from Tishbe in Gilead, arguably the most dramatic prophet in the Old Testament. Declared a drought to Ahab. Fed by ravens at Cherith, then by the widow of Zarephath whose flour and oil never ran out and whose son he raised from the dead. Challenged 450 prophets of Baal on Mount Carmel — fire fell from heaven, and he slaughtered them all. Fled to Horeb in despair; heard the still small voice. Anointed Elisha as his successor. Confronted Ahab over Naboth's vineyard. Was taken to heaven in a whirlwind, not tasting death. Appeared with Moses on the Mount of Transfiguration.",
    tags: ["prophet"] });

  await safeInsertPerson({ key: "ahab", name: "Ahab",
    gender: "male",
    description: "Son of Omri, king of Israel. Described as doing more evil than all the kings before him. Married Jezebel of Sidon, built a temple for Baal in Samaria, and erected an Asherah pole. Coveted Naboth's vineyard and allowed Jezebel to have Naboth stoned. Confronted repeatedly by Elijah. Sometimes showed repentance: when Elijah announced judgment he humbled himself and God delayed disaster. Killed by a random arrow at Ramoth-gilead; his blood was licked by dogs as Elijah had prophesied.",
    tags: ["king", "antagonist"] });

  await safeInsertPerson({ key: "jezebel", name: "Jezebel",
    gender: "female",
    description: "Phoenician princess from Sidon, daughter of Ethbaal king of the Sidonians, wife of Ahab. Introduced Baal worship to Israel on a national scale, killing the Lord's prophets — Obadiah hid a hundred of them. Orchestrated Naboth's false accusation and stoning to seize his vineyard for Ahab. Threatened to kill Elijah after Carmel, driving him to flee. Died when thrown from a window by her own servants at Jehu's command; her corpse was eaten by dogs as Elijah had prophesied.",
    tags: ["queen", "antagonist"] });

  await safeInsertPerson({ key: "obadiah_steward", name: "Obadiah", alsoKnownAs: "Obadiah steward of Ahab",
    gender: "male",
    description: "Palace administrator under Ahab who deeply feared the Lord. When Jezebel was killing the prophets, he hid a hundred of them in caves and supplied them with bread and water. Encountered Elijah during the drought while searching for water with Ahab. Reluctant to tell Ahab Elijah was present, fearing the prophet would vanish again. Not to be confused with the prophet Obadiah (who wrote the book of Obadiah).",
    tags: ["other"] });

  await safeInsertPerson({ key: "naboth", name: "Naboth",
    gender: "male",
    description: "Jezreelite who owned a vineyard adjacent to Ahab's palace in Jezreel. Refused to sell or trade it because it was his ancestral inheritance. Jezebel had him falsely accused of blasphemy by two scoundrels and stoned to death. Elijah confronted Ahab in Naboth's vineyard and pronounced judgment on his house. His judicial murder symbolizes royal abuse of covenant land rights.",
    tags: ["other"] });

  await safeInsertPerson({ key: "ben_hadad", name: "Ben-hadad", alsoKnownAs: "Ben-hadad king of Aram",
    gender: "male",
    description: "King of Aram (Syria), who twice besieged Samaria during Ahab's reign. The first time he demanded Ahab's silver, gold, and family; Ahab initially agreed but refused the second escalated demand. An unnamed prophet told Ahab God would give him victory, which he achieved at Aphek. Ben-hadad fled and appealed to Ahab's mercy; Ahab made a treaty with him — this spared life that God had devoted to destruction, costing Ahab his own life in the prophetic rebuke that followed.",
    tags: ["king"] });
}

// ── Relationships ─────────────────────────────────────────────────────────────
async function seedRelationships() {
  // ── David / Solomon succession ─────────────────────────────────────────
  await insertRelByName("David",    "parent_of", "Adonijah", "Adonijah, fourth son of David (1 Kgs 1:5)");
  await insertRelByName("David",    "parent_of", "Solomon",  "Solomon son of David and Bathsheba (1 Kgs 1:13)");
  await insertRelByName("Bathsheba","parent_of", "Solomon",  "Solomon is Bathsheba's son (2 Sam 12:24)");
  await insertRel("adonijah", "enemy_of",   "solomon",  "Adonijah tried to take the throne before Solomon (1 Kgs 1)");
  await insertRelNameToLocal("Nathan","ally_of",   "solomon",  "Nathan helped ensure Solomon's coronation (1 Kgs 1:11)");

  // ── Solomon / Rehoboam / Jeroboam split ───────────────────────────────
  await insertRel("solomon",  "parent_of",  "rehoboam", "Rehoboam son of Solomon (1 Kgs 11:43)");
  await insertRel("rehoboam", "enemy_of",   "jeroboam", "The kingdom split when Rehoboam refused to lighten labor (1 Kgs 12)");
  await insertRel("ahijah_prophet","mentor_of","jeroboam","Ahijah prophesied Jeroboam would rule ten tribes (1 Kgs 11:29-31)");

  // ── International ─────────────────────────────────────────────────────
  await insertRel("solomon",  "ally_of",    "hiram_tyre","Cedar and gold for the Temple (1 Kgs 5)");
  await insertRel("queen_sheba","ally_of",  "solomon",   "Queen of Sheba visited; gifts exchanged (1 Kgs 10)");

  // ── Ahab / Jezebel era ────────────────────────────────────────────────
  await insertRel("ahab",     "spouse_of",  "jezebel",       "Ahab married Jezebel of Sidon (1 Kgs 16:31)");
  await insertRel("elijah",   "enemy_of",   "ahab",          "Elijah declared drought; challenged and confronted Ahab");
  await insertRel("elijah",   "enemy_of",   "jezebel",       "Jezebel threatened Elijah; he fled to Horeb (1 Kgs 19)");
  await insertRel("jezebel",  "enemy_of",   "naboth",        "Jezebel arranged Naboth's false accusation and murder (1 Kgs 21)");
  await insertRel("obadiah_steward","servant_of","ahab",     "Palace manager under Ahab (1 Kgs 18:3)");
  await insertRel("obadiah_steward","ally_of","elijah",      "Hid 100 prophets from Jezebel; relayed Elijah's message");
  await insertRel("ahab",     "enemy_of",   "ben_hadad",     "Two wars against Ben-hadad of Aram (1 Kgs 20)");
  await insertRelNameToLocal("Judah", "ancestor_of", "rehoboam","Rehoboam king of the southern tribe of Judah");
}

// ── Scripture references ───────────────────────────────────────────────────────
async function seedRefs() {
  await insertRef("adonijah",       "1 Kings",  1,  5,  2, 25, "Bid for throne; submission; later executed by Solomon");
  await insertRef("solomon",        "1 Kings",  1, 28, 11, 43, "Coronation, wisdom, Temple, wealth, decline, death");
  await insertRef("hiram_tyre",     "1 Kings",  5,  1,  9, 14, "Supplies cedar, craftsmen for the Temple");
  await insertRef("queen_sheba",    "1 Kings", 10,  1, 10, 13, "Visits Solomon; overwhelmed by his wisdom and wealth");
  await insertRef("rehoboam",       "1 Kings", 11, 43, 14, 31, "Foolish decision splits the kingdom; raids by Shishak");
  await insertRef("jeroboam",       "1 Kings", 11, 26, 14, 20, "Rise, reign, golden calves at Bethel and Dan");
  await insertRef("ahijah_prophet", "1 Kings", 11, 29, 14, 18, "Tears cloak; prophecy to Jeroboam; prophecy of judgment");
  await insertRef("elijah",         "1 Kings", 17,  1, 21, 29, "Drought declared; ravens; widow; Carmel; Horeb; Naboth");
  await insertRef("ahab",           "1 Kings", 16, 28, 22, 40, "Most wicked king of Israel; Baal temple; killed at Ramoth");
  await insertRef("jezebel",        "1 Kings", 16, 31, 21, 25, "Promotes Baal worship; kills prophets; murders Naboth");
  await insertRef("obadiah_steward","1 Kings", 18,  3, 18, 16, "Hid 100 prophets; met Elijah during drought");
  await insertRef("naboth",         "1 Kings", 21,  1, 21, 19, "Refused to sell vineyard; falsely accused and stoned");
  await insertRef("ben_hadad",      "1 Kings", 20,  1, 20, 43, "Besieges Samaria twice; Ahab defeats him twice; spared");
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Seeding 1 Kings people...");
  await seedPeople();
  console.log("Seeding 1 Kings relationships...");
  await seedRelationships();
  console.log("Seeding 1 Kings scripture references...");
  await seedRefs();

  const pc = await db.execute("SELECT COUNT(*) as c FROM people");
  const rc = await db.execute("SELECT COUNT(*) as c FROM relationships");
  const sc = await db.execute("SELECT COUNT(*) as c FROM scripture_refs");
  console.log(`\n✓ 1 Kings seed complete.`);
  console.log(`  Total people now: ${(pc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total relationships now: ${(rc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total scripture refs now: ${(sc.rows[0] as unknown as { c: number }).c}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
