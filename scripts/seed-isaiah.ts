// Isaiah: prophet's family and the kings of Judah under whom he served
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
  if (!bId) { console.warn(`  ⚠ Could not find ${bName} for link from ${aKey}`); return; }
  await db.execute({
    sql: `INSERT OR IGNORE INTO relationships (id,person_a_id,person_a_name,type,person_b_id,person_b_name,notes,created_at)
          VALUES (?,?,?,?,?,?,?,datetime('now'))`,
    args: [crypto.randomUUID(), id(aKey), names[aKey] ?? aKey, type, bId, bName, notes ?? ''],
  });
}

// ── Load cross-seed people ─────────────────────────────────────────────────────
async function loadCrossSeedPeople() {
  await loadExisting("isaiah", "Isaiah");
  await loadExisting("hezekiah", "Hezekiah");
}

// ── People ─────────────────────────────────────────────────────────────────────
async function seedPeople() {
  // Isaiah's father — mentioned in the book's opening verse
  await safeInsertPerson({
    key: "amoz",
    name: "Amoz",
    alsoKnownAs: "Amoz father of Isaiah",
    gender: "male",
    description: "Father of the prophet Isaiah, mentioned in the book's opening superscription.",
    tags: ["father", "OT"],
  });

  // Kings of Judah during Isaiah's ministry (Isaiah 1:1 names all four)
  await safeInsertPerson({
    key: "uzziah",
    name: "Uzziah",
    alsoKnownAs: "Uzziah king of Judah, Azariah king of Judah",
    gender: "male",
    description: "King of Judah whose death-year marked Isaiah's call vision (Isaiah 6:1). Also called Azariah; reigned ~792–740 BC.",
    tags: ["king", "judah", "OT"],
  });

  await safeInsertPerson({
    key: "jotham_judah",
    name: "Jotham",
    alsoKnownAs: "Jotham king of Judah, son of Uzziah",
    gender: "male",
    description: "Son of Uzziah, king of Judah ~740–732 BC. Mentioned in Isaiah 1:1 as one of the kings during Isaiah's ministry.",
    tags: ["king", "judah", "OT"],
  });

  await safeInsertPerson({
    key: "ahaz_judah",
    name: "Ahaz",
    alsoKnownAs: "Ahaz king of Judah, son of Jotham",
    gender: "male",
    description: "Son of Jotham, king of Judah ~732–716 BC. Isaiah brought him the Immanuel prophecy (Isaiah 7) but Ahaz refused to trust God and appealed to Assyria instead.",
    tags: ["king", "judah", "OT"],
  });

  // Isaiah's family
  await safeInsertPerson({
    key: "isaiah_wife",
    name: "Wife of Isaiah",
    alsoKnownAs: "the prophetess wife of Isaiah",
    gender: "female",
    description: "Isaiah's wife, called 'the prophetess' in Isaiah 8:3. Mother of Maher-shalal-hash-baz.",
    tags: ["prophetess", "OT"],
  });

  await safeInsertPerson({
    key: "shear_jashub",
    name: "Shear-Jashub",
    alsoKnownAs: "Shear-Jashub son of Isaiah",
    gender: "male",
    description: "Isaiah's son, whose symbolic name means 'A remnant shall return'. Accompanied Isaiah to meet King Ahaz (Isaiah 7:3).",
    tags: ["prophet's son", "OT"],
  });

  await safeInsertPerson({
    key: "maher_shalal",
    name: "Maher-shalal-hash-baz",
    alsoKnownAs: "Maher-shalal-hash-baz son of Isaiah",
    gender: "male",
    description: "Isaiah's second son, whose name means 'Swift is the booty, speedy is the prey'. Born as a prophetic sign of the imminent fall of Damascus and Samaria (Isaiah 8:1–4).",
    tags: ["prophet's son", "OT"],
  });
}

// ── Relationships ──────────────────────────────────────────────────────────────
async function seedRelationships() {
  // Isaiah's lineage
  await insertRel("amoz", "parent_of", "isaiah");

  // Judah's royal succession during Isaiah's ministry
  await insertRel("uzziah", "parent_of", "jotham_judah");
  await insertRel("jotham_judah", "parent_of", "ahaz_judah");
  // Ahaz → Hezekiah (Hezekiah is in 2kings seed)
  await insertRelLocalToName("ahaz_judah", "parent_of", "Hezekiah", "Father of king Hezekiah (2 Kgs 16)");

  // Isaiah's family
  await insertRel("isaiah", "spouse_of", "isaiah_wife");
  await insertRel("isaiah", "parent_of", "shear_jashub");
  await insertRel("isaiah", "parent_of", "maher_shalal");

  // Isaiah's ministry relationships
  // Isaiah was a close counselor to Hezekiah
  await insertRel("isaiah", "ally_of", "hezekiah",
    "Isaiah counseled Hezekiah and interceded for Jerusalem against Sennacherib (2 Kgs 19–20; Isaiah 36–39)");
  // Isaiah preached to Ahaz but was rejected
  await insertRel("isaiah", "other", "ahaz_judah",
    "Isaiah brought the Immanuel sign to Ahaz (Isaiah 7), but Ahaz refused to heed the prophecy");
}

// ── Scripture references ───────────────────────────────────────────────────────
async function seedRefs() {
  await insertRef("amoz", "Isaiah", 1, 1, 1, 1, "Father of Isaiah named in the book's superscription");
  await insertRef("uzziah", "Isaiah", 1, 1, 1, 1, "One of the kings during Isaiah's ministry");
  await insertRef("uzziah", "Isaiah", 6, 1, 6, 1, "Isaiah's call vision in the year Uzziah died");
  await insertRef("jotham_judah", "Isaiah", 1, 1, 1, 1, "One of the kings during Isaiah's ministry");
  await insertRef("ahaz_judah", "Isaiah", 1, 1, 1, 1, "One of the kings during Isaiah's ministry");
  await insertRef("ahaz_judah", "Isaiah", 7, 1, 7, 12, "Isaiah meets Ahaz with the Immanuel sign");
  await insertRef("isaiah_wife", "Isaiah", 8, 3, 8, 3, "Called 'the prophetess'; conceived Maher-shalal-hash-baz");
  await insertRef("shear_jashub", "Isaiah", 7, 3, 7, 3, "Accompanied Isaiah to meet King Ahaz at the conduit");
  await insertRef("maher_shalal", "Isaiah", 8, 1, 8, 4, "Born as a prophetic sign; name announced before Assyrian invasion");
}

async function main() {
  console.log("Seeding Isaiah...");
  await loadCrossSeedPeople();
  await seedPeople();
  console.log("  People done");
  await seedRelationships();
  console.log("  Relationships done");
  await seedRefs();
  console.log("  Scripture refs done");
  console.log("Isaiah seed complete.");
}

main().catch(console.error);
