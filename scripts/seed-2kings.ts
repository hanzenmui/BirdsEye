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
  // ── Elisha and disciples ───────────────────────────────────────────────
  await safeInsertPerson({ key: "elisha", name: "Elisha",
    gender: "male",
    description: "Son of Shaphat from Abel-meholah, Elijah's successor. Called while plowing with twelve yoke of oxen; slaughtered one pair and left to follow Elijah. Witnessed Elijah taken up in the whirlwind and received a double portion of his spirit. Performed more recorded miracles than any other Old Testament prophet: healed Jericho's water, cursed mocking youths (mauled by bears), multiplied oil for a widow, raised the Shunammite woman's son, purified poisoned stew, multiplied loaves, healed Naaman of leprosy, made an axe head float, blinded an Aramean army, and predicted events in battle. His bones revived a dead man thrown into his tomb.",
    tags: ["prophet"] });

  await safeInsertPerson({ key: "gehazi", name: "Gehazi",
    gender: "male",
    description: "Elisha's servant. Tried to wake the Shunammite's dead son using Elisha's staff (it did not work). After Elisha healed Naaman, Gehazi ran after him and lied to obtain silver and clothing for himself, claiming Elisha had sent him. When he returned, Elisha knew exactly what had happened and pronounced Naaman's leprosy on Gehazi and his descendants forever. Later appeared before the king to tell stories of Elisha's miracles.",
    tags: ["other"] });

  // ── Naaman ────────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "naaman", name: "Naaman",
    gender: "male",
    description: "Commander of the army of Aram (Syria), a great warrior but a leper. A captive Israelite servant girl told his wife about Elisha. Naaman arrived at Elisha's door with horses, chariots, silver, gold, and clothing. Elisha sent a messenger to tell him to wash seven times in the Jordan. Naaman was furious at the simple instruction — he had expected a dramatic ceremony. His servants persuaded him to obey; he was completely healed. He returned to confess there was no God in all the earth but in Israel, and asked for two mule-loads of Israelite soil to offer sacrifices.",
    tags: ["warrior"] });

  // ── Jehu dynasty ──────────────────────────────────────────────────────
  await safeInsertPerson({ key: "jehu", name: "Jehu", alsoKnownAs: "Jehu son of Jehoshaphat",
    gender: "male",
    description: "Army commander anointed by one of Elisha's prophets to destroy the house of Ahab. Described as driving his chariot furiously. Killed Joram king of Israel and Ahaziah king of Judah at Jezreel. Threw Jezebel from a window; her blood splattered on the wall and horses trampled her. Executed all of Ahab's seventy sons, all his officials, priests of Baal, and the Baal worshippers he lured into the temple under false pretense of a great sacrifice. Founded a dynasty that lasted four generations. But he did not turn from Jeroboam's golden calves.",
    tags: ["king", "warrior"] });

  // ── Judah: Athaliah and Joash ─────────────────────────────────────────
  await safeInsertPerson({ key: "athaliah", name: "Athaliah",
    gender: "female",
    description: "Daughter of Ahab (and Jezebel), mother of Ahaziah king of Judah. When her son was killed by Jehu, she seized the throne and killed all the royal family — the only queen regnant in Judah's history. Joash, Ahaziah's infant son, was hidden in the Temple by his aunt Jehosheba for six years. When Jehoiada the priest staged a coup, Athaliah was dragged from the Temple and executed at the horse gate.",
    tags: ["queen", "antagonist"] });

  await safeInsertPerson({ key: "joash_judah", name: "Joash", alsoKnownAs: "Joash king of Judah",
    gender: "male",
    description: "Son of Ahaziah, hidden as an infant in the Temple for six years while his grandmother Athaliah usurped the throne. Crowned at age seven by Jehoiada the priest. Did what was right as long as Jehoiada lived; repaired the Temple using a collection chest. After Jehoiada died, Joash listened to officials and allowed idol worship to return. Had Zechariah, Jehoiada's own son, stoned in the Temple court for prophesying against them. Killed by his own servants in an assassination. Not to be confused with Joash father of Gideon.",
    tags: ["king", "tribe of israel"] });

  await safeInsertPerson({ key: "jehoiada", name: "Jehoiada",
    gender: "male",
    description: "High priest who hid the infant Joash in the Temple for six years, protecting him from Athaliah. At Joash's seventh year staged a carefully organized coup: divided the guard, armed them with David's spears and shields, crowned the boy king, and had Athaliah executed. Guided the young king in reforming worship. Lived to 130 and was buried among the kings because of all the good he had done for Israel. His son Zechariah was later killed by Joash.",
    tags: ["priest"] });

  // ── Hezekiah era ──────────────────────────────────────────────────────
  await safeInsertPerson({ key: "hezekiah", name: "Hezekiah",
    gender: "male",
    description: "Son of Ahaz, one of Judah's most righteous kings. Destroyed the high places, smashed the bronze serpent Moses had made (Nehushtan), which Israel had been worshipping. Trusted in the Lord more than any king since David. Withstood the Assyrian siege of Jerusalem: when Sennacherib's envoy Rabshakeh mocked God before the people, Hezekiah spread the letter before the Lord in the Temple and prayed; 185,000 Assyrian soldiers died overnight. Fell mortally ill; prayed and was given fifteen more years. Foolishly showed Babylonian envoys all his treasury. Reigned 29 years.",
    tags: ["king", "tribe of israel"] });

  await safeInsertPerson({ key: "isaiah", name: "Isaiah", alsoKnownAs: "Isaiah son of Amoz",
    gender: "male",
    description: "Prophet during the reigns of Uzziah, Jotham, Ahaz, and Hezekiah. Appears in 2 Kings 19–20 advising Hezekiah during the Assyrian crisis: announced God would defend Jerusalem and Sennacherib would not enter the city. Told Hezekiah he would die, then returned to tell him fifteen more years had been granted. His book contains the great servant songs and the clearest messianic prophecies in the Old Testament.",
    tags: ["prophet"] });

  await safeInsertPerson({ key: "sennacherib", name: "Sennacherib",
    gender: "male",
    description: "King of Assyria who invaded Judah, captured 46 fortified cities, and besieged Jerusalem. Sent his envoy Rabshakeh to demoralize the defenders with a speech in Hebrew mocking Hezekiah and the Lord. Sent a threatening letter when he heard of an Ethiopian threat. The Angel of the Lord struck down 185,000 in his camp in a single night; Sennacherib withdrew to Nineveh and was later killed by his own sons while worshipping in the temple of Nisrok.",
    tags: ["king", "antagonist"] });

  // ── Later kings of Judah ───────────────────────────────────────────────
  await safeInsertPerson({ key: "manasseh_king", name: "Manasseh", alsoKnownAs: "Manasseh king of Judah",
    gender: "male",
    description: "Son of Hezekiah, longest-reigning king of Judah (55 years). Most wicked: rebuilt the high places his father destroyed, erected Asherah poles, worshipped all the host of heaven, built altars in the Temple courts, sacrificed his own son in the fire, practiced divination and sorcery, and filled Jerusalem with innocent blood. God declared Judah would be exiled for this. His wickedness is identified as the final cause of the Babylonian exile. Not to be confused with Manasseh son of Joseph. Chronicles adds that he was taken captive to Babylon, repented, and was restored.",
    tags: ["king", "antagonist", "tribe of israel"] });

  await safeInsertPerson({ key: "josiah", name: "Josiah",
    gender: "male",
    description: "Son of Amon, king of Judah from age eight. The Book of the Law was discovered in the Temple during his eighteenth year of reforms. When it was read to him he tore his robes in grief. The prophetess Huldah confirmed God's word of judgment but promised Josiah would die before the disaster. He held the greatest Passover since the judges, destroyed every high place, defiled Topheth, smashed altars across the land, and killed the priests of the high places. Died at Megiddo confronting Pharaoh Necho. 'Neither before nor after Josiah was there a king like him.'",
    tags: ["king", "tribe of israel"] });

  await safeInsertPerson({ key: "nebuchadnezzar", name: "Nebuchadnezzar", alsoKnownAs: "Nebuchadnezzar king of Babylon",
    gender: "male",
    description: "King of Babylon who became the instrument of God's judgment on Judah. Besieged Jerusalem three times: deported Jehoiachin and the nobles in 597 BC, appointed Zedekiah, then when Zedekiah rebelled destroyed the Temple and city in 586 BC, deporting most of the population to Babylon. Appears also in Daniel, where he has a famous dream of a great statue, goes mad eating grass for seven years, and is finally restored.",
    tags: ["king", "antagonist"] });
}

// ── Relationships ─────────────────────────────────────────────────────────────
async function seedRelationships() {
  // ── Elijah → Elisha ───────────────────────────────────────────────────
  await insertRelByName("Elijah",   "mentor_of", "Elisha",       "Elijah called Elisha; Elisha received double portion (2 Kgs 2)");
  await insertRel("elisha",  "mentor_of", "gehazi",       "Gehazi served as Elisha's attendant (2 Kgs 4)");
  await insertRel("elisha",  "ally_of",   "naaman",       "Elisha healed Naaman of leprosy (2 Kgs 5)");
  await insertRel("gehazi",  "enemy_of",  "naaman",       "Gehazi lied to Naaman to get silver; received his leprosy");

  // ── Jehu revolution ───────────────────────────────────────────────────
  await insertRelByName("Elisha",   "mentor_of", "Jehu",         "Elisha commissioned Jehu's anointing (2 Kgs 9:1)");
  await insertRel("jehu",    "enemy_of",  "athaliah",     "Jehu killed Ahab's line; Athaliah seized throne in response");
  await insertRelByName("Jehu",     "enemy_of",  "Jezebel",      "Jehu had Jezebel thrown down and trampled (2 Kgs 9:33)");

  // ── Athaliah / Joash / Jehoiada ───────────────────────────────────────
  await insertRelByName("Ahab",     "parent_of", "Athaliah",     "Athaliah daughter of Ahab (2 Kgs 8:18)");
  await insertRelByName("Jezebel",  "parent_of", "Athaliah",     "Athaliah daughter of Jezebel (inferred from Ahab's line)");
  await insertRel("athaliah","enemy_of",   "joash_judah",  "Athaliah tried to destroy the royal family (2 Kgs 11:1)");
  await insertRel("jehoiada","ally_of",    "joash_judah",  "Hid and crowned Joash; guided his early reign (2 Kgs 11-12)");
  await insertRel("joash_judah","enemy_of","jehoiada",     "Joash had Jehoiada's son Zechariah stoned (2 Chr 24:21)");

  // ── Hezekiah era ──────────────────────────────────────────────────────
  await insertRelByName("Hezekiah","ally_of",    "Isaiah",       "Isaiah guided and prophesied to Hezekiah (2 Kgs 19-20)");
  await insertRel("sennacherib","enemy_of","hezekiah",     "Besieged Jerusalem; 185,000 struck by angel (2 Kgs 19)");
  await insertRel("hezekiah", "parent_of", "manasseh_king", "Manasseh son of Hezekiah (2 Kgs 21:1)");
  await insertRelByName("Solomon","ancestor_of", "Josiah",       "Josiah is in the Davidic line (2 Kgs 22:2)");
}

// ── Scripture references ───────────────────────────────────────────────────────
async function seedRefs() {
  await insertRef("elisha",        "2 Kings",  2,  1,  13, 21, "Miracles from Elijah's whirlwind to bones reviving the dead");
  await insertRef("gehazi",        "2 Kings",  4, 12,  8,  6, "Serves Elisha; lies to Naaman; struck with leprosy");
  await insertRef("naaman",        "2 Kings",  5,  1,  5, 27, "Healed of leprosy in the Jordan; confesses God of Israel");
  await insertRef("jehu",          "2 Kings",  9,  1, 10, 36, "Anointed; kills Joram, Ahaziah, Jezebel; destroys Baal");
  await insertRef("athaliah",      "2 Kings", 11,  1, 11, 20, "Seizes throne; hidden Joash; executed at horse gate");
  await insertRef("joash_judah",   "2 Kings", 11,  1, 12, 21, "Hid in Temple; crowned at 7; repairs Temple; assassinated");
  await insertRef("jehoiada",      "2 Kings", 11,  4, 12, 16, "Organized coup; crowned Joash; guided his reform");
  await insertRef("hezekiah",      "2 Kings", 18,  1, 20, 21, "Destroys idols; withstands Sennacherib; 15 extra years");
  await insertRef("isaiah",        "2 Kings", 19,  1, 20, 19, "Advises Hezekiah; announces deliverance and extra years");
  await insertRef("sennacherib",   "2 Kings", 18, 13, 19, 37, "Besieges Jerusalem; mocks God; 185,000 die; killed by sons");
  await insertRef("manasseh_king", "2 Kings", 21,  1, 21, 18, "55-year reign; most wicked king; fills Jerusalem with blood");
  await insertRef("josiah",        "2 Kings", 22,  1, 23, 30, "Finds Book of Law; greatest reform; Passover; dies at Megiddo");
  await insertRef("nebuchadnezzar","2 Kings", 24,  1, 25, 21, "Besieges Jerusalem; destroys Temple; exiles Judah to Babylon");
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Seeding 2 Kings people...");
  await seedPeople();
  console.log("Seeding 2 Kings relationships...");
  await seedRelationships();
  console.log("Seeding 2 Kings scripture references...");
  await seedRefs();

  const pc = await db.execute("SELECT COUNT(*) as c FROM people");
  const rc = await db.execute("SELECT COUNT(*) as c FROM relationships");
  const sc = await db.execute("SELECT COUNT(*) as c FROM scripture_refs");
  console.log(`\n✓ 2 Kings seed complete.`);
  console.log(`  Total people now: ${(pc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total relationships now: ${(rc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total scripture refs now: ${(sc.rows[0] as unknown as { c: number }).c}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
