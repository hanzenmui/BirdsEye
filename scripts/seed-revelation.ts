// Revelation characters: Antipas, Jezebel of Thyatira, The Seven Churches
// Also adds Revelation scripture refs to John and Jesus (already in DB)
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
          VALUES (?,?,?,?,'NT','','',?,?,datetime('now'))`,
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
  await loadExisting("john", "John");
  await loadExisting("jesus", "Jesus");
}

// ── People ─────────────────────────────────────────────────────────────────────
async function seedPeople() {
  await safeInsertPerson({
    key: "antipas",
    name: "Antipas",
    alsoKnownAs: "Antipas martyr of Pergamum, faithful witness",
    gender: "male",
    description: "A Christian martyr in Pergamum described by the risen Christ as 'my faithful witness, who was put to death in your city — where Satan lives' (Rev 2:13). Little else is known of him from scripture, but he is venerated as one of the earliest martyrs of Asia Minor.",
    tags: ["martyr", "early church", "NT"],
  });

  await safeInsertPerson({
    key: "jezebel_thyatira",
    name: "Jezebel of Thyatira",
    alsoKnownAs: "Jezebel of Thyatira, false prophetess",
    gender: "female",
    description: "A false prophetess active in the church at Thyatira who 'calls herself a prophet' and leads believers into sexual immorality and eating food sacrificed to idols (Rev 2:20). She is not the OT Jezebel (wife of Ahab) but a different person using the same symbolic name. The risen Christ warns of severe judgment on her and those who follow her teaching (Rev 2:20–25).",
    tags: ["false prophet", "early church", "NT"],
  });

  await safeInsertPerson({
    key: "seven_churches",
    name: "The Seven Churches",
    alsoKnownAs: "seven churches of Asia, churches of Revelation 2-3",
    gender: "unknown",
    description: "The seven Christian communities in Asia Minor addressed in Revelation 2–3: Ephesus, Smyrna, Pergamum, Thyatira, Sardis, Philadelphia, and Laodicea. Each receives a specific message from the risen Christ through the Apostle John.",
    tags: ["early church", "NT"],
  });
}

// ── Relationships ──────────────────────────────────────────────────────────────
async function seedRelationships() {
  await insertRel("antipas", "ally_of", "john",
    "Both faithful witnesses in the churches of Asia; Antipas martyred at Pergamum");
  await insertRel("john", "mentor_of", "seven_churches",
    "John wrote the Revelation to the seven churches by commission of the risen Christ (Rev 1:4, 11)");
  await insertRel("jezebel_thyatira", "enemy_of", "john",
    "Jezebel led the Thyatiran church astray against the apostolic teaching John upheld (Rev 2:20)");
}

// ── Scripture references ───────────────────────────────────────────────────────
async function seedRefs() {
  // Antipas
  await insertRef("antipas", "Revelation", 2, 13, 2, 13, "Antipas named as 'my faithful witness' martyred in Pergamum");

  // Jezebel of Thyatira
  await insertRef("jezebel_thyatira", "Revelation", 2, 20, 2, 20, "Jezebel rebuked for calling herself a prophet and leading Thyatira astray");
  await insertRef("jezebel_thyatira", "Revelation", 2, 20, 2, 25, "Christ's full indictment of Jezebel and warning to those who follow her");

  // The Seven Churches
  await insertRef("seven_churches", "Revelation", 2, 1, 3, 22, "The seven letters to the churches of Asia Minor");

  // John — add Revelation refs
  await insertRef("john", "Revelation", 1, 1, 1, 1, "John named as the human author of Revelation");
  await insertRef("john", "Revelation", 1, 9, 1, 9, "John exiled on the island of Patmos");
  await insertRef("john", "Revelation", 22, 8, 22, 8, "John closes the book: 'I, John, am the one who heard and saw these things'");

  // Jesus — add Revelation refs
  await insertRef("jesus", "Revelation", 1, 12, 1, 18, "Vision of the Son of Man among the seven lampstands");
  await insertRef("jesus", "Revelation", 19, 11, 19, 16, "Jesus as the Rider on the white horse: King of kings and Lord of lords");
}

async function main() {
  console.log("Seeding Revelation characters...");
  await loadCrossSeedPeople();
  await seedPeople();
  console.log("  People done");
  await seedRelationships();
  console.log("  Relationships done");
  await seedRefs();
  console.log("  Scripture refs done");
  console.log("Revelation seed complete.");
}

main().catch(console.error);
