// Matthew's genealogy gaps: Hezron/Ram/Amminadab (OT) + Abiud→Jacob (post-exile)
// Completes a continuous parent_of chain from Adam all the way to Jesus
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
  testament: "OT" | "NT"; description: string; tags: string[];
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
          VALUES (?,?,?,?,?,'','',?,?,datetime('now'))`,
    args: [id(p.key), p.name, aka, p.gender, p.testament, p.description, JSON.stringify(p.tags)],
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
  console.warn(`  ⚠ Could not find: ${name}`);
  return false;
}

async function loadExistingByAka(key: string, name: string, aka: string): Promise<boolean> {
  const r = await db.execute({
    sql: "SELECT id FROM people WHERE name = ? AND also_known_as = ? LIMIT 1",
    args: [name, aka],
  });
  const row = r.rows[0] as unknown as { id: string } | undefined;
  if (row) { ids[key] = row.id; names[key] = name; return true; }
  console.warn(`  ⚠ Could not find: ${name} (${aka})`);
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

async function loadCrossSeedPeople() {
  await loadExisting("perez", "Perez");
  await loadExisting("nahshon", "Nahshon");
  await loadExisting("zerubbabel", "Zerubbabel");
  await loadExistingByAka("joseph_nt", "Joseph", "Joseph husband of Mary, Joseph of Nazareth");
}

// ── People ─────────────────────────────────────────────────────────────────────
async function seedPeople() {
  // ── OT gap: Perez → Nahshon (three missing links) ─────────────────────────

  await safeInsertPerson({
    key: "hezron",
    name: "Hezron",
    alsoKnownAs: "Hezron son of Perez",
    gender: "male",
    testament: "OT",
    description: "Son of Perez and grandson of Judah; ancestor of Boaz, David, and Jesus. Listed in the Judah genealogy in 1 Chronicles 2:5 and in Matthew's genealogy (Matt 1:3; Ruth 4:18).",
    tags: ["patriarch", "lineage", "OT"],
  });

  await safeInsertPerson({
    key: "ram",
    name: "Ram",
    alsoKnownAs: "Ram son of Hezron, Aram",
    gender: "male",
    testament: "OT",
    description: "Son of Hezron, father of Amminadab. Listed in the genealogy from Judah to David (Ruth 4:19; 1 Chr 2:9; Matt 1:3-4 as 'Aram').",
    tags: ["patriarch", "lineage", "OT"],
  });

  await safeInsertPerson({
    key: "amminadab",
    name: "Amminadab",
    alsoKnownAs: "Amminadab son of Ram",
    gender: "male",
    testament: "OT",
    description: "Son of Ram and father of Nahshon, the prince of Judah during the Exodus. Also the father-in-law of Aaron, whose son Nahshon led Judah in the wilderness. Part of the Davidic lineage (Ruth 4:19–20; 1 Chr 2:10; Matt 1:4).",
    tags: ["patriarch", "lineage", "OT"],
  });

  // ── NT: post-exile Matthew genealogy (Zerubbabel → Joseph husband of Mary) ──
  // Matt 1:13-16: Zerubbabel → Abiud → Eliakim → Azor → Zadok → Achim → Eliud
  //              → Eleazar → Matthan → Jacob → Joseph → Jesus

  await safeInsertPerson({
    key: "abiud",
    name: "Abiud",
    alsoKnownAs: "Abiud son of Zerubbabel",
    gender: "male",
    testament: "NT",
    description: "Son of Zerubbabel and father of Eliakim in Matthew's genealogy of Jesus (Matt 1:13). Known only from this list; part of the post-exile Jewish community in Judah.",
    tags: ["lineage", "NT"],
  });

  await safeInsertPerson({
    key: "eliakim_matt",
    name: "Eliakim",
    alsoKnownAs: "Eliakim son of Abiud, in Matthew's genealogy",
    gender: "male",
    testament: "NT",
    description: "Son of Abiud and father of Azor in Matthew's genealogy (Matt 1:13). Known only from this genealogy; not to be confused with Eliakim the palace administrator of Hezekiah.",
    tags: ["lineage", "NT"],
  });

  await safeInsertPerson({
    key: "azor",
    name: "Azor",
    alsoKnownAs: "Azor son of Eliakim, in Matthew's genealogy",
    gender: "male",
    testament: "NT",
    description: "Son of Eliakim and father of Zadok in Matthew's genealogy of Jesus (Matt 1:13-14). Known only from this genealogical list.",
    tags: ["lineage", "NT"],
  });

  await safeInsertPerson({
    key: "zadok_matt",
    name: "Zadok",
    alsoKnownAs: "Zadok son of Azor, in Matthew's genealogy",
    gender: "male",
    testament: "NT",
    description: "Son of Azor and father of Achim in Matthew's genealogy (Matt 1:14). Not to be confused with Zadok the high priest of David and Solomon's era.",
    tags: ["lineage", "NT"],
  });

  await safeInsertPerson({
    key: "achim",
    name: "Achim",
    alsoKnownAs: "Achim son of Zadok, in Matthew's genealogy",
    gender: "male",
    testament: "NT",
    description: "Son of Zadok and father of Eliud in Matthew's genealogy of Jesus (Matt 1:14). Known only from this list.",
    tags: ["lineage", "NT"],
  });

  await safeInsertPerson({
    key: "eliud",
    name: "Eliud",
    alsoKnownAs: "Eliud son of Achim, in Matthew's genealogy",
    gender: "male",
    testament: "NT",
    description: "Son of Achim and father of Eleazar in Matthew's genealogy (Matt 1:14-15). Known only from this list.",
    tags: ["lineage", "NT"],
  });

  await safeInsertPerson({
    key: "eleazar_matt",
    name: "Eleazar",
    alsoKnownAs: "Eleazar son of Eliud, in Matthew's genealogy",
    gender: "male",
    testament: "NT",
    description: "Son of Eliud and father of Matthan in Matthew's genealogy of Jesus (Matt 1:15). Not to be confused with Eleazar son of Aaron the high priest.",
    tags: ["lineage", "NT"],
  });

  await safeInsertPerson({
    key: "matthan",
    name: "Matthan",
    alsoKnownAs: "Matthan son of Eleazar, in Matthew's genealogy",
    gender: "male",
    testament: "NT",
    description: "Son of Eleazar and father of Jacob in Matthew's genealogy (Matt 1:15). Known only from this list.",
    tags: ["lineage", "NT"],
  });

  await safeInsertPerson({
    key: "jacob_joseph",
    name: "Jacob",
    alsoKnownAs: "Jacob father of Joseph husband of Mary",
    gender: "male",
    testament: "NT",
    description: "Son of Matthan and father of Joseph the husband of Mary in Matthew's genealogy (Matt 1:15-16). Known only from this list; not to be confused with the patriarch Jacob son of Isaac.",
    tags: ["lineage", "NT"],
  });
}

// ── Relationships ──────────────────────────────────────────────────────────────
async function seedRelationships() {
  // OT gap: Perez → Hezron → Ram → Amminadab → Nahshon
  await insertRel("perez", "parent_of", "hezron", "Hezron son of Perez (Ruth 4:18; 1 Chr 2:5; Matt 1:3)");
  await insertRel("hezron", "parent_of", "ram", "Ram son of Hezron (Ruth 4:19; 1 Chr 2:9; Matt 1:3-4)");
  await insertRel("ram", "parent_of", "amminadab", "Amminadab son of Ram (Ruth 4:19-20; 1 Chr 2:10; Matt 1:4)");
  await insertRel("amminadab", "parent_of", "nahshon", "Nahshon son of Amminadab (Ruth 4:20; Num 1:7; Matt 1:4)");

  // NT: post-exile Matthew chain
  await insertRel("zerubbabel", "parent_of", "abiud", "Abiud son of Zerubbabel (Matt 1:13)");
  await insertRel("abiud", "parent_of", "eliakim_matt", "Eliakim son of Abiud (Matt 1:13)");
  await insertRel("eliakim_matt", "parent_of", "azor", "Azor son of Eliakim (Matt 1:13-14)");
  await insertRel("azor", "parent_of", "zadok_matt", "Zadok son of Azor (Matt 1:14)");
  await insertRel("zadok_matt", "parent_of", "achim", "Achim son of Zadok (Matt 1:14)");
  await insertRel("achim", "parent_of", "eliud", "Eliud son of Achim (Matt 1:14-15)");
  await insertRel("eliud", "parent_of", "eleazar_matt", "Eleazar son of Eliud (Matt 1:15)");
  await insertRel("eleazar_matt", "parent_of", "matthan", "Matthan son of Eleazar (Matt 1:15)");
  await insertRel("matthan", "parent_of", "jacob_joseph", "Jacob son of Matthan (Matt 1:15-16)");
  await insertRelLocalToName("jacob_joseph", "parent_of", "Joseph", "Joseph husband of Mary, son of Jacob (Matt 1:16)");
}

// ── Scripture references ───────────────────────────────────────────────────────
async function seedRefs() {
  await insertRef("hezron", "Ruth", 4, 18, 4, 19, "Hezron in the genealogy of David");
  await insertRef("hezron", "1 Chronicles", 2, 5, 2, 5, "Hezron son of Perez in Chronicles genealogy");
  await insertRef("hezron", "Matthew", 1, 3, 1, 3, "Hezron in Matthew's genealogy of Jesus");
  await insertRef("ram", "Ruth", 4, 19, 4, 19, "Ram son of Hezron in the genealogy of David");
  await insertRef("ram", "Matthew", 1, 3, 1, 4, "Ram (Aram) in Matthew's genealogy");
  await insertRef("amminadab", "Ruth", 4, 19, 4, 20, "Amminadab son of Ram");
  await insertRef("amminadab", "Numbers", 1, 7, 1, 7, "Amminadab's son Nahshon led the tribe of Judah");
  await insertRef("amminadab", "Matthew", 1, 4, 1, 4, "Amminadab in Matthew's genealogy");

  await insertRef("abiud", "Matthew", 1, 13, 1, 13, "Abiud son of Zerubbabel");
  await insertRef("eliakim_matt", "Matthew", 1, 13, 1, 13, "Eliakim son of Abiud");
  await insertRef("azor", "Matthew", 1, 13, 1, 14, "Azor son of Eliakim");
  await insertRef("zadok_matt", "Matthew", 1, 14, 1, 14, "Zadok son of Azor");
  await insertRef("achim", "Matthew", 1, 14, 1, 14, "Achim son of Zadok");
  await insertRef("eliud", "Matthew", 1, 14, 1, 15, "Eliud son of Achim");
  await insertRef("eleazar_matt", "Matthew", 1, 15, 1, 15, "Eleazar son of Eliud");
  await insertRef("matthan", "Matthew", 1, 15, 1, 15, "Matthan son of Eleazar");
  await insertRef("jacob_joseph", "Matthew", 1, 15, 1, 16, "Jacob father of Joseph husband of Mary");
}

async function main() {
  console.log("Seeding Matthew lineage gaps...");
  await loadCrossSeedPeople();
  await seedPeople();
  console.log("  People done");
  await seedRelationships();
  console.log("  Relationships done");
  await seedRefs();
  console.log("  Scripture refs done");
  console.log("Matthew lineage seed complete.");
}

main().catch(console.error);
