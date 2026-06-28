// Late kings of Judah: Jehoahaz, Jehoiakim, Jehoiachin, Zedekiah + Shealtiel
// Fills the final gap in the Judah succession chain and completes the Adam→Jesus lineage
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

async function loadExisting(key: string, name: string): Promise<boolean> {
  const r = await db.execute({ sql: "SELECT id FROM people WHERE name = ? LIMIT 1", args: [name] });
  const row = r.rows[0] as unknown as { id: string } | undefined;
  if (row) { ids[key] = row.id; names[key] = name; return true; }
  console.warn(`  ⚠ Could not find existing person: ${name}`);
  return false;
}

async function insertRelLocalToName(aKey: string, type: string, bName: string, notes?: string) {
  const bId = await lookupId(bName);
  if (!bId) { console.warn(`  ⚠ Could not find ${bName}`); return; }
  await db.execute({
    sql: `INSERT OR IGNORE INTO relationships (id,person_a_id,person_a_name,type,person_b_id,person_b_name,notes,created_at)
          VALUES (?,?,?,?,?,?,?,datetime('now'))`,
    args: [crypto.randomUUID(), id(aKey), names[aKey] ?? aKey, type, bId, bName, notes ?? ''],
  });
}

// ── Load cross-seed people ─────────────────────────────────────────────────────
async function loadCrossSeedPeople() {
  await loadExisting("josiah", "Josiah");
  await loadExisting("nebuchadnezzar", "Nebuchadnezzar");
  await loadExisting("zerubbabel", "Zerubbabel");
}

// ── People ─────────────────────────────────────────────────────────────────────
async function seedPeople() {
  // Sons of Josiah who ruled Judah in the final generation before exile

  await safeInsertPerson({
    key: "jehoahaz",
    name: "Jehoahaz",
    alsoKnownAs: "Jehoahaz king of Judah, Shallum son of Josiah",
    gender: "male",
    description: "Son of Josiah and briefly king of Judah (~609 BC, reigned 3 months). Pharaoh Neco deposed him, took him to Egypt in chains, and replaced him with his brother Jehoiakim. He died in Egypt (2 Kgs 23:31–34; 2 Chr 36:1–4; Jer 22:10–12).",
    tags: ["king", "judah", "exile", "OT"],
  });

  await safeInsertPerson({
    key: "jehoiakim",
    name: "Jehoiakim",
    alsoKnownAs: "Jehoiakim king of Judah, Eliakim son of Josiah",
    gender: "male",
    description: "Son of Josiah; his name was changed from Eliakim to Jehoiakim by Pharaoh Neco when he was installed as a vassal king (~609–598 BC). Burned Jeremiah's scroll and persecuted the prophet. Became Nebuchadnezzar's vassal, then rebelled; died before Babylon could punish him (2 Kgs 23:34–24:7; 2 Chr 36:5–8; Jer 36).",
    tags: ["king", "judah", "exile", "OT"],
  });

  await safeInsertPerson({
    key: "jehoiachin",
    name: "Jehoiachin",
    alsoKnownAs: "Jehoiachin king of Judah, Jeconiah, Coniah",
    gender: "male",
    description: "Son of Jehoiakim, king of Judah for only 3 months (~598 BC) before surrendering to Nebuchadnezzar. Taken to Babylon with the cream of Judah's population. Eventually released from prison by Evil-merodach after 37 years. Ancestor of Jesus through the Matthew genealogy (2 Kgs 24:8–17; 25:27–30; Matt 1:11–12).",
    tags: ["king", "judah", "exile", "OT"],
  });

  await safeInsertPerson({
    key: "zedekiah",
    name: "Zedekiah",
    alsoKnownAs: "Zedekiah king of Judah, Mattaniah son of Josiah",
    gender: "male",
    description: "Youngest son of Josiah, Judah's last king (~597–586 BC). Installed by Nebuchadnezzar, his name changed from Mattaniah. Rebelled against Babylon despite warnings from Jeremiah; Jerusalem was besieged and destroyed. His sons were killed before his eyes, then he was blinded and taken to Babylon in chains (2 Kgs 24:17–25:7; 2 Chr 36:11–21; Jer 52).",
    tags: ["king", "judah", "exile", "OT"],
  });

  // Shealtiel: son of Jehoiachin, father of Zerubbabel — the bridge in the Matthew genealogy
  await safeInsertPerson({
    key: "shealtiel",
    name: "Shealtiel",
    alsoKnownAs: "Shealtiel son of Jeconiah, Salathiel",
    gender: "male",
    description: "Son of Jehoiachin (Jeconiah) and father of Zerubbabel. A key link in the Matthew genealogy bridging the Babylonian exile to the return and the eventual line of Joseph, husband of Mary (Matt 1:12; 1 Chr 3:17; Ezra 3:2).",
    tags: ["exile", "lineage", "OT"],
  });
}

// ── Relationships ──────────────────────────────────────────────────────────────
async function seedRelationships() {
  // Josiah's sons — all are siblings who each briefly ruled
  await insertRel("josiah", "parent_of", "jehoahaz", "Josiah's son, made king by the people after Josiah's death");
  await insertRel("josiah", "parent_of", "jehoiakim", "Josiah's son, installed by Pharaoh Neco as vassal");
  await insertRel("josiah", "parent_of", "zedekiah", "Josiah's youngest son, Judah's last king");
  await insertRel("jehoahaz", "sibling_of", "jehoiakim", "Brothers, sons of Josiah; Jehoiakim replaced Jehoahaz on the throne");
  await insertRel("jehoahaz", "sibling_of", "zedekiah", "Brothers, sons of Josiah");
  await insertRel("jehoiakim", "sibling_of", "zedekiah", "Brothers, sons of Josiah");

  // Succession
  await insertRel("jehoiakim", "parent_of", "jehoiachin", "Jehoiachin, also called Jeconiah, succeeded his father Jehoiakim");

  // Jehoiachin → Shealtiel → Zerubbabel (Matthew genealogy chain)
  await insertRel("jehoiachin", "parent_of", "shealtiel", "Shealtiel was son of Jeconiah (Matt 1:12; 1 Chr 3:17)");
  await insertRelLocalToName("shealtiel", "parent_of", "Zerubbabel",
    "Zerubbabel was son of Shealtiel (Matt 1:12; Ezra 3:2; Hag 1:1)");

  // Relationships with Nebuchadnezzar
  await insertRel("nebuchadnezzar", "ruler_of", "jehoiakim", "Jehoiakim became Nebuchadnezzar's vassal (2 Kgs 24:1)");
  await insertRel("nebuchadnezzar", "ruler_of", "jehoiachin", "Nebuchadnezzar took Jehoiachin captive to Babylon (2 Kgs 24:12–15)");
  await insertRel("nebuchadnezzar", "ruler_of", "zedekiah", "Zedekiah was installed and controlled by Nebuchadnezzar (2 Kgs 24:17)");

  // Jeremiah's relationship with the last kings
  await insertRelLocalToName("jehoiakim", "enemy_of", "Jeremiah",
    "Jehoiakim burned Jeremiah's scroll and sought to arrest him (Jer 36:21–26)");
}

// ── Scripture references ───────────────────────────────────────────────────────
async function seedRefs() {
  await insertRef("jehoahaz", "2 Kings", 23, 31, 23, 34, "Reign of Jehoahaz; deposed by Pharaoh Neco");
  await insertRef("jehoahaz", "2 Chronicles", 36, 1, 36, 4, "Jehoahaz's brief reign in Chronicles");
  await insertRef("jehoahaz", "Jeremiah", 22, 10, 22, 12, "Jeremiah weeps for Jehoahaz taken to Egypt");

  await insertRef("jehoiakim", "2 Kings", 23, 34, 24, 7, "Reign of Jehoiakim");
  await insertRef("jehoiakim", "2 Chronicles", 36, 5, 36, 8, "Jehoiakim in Chronicles");
  await insertRef("jehoiakim", "Jeremiah", 36, 1, 36, 32, "Jehoiakim burns Jeremiah's scroll");

  await insertRef("jehoiachin", "2 Kings", 24, 8, 24, 17, "Jehoiachin surrenders to Nebuchadnezzar");
  await insertRef("jehoiachin", "2 Kings", 25, 27, 25, 30, "Released from prison by Evil-merodach after 37 years");
  await insertRef("jehoiachin", "Matthew", 1, 11, 1, 12, "Jeconiah in the Matthew genealogy: the exile generation");

  await insertRef("zedekiah", "2 Kings", 24, 17, 25, 7, "Zedekiah's reign and Jerusalem's fall");
  await insertRef("zedekiah", "2 Chronicles", 36, 11, 36, 21, "Zedekiah's stubbornness and Jerusalem's destruction");
  await insertRef("zedekiah", "Jeremiah", 52, 1, 52, 11, "Zedekiah's capture and blinding");

  await insertRef("shealtiel", "Matthew", 1, 12, 1, 12, "Shealtiel father of Zerubbabel in Matthew's genealogy");
  await insertRef("shealtiel", "Ezra", 3, 2, 3, 2, "Shealtiel mentioned as Zerubbabel's father at the altar dedication");
  await insertRef("shealtiel", "1 Chronicles", 3, 17, 3, 17, "Shealtiel listed as Jeconiah's son");
}

async function main() {
  console.log("Seeding late kings of Judah...");
  await loadCrossSeedPeople();
  await seedPeople();
  console.log("  People done");
  await seedRelationships();
  console.log("  Relationships done");
  await seedRefs();
  console.log("  Scripture refs done");
  console.log("Late kings seed complete.");
}

main().catch(console.error);
