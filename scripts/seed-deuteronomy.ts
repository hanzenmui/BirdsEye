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

// Inserts only when not already in DB (matches on name + also_known_as when set).
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

// Looks up an existing person by name and returns their DB id.
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

// Looks up ancestor by name; links to locally-tracked person by key.
async function insertRelNameToLocal(aName: string, type: string, bKey: string, notes?: string) {
  const aId = await lookupId(aName);
  if (!aId) { console.warn(`  ⚠ Could not find ${aName} for link to ${bKey}`); return; }
  await db.execute({
    sql: `INSERT OR IGNORE INTO relationships (id,person_a_id,person_a_name,type,person_b_id,person_b_name,notes,created_at)
          VALUES (?,?,?,?,?,?,?,datetime('now'))`,
    args: [crypto.randomUUID(), aId, aName, type, id(bKey), names[bKey] ?? bKey, notes ?? ''],
  });
}

// Load existing person's id into local map so we can insert refs for them.
async function loadExisting(key: string, name: string): Promise<boolean> {
  const dbId = await lookupId(name);
  if (!dbId) { console.warn(`  ⚠ ${name} not found in DB — skipping refs`); return false; }
  ids[key] = dbId; names[key] = name;
  return true;
}

// ── People ────────────────────────────────────────────────────────────────────
async function seedPeople() {
  // ── Transjordanian kings defeated before entry (Num 21 / Deut 2–3) ───
  await safeInsertPerson({ key: "sihon", name: "Sihon",
    gender: "male",
    description: "Amorite king of Heshbon. Refused to let Israel pass through his territory and attacked them; his army was completely defeated at Jahaz. His cities and lands east of the Jordan were given to the tribes of Reuben and Gad. His defeat became a rallying refrain throughout Israel's history.",
    tags: ["king", "antagonist", "amorite"] });

  await safeInsertPerson({ key: "og", name: "Og",
    gender: "male",
    description: "King of Bashan, last of the Rephaim giants. His iron bed was reportedly nine cubits long. Marched out against Israel at Edrei and was utterly defeated. His sixty fortified cities in Bashan were given to the half-tribe of Manasseh. Like Sihon, his defeat was frequently celebrated in later psalms and prayers.",
    tags: ["king", "antagonist", "giant"] });
}

// ── Relationships ─────────────────────────────────────────────────────────────
async function seedRelationships() {
  await insertRel("sihon", "enemy_of", "og"); // both Transjordanian foes, structurally paired
  await insertRelByName("Sihon", "enemy_of", "Moses", "Refused Israel passage; defeated at Jahaz (Deut 2:26-37)");
  await insertRelByName("Og", "enemy_of", "Moses", "King of Bashan, defeated at Edrei (Deut 3:1-13)");
  await insertRelNameToLocal("Manasseh", "ruler_of", "og", "Og's territory of Bashan allotted to Manasseh (Deut 3:13)");
}

// ── Scripture references ───────────────────────────────────────────────────────
async function seedRefs() {
  // ── New people: Sihon and Og ──────────────────────────────────────────
  await insertRef("sihon", "Numbers",      21, 21, 21, 31, "Israel defeats Sihon and takes Heshbon");
  await insertRef("sihon", "Deuteronomy",  2, 26,  2, 37, "Moses retells the defeat of Sihon");
  await insertRef("sihon", "Deuteronomy",  3,  2,  3,  2, "Paired with Og in the retrospective");
  await insertRef("og",    "Numbers",      21, 33, 21, 35, "Israel defeats Og at Edrei");
  await insertRef("og",    "Deuteronomy",  3,  1, 3,  13, "Defeat of Og; his iron bed described");

  // ── Refs in Deuteronomy for already-seeded people ────────────────────
  if (await loadExisting("moses", "Moses")) {
    await insertRef("moses", "Deuteronomy",  1,  1, 34,  8, "Moses delivers three farewell addresses to Israel");
    await insertRef("moses", "Deuteronomy", 34,  1, 34,  8, "Moses views the Promised Land and dies on Mount Nebo");
  }
  if (await loadExisting("joshua", "Joshua")) {
    await insertRef("joshua", "Deuteronomy",  1, 38,  1, 38, "Joshua named as the one who will lead Israel in");
    await insertRef("joshua", "Deuteronomy", 31,  7, 31,  8, "Moses charges Joshua publicly before all Israel");
    await insertRef("joshua", "Deuteronomy", 31, 23, 31, 23, "God commissions Joshua directly");
    await insertRef("joshua", "Deuteronomy", 34,  9, 34,  9, "Full of the spirit of wisdom after Moses laid hands on him");
  }
  if (await loadExisting("caleb", "Caleb")) {
    await insertRef("caleb", "Deuteronomy",  1, 36,  1, 36, "Caleb excepted from judgment; will enter the land");
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Seeding Deuteronomy people...");
  await seedPeople();
  console.log("Seeding Deuteronomy relationships...");
  await seedRelationships();
  console.log("Seeding Deuteronomy scripture references...");
  await seedRefs();

  const pc = await db.execute("SELECT COUNT(*) as c FROM people");
  const rc = await db.execute("SELECT COUNT(*) as c FROM relationships");
  const sc = await db.execute("SELECT COUNT(*) as c FROM scripture_refs");
  console.log(`\n✓ Deuteronomy seed complete.`);
  console.log(`  Total people now: ${(pc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total relationships now: ${(rc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total scripture refs now: ${(sc.rows[0] as unknown as { c: number }).c}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
