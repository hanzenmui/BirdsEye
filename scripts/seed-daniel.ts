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
  // ── The four young men ────────────────────────────────────────────────
  await safeInsertPerson({ key: "daniel", name: "Daniel", alsoKnownAs: "Belteshazzar",
    gender: "male",
    description: "Young man from Judah's royal or noble family, taken to Babylon by Nebuchadnezzar. Given the Babylonian name Belteshazzar. He and his three friends refused the king's food to avoid defilement; God gave them wisdom and Daniel the ability to understand visions and dreams. He interpreted Nebuchadnezzar's statue dream and wrote on the wall that appeared at Belshazzar's feast. Threw into a den of lions by Darius's officials for praying; God shut the lions' mouths. Received remarkable apocalyptic visions about four empires, the Ancient of Days, the Son of Man, and a seventy-weeks prophecy. A model of integrity, prayer, and courage across multiple empires.",
    tags: ["prophet", "tribe of israel"] });

  await safeInsertPerson({ key: "hananiah", name: "Hananiah", alsoKnownAs: "Shadrach",
    gender: "male",
    description: "Jewish exile from Judah, companion of Daniel. Given the Babylonian name Shadrach. Refused to worship Nebuchadnezzar's golden statue; thrown into a furnace heated seven times hotter than normal. Emerged unharmed without even the smell of smoke — a fourth figure walking with them in the fire was 'like a son of the gods.' Their survival caused Nebuchadnezzar to decree honor for their God.",
    tags: ["tribe of israel"] });

  await safeInsertPerson({ key: "mishael", name: "Mishael", alsoKnownAs: "Meshach",
    gender: "male",
    description: "Jewish exile from Judah, companion of Daniel. Given the Babylonian name Meshach. One of the three thrown into the fiery furnace for refusing to bow to Nebuchadnezzar's statue. God delivered all three through the furnace without any harm.",
    tags: ["tribe of israel"] });

  await safeInsertPerson({ key: "azariah", name: "Azariah", alsoKnownAs: "Abednego",
    gender: "male",
    description: "Jewish exile from Judah, companion of Daniel. Given the Babylonian name Abednego. One of the three thrown into the fiery furnace for refusing to bow to Nebuchadnezzar's statue. Spoke the great declaration: 'Our God whom we serve is able to deliver us from the burning fiery furnace… But if not, be it known to you, O king, that we will not serve your gods.' God delivered all three.",
    tags: ["tribe of israel"] });

  // ── Babylonian and Persian rulers ─────────────────────────────────────
  await safeInsertPerson({ key: "belshazzar", name: "Belshazzar",
    gender: "male",
    description: "Last Babylonian ruler mentioned in Daniel, son of Nabonidus (though Daniel calls him Nebuchadnezzar's son, likely in a dynastic sense). Held a great banquet using the gold and silver vessels taken from the Jerusalem Temple. A hand appeared and wrote 'MENE, MENE, TEKEL, PARSIN' on the wall. Daniel interpreted the words: the kingdom was numbered, weighed, and divided. That very night Belshazzar was slain and Darius the Mede received the kingdom.",
    tags: ["king", "antagonist"] });

  await safeInsertPerson({ key: "darius_mede", name: "Darius the Mede", alsoKnownAs: "Darius the Mede",
    gender: "male",
    description: "Ruler who received the kingdom after Belshazzar's death (Dan 5:31). His officials and satraps, jealous of Daniel, tricked him into signing a law forbidding prayer to anyone but the king for 30 days. When Daniel violated it, Darius was distressed but legally bound; he had Daniel thrown into the lions' den, then hurried there at dawn. When Daniel was found unharmed, Darius praised the God of Daniel and had his accusers thrown to the lions instead. His historical identity is debated.",
    tags: ["king"] });
}

// ── Relationships ─────────────────────────────────────────────────────────────
async function seedRelationships() {
  await insertRel("daniel",   "ally_of",   "hananiah",  "Companions in exile; refused king's food together (Dan 1)");
  await insertRel("daniel",   "ally_of",   "mishael",   "Companions in exile (Dan 1)");
  await insertRel("daniel",   "ally_of",   "azariah",   "Companions in exile (Dan 1)");
  await insertRel("hananiah", "ally_of",   "mishael",   "Together in fiery furnace (Dan 3)");
  await insertRel("hananiah", "ally_of",   "azariah",   "Together in fiery furnace (Dan 3)");

  await insertRelByName("Nebuchadnezzar","ruler_of","Daniel",   "Nebuchadnezzar took Daniel to Babylon (Dan 1:1-6)");
  await insertRel("belshazzar","enemy_of","daniel",    "Belshazzar desecrated the temple vessels; Daniel judged him");
  await insertRel("darius_mede","ruler_of","daniel",   "Daniel served under Darius; thrown to lions by jealous officials");

  // Nebuchadnezzar's fiery furnace
  await insertRelByName("Nebuchadnezzar","enemy_of","Hananiah","Ordered the three into the furnace (Dan 3:19-20)");
}

// ── Scripture references ───────────────────────────────────────────────────────
async function seedRefs() {
  await insertRef("daniel",     "Daniel",  1,  1, 12, 13, "Wisdom in Babylon; dreams; lions' den; apocalyptic visions");
  await insertRef("hananiah",   "Daniel",  1,  7,  3, 30, "Refuses food; fiery furnace; delivered unharmed");
  await insertRef("mishael",    "Daniel",  1,  7,  3, 30, "Refuses food; fiery furnace; delivered unharmed");
  await insertRef("azariah",    "Daniel",  1,  7,  3, 30, "Refuses food; 'but if not…'; fiery furnace; delivered");
  await insertRef("belshazzar", "Daniel",  5,  1,  5, 30, "Feast with temple vessels; writing on wall; slain that night");
  await insertRef("darius_mede","Daniel",  5, 31,  6, 28, "Receives kingdom; signs lion's den decree; praises God of Daniel");

  // Nebuchadnezzar refs for Daniel book (already seeded in 2 Kings)
  if (await loadExisting("neb", "Nebuchadnezzar")) {
    await insertRef("neb", "Daniel",  1,  1,  4, 37, "Dreams of statue and tree; madness for seven years; restored");
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Seeding Daniel people...");
  await seedPeople();
  console.log("Seeding Daniel relationships...");
  await seedRelationships();
  console.log("Seeding Daniel scripture references...");
  await seedRefs();

  const pc = await db.execute("SELECT COUNT(*) as c FROM people");
  const rc = await db.execute("SELECT COUNT(*) as c FROM relationships");
  const sc = await db.execute("SELECT COUNT(*) as c FROM scripture_refs");
  console.log(`\n✓ Daniel seed complete.`);
  console.log(`  Total people now: ${(pc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total relationships now: ${(rc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total scripture refs now: ${(sc.rows[0] as unknown as { c: number }).c}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
