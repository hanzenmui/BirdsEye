// Wisdom books: Proverbs, Ecclesiastes, Song of Solomon — named characters and cross-links
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

async function loadExisting(key: string, name: string): Promise<boolean> {
  const r = await db.execute({ sql: "SELECT id FROM people WHERE name = ? LIMIT 1", args: [name] });
  const row = r.rows[0] as unknown as { id: string } | undefined;
  if (row) { ids[key] = row.id; names[key] = name; return true; }
  console.warn(`  ⚠ Could not find existing person: ${name}`);
  return false;
}

// ── Load cross-seed people ─────────────────────────────────────────────────────
async function loadCrossSeedPeople() {
  await loadExisting("solomon", "Solomon");
  await loadExisting("david", "David");
}

// ── People ─────────────────────────────────────────────────────────────────────
async function seedPeople() {
  // ── Proverbs ──────────────────────────────────────────────────────────────

  await safeInsertPerson({
    key: "agur",
    name: "Agur",
    alsoKnownAs: "Agur son of Jakeh",
    gender: "male",
    description: "Sage who authored Proverbs 30. Opens with profound humility: 'I am the most ignorant of men; I do not have human wisdom.' His oracle contains numerical proverbs about things that are never satisfied. Identity uncertain; some traditions link him to Solomon.",
    tags: ["sage", "wisdom", "OT"],
  });

  await safeInsertPerson({
    key: "lemuel",
    name: "Lemuel",
    alsoKnownAs: "King Lemuel",
    gender: "male",
    description: "King whose mother taught him wisdom that became Proverbs 31. 'The sayings of King Lemuel — an oracle his mother taught him.' His chapter ends with the famous description of the wife of noble character. Identity uncertain; possibly another name for Solomon.",
    tags: ["king", "sage", "wisdom", "OT"],
  });

  await safeInsertPerson({
    key: "lemuel_mother",
    name: "Mother of Lemuel",
    alsoKnownAs: "mother of King Lemuel",
    gender: "female",
    description: "Queen mother who taught King Lemuel the wisdom recorded in Proverbs 31:1–31. Her teaching opens with warnings against women and wine, and closes with the celebrated poem about the excellent wife.",
    tags: ["queen mother", "sage", "wisdom", "OT"],
  });

  // ── Song of Solomon ────────────────────────────────────────────────────────

  await safeInsertPerson({
    key: "shulamite",
    name: "Shulamite",
    alsoKnownAs: "the beloved, the Shulamite woman",
    gender: "female",
    description: "The unnamed beloved woman who speaks throughout the Song of Solomon. Called 'the Shulamite' in 6:13 (possibly from Shunem). Her words make up much of the book; she is described as dark but lovely, a keeper of vineyards, longing for her lover.",
    tags: ["beloved", "poetry", "OT"],
  });

  await safeInsertPerson({
    key: "daughters_jerusalem",
    name: "Daughters of Jerusalem",
    alsoKnownAs: "daughters of Jerusalem in Song of Solomon",
    gender: "female",
    description: "The chorus in the Song of Solomon who hear the Shulamite's expressions of longing and love. Addressed repeatedly by the beloved as a literary device (Song 1:5; 2:7; 3:5; 5:8; 8:4).",
    tags: ["chorus", "poetry", "OT"],
  });
}

// ── Relationships ──────────────────────────────────────────────────────────────
async function seedRelationships() {
  // Proverbs
  // Solomon authored most of Proverbs (ch 1–29) — he already has refs to Proverbs
  await insertRel("agur", "other", "solomon", "Both contribute wisdom to Proverbs; Agur's oracle follows Solomon's collections");
  await insertRel("lemuel", "other", "solomon", "Lemuel may be another name for Solomon or a contemporary king");
  await insertRel("lemuel_mother", "mentor_of", "lemuel", "Lemuel's mother was his primary wisdom teacher (Prov 31:1)");

  // Song of Solomon
  await insertRel("shulamite", "spouse_of", "solomon", "The Song of Solomon is framed as a love song between the Shulamite and Solomon");
}

// ── Scripture references ───────────────────────────────────────────────────────
async function seedRefs() {
  // Solomon — existing person, add wisdom book refs
  await insertRef("solomon", "Proverbs", 1, 1, 9, 18, "Proverbs of Solomon (chapters 1–9, collected intro)");
  await insertRef("solomon", "Proverbs", 10, 1, 22, 16, "Proverbs of Solomon (chapters 10–22:16)");
  await insertRef("solomon", "Proverbs", 25, 1, 29, 27, "More proverbs of Solomon, copied by Hezekiah's men");
  await insertRef("solomon", "Ecclesiastes", 1, 1, 12, 14, "Ecclesiastes: the Preacher, son of David, king in Jerusalem");
  await insertRef("solomon", "Song of Solomon", 1, 1, 8, 14, "Song of Solomon, attributed to Solomon");

  // Psalms by David — add key psalm refs to existing David
  await insertRef("david", "Psalms", 23, 1, 23, 6, "Psalm 23: The Lord is my shepherd");
  await insertRef("david", "Psalms", 22, 1, 22, 31, "Psalm 22: My God, my God, why have you forsaken me");
  await insertRef("david", "Psalms", 51, 1, 51, 19, "Psalm 51: Create in me a clean heart (after Bathsheba)");
  await insertRef("david", "Psalms", 110, 1, 110, 7, "Psalm 110: The LORD said to my Lord (Messianic)");

  // Proverbs people
  await insertRef("agur", "Proverbs", 30, 1, 30, 33, "The oracle of Agur son of Jakeh");
  await insertRef("lemuel", "Proverbs", 31, 1, 31, 31, "The sayings of King Lemuel taught by his mother");
  await insertRef("lemuel_mother", "Proverbs", 31, 1, 31, 31, "The mother of Lemuel who taught him wisdom");

  // Song of Solomon
  await insertRef("shulamite", "Song of Solomon", 1, 1, 8, 14, "The beloved throughout the Song of Solomon");
  await insertRef("daughters_jerusalem", "Song of Solomon", 1, 5, 1, 5, "Daughters of Jerusalem addressed first in Song 1:5");
  await insertRef("daughters_jerusalem", "Song of Solomon", 2, 7, 2, 7, "Do not stir up love until it pleases (refrain)");
  await insertRef("daughters_jerusalem", "Song of Solomon", 5, 8, 5, 8, "Daughters of Jerusalem asked to find the beloved");
}

async function main() {
  console.log("Seeding Wisdom books...");
  await loadCrossSeedPeople();
  await seedPeople();
  console.log("  People done");
  await seedRelationships();
  console.log("  Relationships done");
  await seedRefs();
  console.log("  Scripture refs done");
  console.log("Wisdom seed complete.");
}

main().catch(console.error);
