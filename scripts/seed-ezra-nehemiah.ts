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

// ── People ────────────────────────────────────────────────────────────────────
async function seedPeople() {
  // ── Persian kings who shaped the return ───────────────────────────────
  await safeInsertPerson({ key: "cyrus", name: "Cyrus", alsoKnownAs: "Cyrus the Great, Cyrus king of Persia",
    gender: "male",
    description: "Founder of the Achaemenid Persian Empire. In his first year as king of Babylon (c. 538 BC) he issued a decree allowing exiled peoples — including the Jews — to return to their homelands and rebuild their temples. Isaiah had named him by name over a century earlier as God's 'anointed' (Isa 44:28–45:1). He returned the temple vessels Nebuchadnezzar had taken from Jerusalem and appointed Sheshbazzar to lead the first wave of returnees.",
    tags: ["king"] });

  await safeInsertPerson({ key: "darius_persia", name: "Darius", alsoKnownAs: "Darius king of Persia",
    gender: "male",
    description: "Darius I (the Great), king of Persia. When opponents challenged the returnees' right to build the Temple and asked him to search the royal archives, Darius found Cyrus's original decree and not only confirmed it but ordered the expenses to be paid from the royal treasury. Completed the Temple rebuilding was finished in his sixth year (516 BC). Not to be confused with Darius the Mede in Daniel.",
    tags: ["king"] });

  await safeInsertPerson({ key: "artaxerxes", name: "Artaxerxes", alsoKnownAs: "Artaxerxes I king of Persia",
    gender: "male",
    description: "Persian king who authorized both Ezra's mission (his seventh year, c. 458 BC) and Nehemiah's return to rebuild Jerusalem's walls (his twentieth year, c. 445 BC). Gave Ezra a royal letter granting silver, gold, and authority over the Trans-Euphrates province. Nehemiah served as his cupbearer and obtained permission to return to Judah as governor.",
    tags: ["king"] });

  // ── First return: Zerubbabel and Jeshua ───────────────────────────────
  await safeInsertPerson({ key: "sheshbazzar", name: "Sheshbazzar", alsoKnownAs: "Sheshbazzar prince of Judah",
    gender: "male",
    description: "Prince of Judah appointed by Cyrus to lead the first wave of returnees from Babylon (c. 537 BC) and entrusted with the gold and silver temple vessels. He laid the foundations of the Temple. Some scholars identify him with Zerubbabel; most treat them as separate individuals.",
    tags: ["leader", "tribe of israel"] });

  await safeInsertPerson({ key: "zerubbabel", name: "Zerubbabel",
    gender: "male",
    description: "Grandson of Jehoiachin (the exiled king of Judah), leader of the main wave of returnees and governor of Judah under the Persians. Together with Jeshua the high priest, he rebuilt the altar, restored the burnt offerings, and began rebuilding the Temple — work that stalled for years due to opposition and then resumed under Haggai and Zechariah's encouragement. Completed the Temple in 516 BC. He is named in both Davidic genealogies of Jesus (Matt 1:12-13; Luke 3:27).",
    tags: ["leader", "tribe of israel", "ancestor", "messianic line"] });

  await safeInsertPerson({ key: "jeshua_priest", name: "Jeshua", alsoKnownAs: "Joshua son of Jozadak, Joshua the high priest",
    gender: "male",
    description: "High priest who returned from Babylon with Zerubbabel. Together they rebuilt the altar and laid the Temple foundation. Figures prominently in Haggai and Zechariah's visions, where he represents the priestly line being cleansed and restored. Zechariah's vision shows him standing before the Angel of the Lord, accused by Satan, but declared clean and crowned.",
    tags: ["priest"] });

  // ── Ezra ──────────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "ezra", name: "Ezra",
    gender: "male",
    description: "Priest and skilled scribe in the Law of Moses who led the second wave of returnees from Babylon to Jerusalem (c. 458 BC). Artaxerxes granted him sweeping authority and resources. Shocked to find that many returned exiles — including priests and Levites — had married foreign women; led a public confession and dissolution of these marriages. Read the Law publicly to all the people from a wooden platform (Neh 8), causing them to weep. A pivotal figure in restoring Torah observance in the post-exilic community.",
    tags: ["priest", "scribe"] });

  // ── Nehemiah ──────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "nehemiah", name: "Nehemiah",
    gender: "male",
    description: "Son of Hacaliah, cupbearer to Artaxerxes I. When he heard that Jerusalem's walls remained rubble and her gates burned, he wept, fasted, and prayed. The king sent him to Judah as governor. Despite fierce opposition from Sanballat, Tobiah, and Geshem, he organized the rebuilding of Jerusalem's entire wall in 52 days — with workers building with one hand and holding a weapon with the other. Implemented economic reforms, forced creditors to return pledged land, and supervised the resettlement of Jerusalem. Served two terms as governor.",
    tags: ["leader"] });

  // ── Opponents ─────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "sanballat", name: "Sanballat", alsoKnownAs: "Sanballat the Horonite",
    gender: "male",
    description: "Horonite governor of Samaria, principal opponent of Nehemiah's wall-building project. Ridiculed the builders, conspired to attack Jerusalem, sent threatening letters, and tried to lure Nehemiah to a meeting to harm him. When the wall was completed in 52 days he was humiliated, 'for they realized that this work had been done with the help of our God.'",
    tags: ["antagonist"] });

  await safeInsertPerson({ key: "tobiah", name: "Tobiah", alsoKnownAs: "Tobiah the Ammonite",
    gender: "male",
    description: "Ammonite official who allied with Sanballat against Nehemiah. Mocked the wall: 'If a fox climbed up on it, he would break it down!' Had Jewish relatives and allies through marriage, and his letters were read in Jerusalem undermining Nehemiah. During Nehemiah's absence a room in the Temple courts was given to him; Nehemiah returned and threw all his household goods out.",
    tags: ["antagonist"] });

  await safeInsertPerson({ key: "geshem", name: "Geshem", alsoKnownAs: "Gashmu the Arab",
    gender: "male",
    description: "Arab chieftain who joined Sanballat and Tobiah in opposing the wall. Spread false rumors that Nehemiah was planning to make himself king. Tried to lure Nehemiah into a meeting in the plain of Ono. One of the three primary antagonists in Nehemiah.",
    tags: ["antagonist"] });
}

// ── Relationships ─────────────────────────────────────────────────────────────
async function seedRelationships() {
  await insertRel("cyrus",       "ally_of",   "sheshbazzar",  "Cyrus appointed Sheshbazzar to lead the first return (Ezra 1:8)");
  await insertRel("cyrus",       "ally_of",   "zerubbabel",   "Cyrus's decree enabled Zerubbabel's return");
  await insertRel("darius_persia","ally_of",  "zerubbabel",   "Darius confirmed Cyrus's decree; Temple finished in his 6th year");
  await insertRel("artaxerxes",  "ally_of",   "ezra",         "Granted Ezra sweeping authority and resources (Ezra 7)");
  await insertRel("artaxerxes",  "ally_of",   "nehemiah",     "Sent Nehemiah to rebuild Jerusalem's walls (Neh 2:6)");
  await insertRel("zerubbabel",  "ally_of",   "jeshua_priest","Led the return and Temple rebuilding together (Ezra 3-6)");
  await insertRel("nehemiah",    "enemy_of",  "sanballat",    "Sanballat opposed the wall-building at every turn");
  await insertRel("nehemiah",    "enemy_of",  "tobiah",       "Tobiah ridiculed and conspired against Nehemiah");
  await insertRel("nehemiah",    "enemy_of",  "geshem",       "Geshem spread false rumors of rebellion against Nehemiah");
  await insertRelByName("Ezra",  "ally_of",   "Nehemiah",     "Ezra read the Law at Nehemiah's great assembly (Neh 8)");

  // Zerubbabel is in the messianic line (grandson of Jehoiachin/Jeconiah)
  await insertRelByName("Solomon","ancestor_of","Zerubbabel",  "Zerubbabel in the Davidic genealogy (Matt 1:12-13)");
}

// ── Scripture references ───────────────────────────────────────────────────────
async function seedRefs() {
  await insertRef("cyrus",         "Ezra",       1,  1,  1,  8, "Decree to rebuild the Temple; returns vessels");
  await insertRef("cyrus",         "Isaiah",    44, 28, 45,  1, "Named by Isaiah 150+ years before his birth");
  await insertRef("darius_persia", "Ezra",       5,  5,  6, 15, "Finds Cyrus's decree; orders Temple completion funded");
  await insertRef("artaxerxes",    "Ezra",       7,  1,  7, 28, "Authorizes Ezra's mission with letter and resources");
  await insertRef("artaxerxes",    "Nehemiah",   2,  1,  2,  8, "Grants Nehemiah permission to rebuild Jerusalem's walls");
  await insertRef("sheshbazzar",   "Ezra",       1,  8,  1, 11, "Entrusted with temple vessels; leads first return");
  await insertRef("zerubbabel",    "Ezra",       2,  2,  6, 22, "Leads return; rebuilds altar and Temple foundation");
  await insertRef("zerubbabel",    "Haggai",     1,  1,  2, 23, "Urged by Haggai to rebuild; God's signet ring");
  await insertRef("zerubbabel",    "Zechariah",  4,  6,  4, 10, "Vision: Zerubbabel will complete the Temple");
  await insertRef("jeshua_priest", "Ezra",       2,  2,  6,  2, "High priest; rebuilds altar with Zerubbabel");
  await insertRef("jeshua_priest", "Haggai",     1,  1,  2,  4, "Commissioned alongside Zerubbabel");
  await insertRef("jeshua_priest", "Zechariah",  3,  1,  3,  9, "Vision: Joshua cleansed and crowned in Temple");
  await insertRef("ezra",          "Ezra",       7,  1, 10, 44, "Arrives from Babylon; foreign wife crisis; dissolution");
  await insertRef("ezra",          "Nehemiah",   8,  1,  8, 18, "Reads the Law publicly; people weep");
  await insertRef("nehemiah",      "Nehemiah",   1,  1, 13, 31, "Hears of Jerusalem; builds wall in 52 days; reforms");
  await insertRef("sanballat",     "Nehemiah",   2, 10, 13, 28, "Mocks, conspires, and plots against Nehemiah");
  await insertRef("tobiah",        "Nehemiah",   2, 10, 13,  9, "Ridicules the wall; uses Temple room expelled by Nehemiah");
  await insertRef("geshem",        "Nehemiah",   2, 19,  6, 14, "Spreads rumor of rebellion; lures Nehemiah to Ono");
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Seeding Ezra-Nehemiah people...");
  await seedPeople();
  console.log("Seeding Ezra-Nehemiah relationships...");
  await seedRelationships();
  console.log("Seeding Ezra-Nehemiah scripture references...");
  await seedRefs();

  const pc = await db.execute("SELECT COUNT(*) as c FROM people");
  const rc = await db.execute("SELECT COUNT(*) as c FROM relationships");
  const sc = await db.execute("SELECT COUNT(*) as c FROM scripture_refs");
  console.log(`\n✓ Ezra-Nehemiah seed complete.`);
  console.log(`  Total people now: ${(pc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total relationships now: ${(rc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total scripture refs now: ${(sc.rows[0] as unknown as { c: number }).c}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
