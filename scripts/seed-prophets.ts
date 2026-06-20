// Covers: Jeremiah, Ezekiel, and all twelve minor prophets.
// Isaiah is already seeded in seed-2kings.ts.
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

async function loadExisting(key: string, name: string): Promise<boolean> {
  const dbId = await lookupId(name);
  if (!dbId) { console.warn(`  ⚠ ${name} not found in DB`); return false; }
  ids[key] = dbId; names[key] = name;
  return true;
}

// ── People ────────────────────────────────────────────────────────────────────
async function seedPeople() {
  // ── Jeremiah and associates ───────────────────────────────────────────
  await safeInsertPerson({ key: "jeremiah", name: "Jeremiah",
    gender: "male",
    description: "Son of Hilkiah, a priest from Anathoth in Benjamin. Called as a prophet in Josiah's thirteenth year; ministered through the reigns of Josiah, Jehoiakim, Jehoiachin, and Zedekiah into the early exile (c. 627–580 BC). The 'weeping prophet' — called to celibacy and public mourning as signs. Warned repeatedly that Judah would fall to Babylon and that resistance was futile. Dictated his prophecies to Baruch, who read them in the Temple. Thrown into a cistern to die; rescued by Ebed-melech. Witnessed the fall of Jerusalem. His New Covenant prophecy (Jer 31:31-34) is the most extensive in the Old Testament and is quoted in full in Hebrews.",
    tags: ["prophet"] });

  await safeInsertPerson({ key: "baruch", name: "Baruch", alsoKnownAs: "Baruch son of Neriah",
    gender: "male",
    description: "Son of Neriah, Jeremiah's secretary and loyal companion. Wrote Jeremiah's dictated words in a scroll and read them publicly in the Temple when Jeremiah was banned from entering. The scroll was burned by King Jehoiakim but rewritten. Baruch was given a personal oracle of comfort when he complained about his hardship. He preserved and transmitted the book of Jeremiah. Tradition holds he accompanied Jeremiah to Egypt.",
    tags: ["scribe"] });

  await safeInsertPerson({ key: "ebed_melech", name: "Ebed-melech",
    gender: "male",
    description: "Ethiopian (Cushite) eunuch in the royal palace who heard that Jeremiah had been thrown into a cistern to die of starvation. He interceded with King Zedekiah and received permission to rescue Jeremiah, letting down old rags and ropes for him to grip. God sent Jeremiah with a personal word of deliverance for Ebed-melech: because he trusted in God, he would not fall by the sword when Jerusalem fell.",
    tags: ["other"] });

  await safeInsertPerson({ key: "pashhur_jeremiah", name: "Pashhur", alsoKnownAs: "Pashhur son of Immer",
    gender: "male",
    description: "Chief officer in the Temple, son of Immer. Had Jeremiah beaten and put in stocks at the Upper Gate for prophesying Jerusalem's destruction. Jeremiah renamed him 'Magor-Missabib' (terror on every side) and prophesied he would die in Babylon. A different Pashhur son of Malchijah also appears in Jeremiah as an opponent.",
    tags: ["priest", "antagonist"] });

  // ── Ezekiel ───────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "ezekiel", name: "Ezekiel",
    gender: "male",
    description: "Son of Buzi, a priest who was exiled to Babylon with King Jehoiachin in 597 BC. Called to be a prophet among the exiles by the Chebar canal. Received the most visually spectacular prophetic visions in the Bible — the four living creatures and the wheel within a wheel (the divine chariot-throne), the valley of dry bones, the new Temple. Performed many acted signs: lay on his side for 430 days, shaved his head, cooked with dung. His wife died suddenly as a sign that he must not mourn publicly. Prophesied both judgment on Jerusalem and future restoration of Israel.",
    tags: ["prophet", "priest"] });

  // ── Major prophets also in the historical books ────────────────────────
  // Isaiah already seeded; Jeremiah and Ezekiel covered above.

  // ── Hosea ─────────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "hosea", name: "Hosea", alsoKnownAs: "Hosea son of Beeri",
    gender: "male",
    description: "Son of Beeri, prophet in the northern kingdom of Israel during the final decades before its fall to Assyria (c. 750–722 BC). God commanded him to marry a promiscuous woman as a living metaphor of Israel's unfaithfulness. His message alternates between anguished judgment and tender promises of restoration. Coined the phrase 'steadfast love (hesed) and not sacrifice' (Hos 6:6) — quoted twice by Jesus.",
    tags: ["prophet"] });

  await safeInsertPerson({ key: "gomer", name: "Gomer", alsoKnownAs: "Gomer daughter of Diblaim",
    gender: "female",
    description: "Daughter of Diblaim, the promiscuous woman Hosea was commanded by God to marry. She bore him three children with symbolic names: Jezreel, Lo-ruhamah ('not loved'), and Lo-ammi ('not my people'). Apparently left Hosea and was later bought back by him from slavery — a living drama of God's relentless pursuit of unfaithful Israel.",
    tags: ["other"] });

  // ── Joel ──────────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "joel", name: "Joel", alsoKnownAs: "Joel son of Pethuel",
    gender: "male",
    description: "Son of Pethuel; prophet to Judah. His book centers on a devastating locust plague interpreted as a foretaste of the Day of the Lord, followed by a call to repentance and a promise of restoration. His prophecy that God would pour out his Spirit on all flesh (Joel 2:28-32) was cited by Peter on the day of Pentecost as being fulfilled.",
    tags: ["prophet"] });

  // ── Amos ──────────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "amos", name: "Amos",
    gender: "male",
    description: "Shepherd from Tekoa in Judah and dresser of sycamore figs, not a professional prophet. Called by God to prophesy to the northern kingdom of Israel during Jeroboam II's prosperous reign (c. 760 BC). Thundered against the exploitation of the poor, corrupt courts, and empty religious ceremony. 'Let justice roll down like waters, and righteousness like an ever-flowing stream.' Opposed and expelled by the priest Amaziah at Bethel.",
    tags: ["prophet"] });

  // ── Obadiah ───────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "obadiah_prophet", name: "Obadiah", alsoKnownAs: "Obadiah the prophet",
    gender: "male",
    description: "Author of the shortest book in the Old Testament (21 verses), entirely a vision against Edom — Judah's treacherous neighbor who gloated over Jerusalem's fall and helped the Babylonians. Prophesied Edom's complete destruction and the eventual restoration of Israel. Not to be confused with Obadiah steward of Ahab. Date is uncertain but likely shortly after 586 BC.",
    tags: ["prophet"] });

  // ── Jonah ─────────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "jonah", name: "Jonah", alsoKnownAs: "Jonah son of Amittai",
    gender: "male",
    description: "Son of Amittai, from Gath-hepher in Zebulun (mentioned in 2 Kings 14:25 as prophesying during Jeroboam II's reign). Called by God to preach repentance to Nineveh, the Assyrian capital. Fled by ship to Tarshish; a great storm arose; cast into the sea at his own request and swallowed by a great fish for three days and nights. Prayed from the fish's belly; was vomited onto land. Preached to Nineveh; the entire city repented and God relented from the judgment. Jonah was angry at God's mercy toward Israel's enemies. God's response forms the book's climax: 'Should I not have concern for the great city of Nineveh?' Jesus cited Jonah's three days as a sign of his own death and resurrection.",
    tags: ["prophet"] });

  // ── Micah ─────────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "micah", name: "Micah", alsoKnownAs: "Micah of Moresheth",
    gender: "male",
    description: "Prophet from Moresheth-Gath in Judah, contemporary of Isaiah, during the reigns of Jotham, Ahaz, and Hezekiah (c. 735–700 BC). Prophesied against both Samaria and Jerusalem for social injustice and corrupt leadership. Famous for two of the most cited OT prophecies: the birth of a ruler in Bethlehem Ephrathah (Mic 5:2 — quoted by the chief priests to Herod about Jesus's birthplace) and the summary of true religion: 'to do justice, love kindness, and walk humbly with your God' (Mic 6:8).",
    tags: ["prophet"] });

  // ── Nahum ─────────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "nahum", name: "Nahum", alsoKnownAs: "Nahum the Elkoshite",
    gender: "male",
    description: "Prophet from Elkosh. His entire short book is an oracle against Nineveh, the Assyrian capital — a century after Jonah had preached there and the city had briefly repented. Prophesied Nineveh's complete and permanent destruction. The city fell to Babylon and the Medes in 612 BC exactly as described, and was so thoroughly destroyed it was not rediscovered until the 19th century.",
    tags: ["prophet"] });

  // ── Habakkuk ──────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "habakkuk", name: "Habakkuk",
    gender: "male",
    description: "Prophet in Judah, probably during Jehoiakim's reign (c. 605 BC). Uniquely, his book is structured as a dialogue with God: Habakkuk complains that God is silent while injustice reigns; God answers that the Babylonians will come as his instrument; Habakkuk complains that using Babylon is unjust; God declares 'the righteous shall live by faith' (Hab 2:4 — quoted in Romans, Galatians, and Hebrews). The book ends with one of the most beautiful expressions of faith in the Bible: 'Though the fig tree does not blossom…yet I will rejoice in the Lord.'",
    tags: ["prophet"] });

  // ── Zephaniah ─────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "zephaniah", name: "Zephaniah",
    gender: "male",
    description: "Prophet in Judah during Josiah's reign (c. 640–630 BC), with a remarkably long genealogy tracing him back four generations to Hezekiah, suggesting royal lineage. Prophesied a sweeping Day of the Lord judgment on Judah, the nations, and ultimately the whole earth. Also proclaimed a beautiful promise of restoration: God will rejoice over his people with singing (Zeph 3:17).",
    tags: ["prophet"] });

  // ── Haggai ────────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "haggai", name: "Haggai",
    gender: "male",
    description: "Post-exilic prophet who delivered four oracles in a four-month period during the second year of Darius I (520 BC). The returned exiles had stopped rebuilding the Temple and were focused on their own paneled houses. Haggai challenged them: 'Give careful thought to your ways.' Under his and Zechariah's preaching, Zerubbabel and Jeshua resumed the work and completed the Temple in 516 BC.",
    tags: ["prophet"] });

  // ── Zechariah ─────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "zechariah_prophet", name: "Zechariah", alsoKnownAs: "Zechariah son of Berechiah",
    gender: "male",
    description: "Son of Berechiah, grandson of Iddo; post-exilic prophet contemporary with Haggai (520–518 BC and beyond). His book contains eight night visions including the flying scroll, the four chariots, and Joshua the high priest crowned. Prophesied the coming of the Branch (Messiah), the entry into Jerusalem on a donkey (Zech 9:9 — fulfilled by Jesus on Palm Sunday), thirty pieces of silver (Zech 11:12-13), the piercing (Zech 12:10 — referenced at the crucifixion), and the Mount of Olives split (Zech 14:4).",
    tags: ["prophet"] });

  // ── Malachi ───────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "malachi", name: "Malachi",
    gender: "male",
    description: "The last of the Old Testament prophets (c. 430 BC), writing after the Temple had been rebuilt and the community had grown spiritually lax. Structured as a series of disputations between God and the people. Rebuked corrupt priesthood, faithless worship, divorce, and neglect of tithes. Promised the 'messenger of the covenant' (Mal 3:1 — identified by Jesus as referring to John the Baptist), and closed with the prophecy of 'Elijah' returning before 'the great and terrible Day of the Lord' (Mal 4:5-6 — also applied to John the Baptist). The last word of the Old Testament canon.",
    tags: ["prophet"] });
}

// ── Relationships ─────────────────────────────────────────────────────────────
async function seedRelationships() {
  // ── Jeremiah's associates ──────────────────────────────────────────────
  await insertRel("jeremiah", "mentor_of",  "baruch",          "Baruch was Jeremiah's scribe and companion (Jer 36)");
  await insertRel("ebed_melech","ally_of",  "jeremiah",        "Rescued Jeremiah from the cistern (Jer 38:7-13)");
  await insertRel("pashhur_jeremiah","enemy_of","jeremiah",    "Beat and imprisoned Jeremiah; called 'terror on every side'");

  await insertRelByName("Josiah",   "ally_of",  "Jeremiah",    "Jeremiah called in Josiah's 13th year; mourned his death");
  await insertRelByName("Nebuchadnezzar","enemy_of","Jeremiah","Jeremiah prophesied Nebuchadnezzar's conquest of Jerusalem");

  // ── Hosea / Gomer ─────────────────────────────────────────────────────
  await insertRel("hosea", "spouse_of", "gomer", "God commanded Hosea to marry Gomer as a sign of Israel's unfaithfulness (Hos 1:2)");

  // ── Minor prophets → opponents ─────────────────────────────────────────
  await insertRelByName("Jeroboam","enemy_of","Amos",
    "Amaziah expelled Amos from Bethel on Jeroboam's behalf (Amos 7:10)");

  // ── Post-exilic prophets → leaders they served with ───────────────────
  await insertRelByName("Zerubbabel","ally_of","Haggai",      "Haggai's words stirred Zerubbabel to rebuild (Hag 1:12)");
  await insertRelByName("Zerubbabel","ally_of","Zechariah",   "Both prophets encouraged Zerubbabel (Ezra 5:1-2)");
  await insertRelByName("Jeshua",   "ally_of","Haggai",       "Jeshua resumed building in response to Haggai (Hag 1:12)");
  await insertRelByName("Jeshua",   "ally_of","Zechariah",    "Zechariah's visions center on Jeshua the high priest (Zech 3)");
}

// ── Scripture references ───────────────────────────────────────────────────────
async function seedRefs() {
  // ── Jeremiah ──────────────────────────────────────────────────────────
  await insertRef("jeremiah",          "Jeremiah",  1,  1, 52, 34, "40+ years of prophecy; new covenant; cistern; Egypt");
  await insertRef("baruch",            "Jeremiah", 36,  1, 45,  5, "Writes, reads, and preserves Jeremiah's scroll");
  await insertRef("ebed_melech",       "Jeremiah", 38,  7, 39, 18, "Rescues Jeremiah from cistern; promised personal safety");
  await insertRef("pashhur_jeremiah",  "Jeremiah", 20,  1, 20,  6, "Beats and stocks Jeremiah; named 'terror on every side'");

  // Also add 2 Kings refs for Jeremiah (briefly mentioned)
  if (await loadExisting("jer_2k", "Jeremiah")) {
    // loadExisting already maps ids["jer_2k"] = Jeremiah's id
  }

  // ── Ezekiel ───────────────────────────────────────────────────────────
  await insertRef("ezekiel",    "Ezekiel",  1,  1, 48, 35, "Chariot vision; acted signs; judgments; new Temple; dry bones");

  // ── Add Isaiah's own book ref (already seeded in 2 Kings) ────────────
  if (await loadExisting("isaiah", "Isaiah")) {
    await insertRef("isaiah", "Isaiah",  1,  1, 66, 24, "Holiness of God; Immanuel; servant songs; messianic prophecies");
  }

  // ── Hosea ─────────────────────────────────────────────────────────────
  await insertRef("hosea",  "Hosea",  1,  1, 14,  9, "Marriage to Gomer; covenant lawsuit; 'steadfast love not sacrifice'");
  await insertRef("gomer",  "Hosea",  1,  3,  3,  3, "Commanded marriage; symbolic children; bought back");

  // ── Joel ──────────────────────────────────────────────────────────────
  await insertRef("joel",   "Joel",   1,  1,  3, 21, "Locust plague; Day of the Lord; Spirit poured on all flesh");

  // ── Amos ──────────────────────────────────────────────────────────────
  await insertRef("amos",   "Amos",   1,  1,  9, 15, "Oracles against nations; justice over ritual; visions of judgment");

  // ── Obadiah ───────────────────────────────────────────────────────────
  await insertRef("obadiah_prophet","Obadiah",1,  1,  1, 21, "Vision against Edom; destruction of Esau's house");

  // ── Jonah ─────────────────────────────────────────────────────────────
  await insertRef("jonah",  "Jonah",  1,  1,  4, 11, "Flees to Tarshish; great fish; Nineveh repents; God's mercy");
  await insertRef("jonah",  "2 Kings",14, 25, 14, 25, "Prophesied Jeroboam II's restoration of Israel's borders");

  // ── Micah ─────────────────────────────────────────────────────────────
  await insertRef("micah",  "Micah",  1,  1,  7, 20, "Bethlehem prophecy; justice/kindness/humility; lament and hope");

  // ── Nahum ─────────────────────────────────────────────────────────────
  await insertRef("nahum",  "Nahum",  1,  1,  3, 19, "Oracle against Nineveh; complete destruction foretold");

  // ── Habakkuk ──────────────────────────────────────────────────────────
  await insertRef("habakkuk","Habakkuk",1, 1,  3, 19, "Dialogue with God; 'righteous live by faith'; prayer of trust");

  // ── Zephaniah ─────────────────────────────────────────────────────────
  await insertRef("zephaniah","Zephaniah",1,1, 3, 20, "Day of the Lord; judgment of nations; rejoicing over his people");

  // ── Haggai ────────────────────────────────────────────────────────────
  await insertRef("haggai", "Haggai", 1,  1,  2, 23, "Four oracles; Temple rebuilding resumed; Zerubbabel as signet ring");

  // ── Zechariah ─────────────────────────────────────────────────────────
  await insertRef("zechariah_prophet","Zechariah",1,1,14,21,"Eight visions; Branch; king on donkey; 30 silver; piercing");

  // ── Malachi ───────────────────────────────────────────────────────────
  await insertRef("malachi","Malachi", 1,  1,  4,  6, "Disputations; messenger of covenant; tithes; Elijah to come");
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Seeding Prophets people...");
  await seedPeople();
  console.log("Seeding Prophets relationships...");
  await seedRelationships();
  console.log("Seeding Prophets scripture references...");
  await seedRefs();

  const pc = await db.execute("SELECT COUNT(*) as c FROM people");
  const rc = await db.execute("SELECT COUNT(*) as c FROM relationships");
  const sc = await db.execute("SELECT COUNT(*) as c FROM scripture_refs");
  console.log(`\n✓ Prophets seed complete.`);
  console.log(`  Total people now: ${(pc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total relationships now: ${(rc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total scripture refs now: ${(sc.rows[0] as unknown as { c: number }).c}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
