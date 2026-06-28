// Luke 3:23–38 genealogy: alternate line from David to Jesus via Nathan (not Solomon)
// Seeds all ~42 unique people in the chain with parent_of relationships
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
  testament: string; description: string; tags: string[];
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
  console.warn(`  ⚠ Could not find existing person: ${name}`);
  return false;
}

async function loadExistingByAka(key: string, name: string, aka: string): Promise<boolean> {
  const r = await db.execute({
    sql: "SELECT id FROM people WHERE name = ? AND also_known_as = ? LIMIT 1",
    args: [name, aka],
  });
  const row = r.rows[0] as unknown as { id: string } | undefined;
  if (row) { ids[key] = row.id; names[key] = name; return true; }
  console.warn(`  ⚠ Could not find existing person: ${name} (aka: ${aka})`);
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

async function insertRelNameToLocal(aName: string, type: string, bKey: string, notes?: string) {
  const aId = await lookupId(aName);
  if (!aId) { console.warn(`  ⚠ Could not find ${aName}`); return; }
  await db.execute({
    sql: `INSERT OR IGNORE INTO relationships (id,person_a_id,person_a_name,type,person_b_id,person_b_name,notes,created_at)
          VALUES (?,?,?,?,?,?,?,datetime('now'))`,
    args: [crypto.randomUUID(), aId, aName, type, id(bKey), names[bKey] ?? bKey, notes ?? ''],
  });
}

// ── Load cross-seed people ─────────────────────────────────────────────────────
async function loadCrossSeedPeople() {
  await loadExisting("david", "David");
  await loadExistingByAka("shealtiel", "Shealtiel", "Shealtiel son of Jeconiah, Salathiel");
  await loadExisting("zerubbabel", "Zerubbabel");
}

// ── People ─────────────────────────────────────────────────────────────────────
async function seedPeople() {
  // ── OT era: David's son Nathan down through Neri (pre-exile) ──────────────

  await safeInsertPerson({
    key: "nathan_david",
    name: "Nathan",
    alsoKnownAs: "Nathan son of David, son of Bathsheba",
    gender: "male",
    testament: "OT",
    description: "Son of David and Bathsheba; one of David's many sons (1 Chr 3:5). Luke traces Jesus's lineage through Nathan rather than Solomon, possibly representing Mary's line.",
    tags: ["lineage", "OT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "mattatha",
    name: "Mattatha",
    alsoKnownAs: "Mattatha son of Nathan, in Luke's genealogy",
    gender: "male",
    testament: "OT",
    description: "Son of Nathan and father of Menna in Luke's genealogy of Jesus (Luke 3:31). Known only from this genealogical record.",
    tags: ["lineage", "OT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "menna",
    name: "Menna",
    alsoKnownAs: "Menna son of Mattatha, in Luke's genealogy",
    gender: "male",
    testament: "OT",
    description: "Son of Mattatha and father of Melea in Luke's genealogy of Jesus (Luke 3:31). Known only from this genealogical record.",
    tags: ["lineage", "OT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "melea",
    name: "Melea",
    alsoKnownAs: "Melea son of Menna, in Luke's genealogy",
    gender: "male",
    testament: "OT",
    description: "Son of Menna and father of Eliakim in Luke's genealogy of Jesus (Luke 3:31). Known only from this genealogical record.",
    tags: ["lineage", "OT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "eliakim_luke",
    name: "Eliakim",
    alsoKnownAs: "Eliakim son of Melea, in Luke's genealogy",
    gender: "male",
    testament: "OT",
    description: "Son of Melea and father of Jonam in Luke's genealogy of Jesus (Luke 3:30). Not the same as Matthew's Eliakim son of Abiud; known only from this genealogical record.",
    tags: ["lineage", "OT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "jonam",
    name: "Jonam",
    alsoKnownAs: "Jonam son of Eliakim, in Luke's genealogy",
    gender: "male",
    testament: "OT",
    description: "Son of Eliakim and father of Joseph in Luke's genealogy of Jesus (Luke 3:30). Known only from this genealogical record.",
    tags: ["lineage", "OT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "joseph_luke_upper",
    name: "Joseph",
    alsoKnownAs: "Joseph son of Jonam, in Luke's genealogy",
    gender: "male",
    testament: "OT",
    description: "Son of Jonam and father of Judah in Luke's genealogy of Jesus (Luke 3:30). Not the OT patriarch Joseph nor NT Joseph husband of Mary; known only from this genealogical record.",
    tags: ["lineage", "OT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "judah_luke",
    name: "Judah",
    alsoKnownAs: "Judah son of Joseph, in Luke's genealogy",
    gender: "male",
    testament: "OT",
    description: "Son of Joseph and father of Simeon in Luke's genealogy of Jesus (Luke 3:30). Not the patriarch Judah; known only from this genealogical record.",
    tags: ["lineage", "OT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "simeon_luke",
    name: "Simeon",
    alsoKnownAs: "Simeon son of Judah, in Luke's genealogy",
    gender: "male",
    testament: "OT",
    description: "Son of Judah and father of Levi in Luke's genealogy of Jesus (Luke 3:30). Not Simeon of Jerusalem; known only from this genealogical record.",
    tags: ["lineage", "OT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "levi_luke_upper",
    name: "Levi",
    alsoKnownAs: "Levi son of Simeon, in Luke's genealogy",
    gender: "male",
    testament: "OT",
    description: "Son of Simeon and father of Matthat in Luke's genealogy of Jesus (Luke 3:29). Not the patriarch Levi; known only from this genealogical record.",
    tags: ["lineage", "OT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "matthat_luke_upper",
    name: "Matthat",
    alsoKnownAs: "Matthat son of Levi, in Luke's genealogy upper",
    gender: "male",
    testament: "OT",
    description: "Son of Levi and father of Jorim in Luke's genealogy of Jesus (Luke 3:29). Known only from this genealogical record.",
    tags: ["lineage", "OT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "jorim",
    name: "Jorim",
    alsoKnownAs: "Jorim son of Matthat, in Luke's genealogy",
    gender: "male",
    testament: "OT",
    description: "Son of Matthat and father of Eliezer in Luke's genealogy of Jesus (Luke 3:29). Known only from this genealogical record.",
    tags: ["lineage", "OT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "eliezer_luke",
    name: "Eliezer",
    alsoKnownAs: "Eliezer son of Jorim, in Luke's genealogy",
    gender: "male",
    testament: "OT",
    description: "Son of Jorim and father of Joshua in Luke's genealogy of Jesus (Luke 3:29). Not Eliezer son of Moses; known only from this genealogical record.",
    tags: ["lineage", "OT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "joshua_luke",
    name: "Joshua",
    alsoKnownAs: "Joshua son of Eliezer, in Luke's genealogy",
    gender: "male",
    testament: "OT",
    description: "Son of Eliezer and father of Er in Luke's genealogy of Jesus (Luke 3:29). Not Joshua son of Nun; known only from this genealogical record.",
    tags: ["lineage", "OT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "er_luke",
    name: "Er",
    alsoKnownAs: "Er son of Joshua, in Luke's genealogy",
    gender: "male",
    testament: "OT",
    description: "Son of Joshua and father of Elmadam in Luke's genealogy of Jesus (Luke 3:28). Not Er son of Judah; known only from this genealogical record.",
    tags: ["lineage", "OT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "elmadam",
    name: "Elmadam",
    alsoKnownAs: "Elmadam son of Er, in Luke's genealogy",
    gender: "male",
    testament: "OT",
    description: "Son of Er and father of Cosam in Luke's genealogy of Jesus (Luke 3:28). Known only from this genealogical record.",
    tags: ["lineage", "OT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "cosam",
    name: "Cosam",
    alsoKnownAs: "Cosam son of Elmadam, in Luke's genealogy",
    gender: "male",
    testament: "OT",
    description: "Son of Elmadam and father of Addi in Luke's genealogy of Jesus (Luke 3:28). Known only from this genealogical record.",
    tags: ["lineage", "OT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "addi",
    name: "Addi",
    alsoKnownAs: "Addi son of Cosam, in Luke's genealogy",
    gender: "male",
    testament: "OT",
    description: "Son of Cosam and father of Melchi in Luke's genealogy of Jesus (Luke 3:28). Known only from this genealogical record.",
    tags: ["lineage", "OT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "melchi_luke_upper",
    name: "Melchi",
    alsoKnownAs: "Melchi son of Addi, in Luke's genealogy upper",
    gender: "male",
    testament: "OT",
    description: "Son of Addi and father of Neri in Luke's genealogy of Jesus (Luke 3:28). One of two men named Melchi in Luke's list; known only from this genealogical record.",
    tags: ["lineage", "OT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "neri",
    name: "Neri",
    alsoKnownAs: "Neri son of Melchi, in Luke's genealogy",
    gender: "male",
    testament: "OT",
    description: "Son of Melchi and father of Shealtiel in Luke's genealogy (Luke 3:27). Luke says Shealtiel is son of Neri, while Matthew says son of Jehoiachin — a longstanding theological discrepancy possibly explained by levirate marriage or adoption.",
    tags: ["lineage", "OT", "luke-genealogy"],
  });

  // ── NT era: Rhesa down through Heli (post-exile, Luke-specific chain) ───────

  await safeInsertPerson({
    key: "rhesa",
    name: "Rhesa",
    alsoKnownAs: "Rhesa son of Zerubbabel, in Luke's genealogy",
    gender: "male",
    testament: "NT",
    description: "Son of Zerubbabel and father of Joanan in Luke's genealogy of Jesus (Luke 3:27). Matthew has Abiud as Zerubbabel's successor; known only from this genealogical record.",
    tags: ["lineage", "NT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "joanan",
    name: "Joanan",
    alsoKnownAs: "Joanan son of Rhesa, in Luke's genealogy",
    gender: "male",
    testament: "NT",
    description: "Son of Rhesa and father of Joda in Luke's genealogy of Jesus (Luke 3:27). Known only from this genealogical record.",
    tags: ["lineage", "NT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "joda",
    name: "Joda",
    alsoKnownAs: "Joda son of Joanan, in Luke's genealogy",
    gender: "male",
    testament: "NT",
    description: "Son of Joanan and father of Josech in Luke's genealogy of Jesus (Luke 3:26). Known only from this genealogical record.",
    tags: ["lineage", "NT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "josech",
    name: "Josech",
    alsoKnownAs: "Josech son of Joda, in Luke's genealogy",
    gender: "male",
    testament: "NT",
    description: "Son of Joda and father of Semein in Luke's genealogy of Jesus (Luke 3:26). Known only from this genealogical record.",
    tags: ["lineage", "NT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "semein",
    name: "Semein",
    alsoKnownAs: "Semein son of Josech, in Luke's genealogy",
    gender: "male",
    testament: "NT",
    description: "Son of Josech and father of Matthias in Luke's genealogy of Jesus (Luke 3:26). Known only from this genealogical record.",
    tags: ["lineage", "NT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "matthias_luke_upper",
    name: "Matthias",
    alsoKnownAs: "Matthias son of Semein, in Luke's genealogy",
    gender: "male",
    testament: "NT",
    description: "Son of Semein and father of Maath in Luke's genealogy of Jesus (Luke 3:26). Different from the apostle Matthias chosen in Acts 1; known only from this genealogical record.",
    tags: ["lineage", "NT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "maath",
    name: "Maath",
    alsoKnownAs: "Maath son of Matthias, in Luke's genealogy",
    gender: "male",
    testament: "NT",
    description: "Son of Matthias and father of Naggai in Luke's genealogy of Jesus (Luke 3:26). Known only from this genealogical record.",
    tags: ["lineage", "NT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "naggai",
    name: "Naggai",
    alsoKnownAs: "Naggai son of Maath, in Luke's genealogy",
    gender: "male",
    testament: "NT",
    description: "Son of Maath and father of Esli in Luke's genealogy of Jesus (Luke 3:25). Known only from this genealogical record.",
    tags: ["lineage", "NT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "esli",
    name: "Esli",
    alsoKnownAs: "Esli son of Naggai, in Luke's genealogy",
    gender: "male",
    testament: "NT",
    description: "Son of Naggai and father of Nahum in Luke's genealogy of Jesus (Luke 3:25). Known only from this genealogical record.",
    tags: ["lineage", "NT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "nahum_luke",
    name: "Nahum",
    alsoKnownAs: "Nahum son of Esli, in Luke's genealogy",
    gender: "male",
    testament: "NT",
    description: "Son of Esli and father of Amos in Luke's genealogy of Jesus (Luke 3:25). Not the prophet Nahum; known only from this genealogical record.",
    tags: ["lineage", "NT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "amos_luke",
    name: "Amos",
    alsoKnownAs: "Amos son of Nahum, in Luke's genealogy",
    gender: "male",
    testament: "NT",
    description: "Son of Nahum and father of Matthias in Luke's genealogy of Jesus (Luke 3:25). Not the prophet Amos; known only from this genealogical record.",
    tags: ["lineage", "NT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "matthias_luke_lower",
    name: "Matthias",
    alsoKnownAs: "Matthias son of Amos, in Luke's genealogy lower",
    gender: "male",
    testament: "NT",
    description: "Son of Amos and father of Joseph in Luke's genealogy of Jesus (Luke 3:25). Known only from this genealogical record.",
    tags: ["lineage", "NT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "joseph_luke_lower",
    name: "Joseph",
    alsoKnownAs: "Joseph son of Matthias, in Luke's genealogy lower",
    gender: "male",
    testament: "NT",
    description: "Son of Matthias and father of Jannai in Luke's genealogy of Jesus (Luke 3:24). Not the OT patriarch Joseph nor NT Joseph husband of Mary; known only from this genealogical record.",
    tags: ["lineage", "NT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "jannai",
    name: "Jannai",
    alsoKnownAs: "Jannai son of Joseph, in Luke's genealogy",
    gender: "male",
    testament: "NT",
    description: "Son of Joseph and father of Melchi in Luke's genealogy of Jesus (Luke 3:24). Known only from this genealogical record.",
    tags: ["lineage", "NT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "melchi_luke_lower",
    name: "Melchi",
    alsoKnownAs: "Melchi son of Jannai, in Luke's genealogy lower",
    gender: "male",
    testament: "NT",
    description: "Son of Jannai and father of Levi in Luke's genealogy of Jesus (Luke 3:24). One of two men named Melchi in Luke's list; known only from this genealogical record.",
    tags: ["lineage", "NT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "levi_luke_lower",
    name: "Levi",
    alsoKnownAs: "Levi son of Melchi, in Luke's genealogy lower",
    gender: "male",
    testament: "NT",
    description: "Son of Melchi and father of Matthat in Luke's genealogy of Jesus (Luke 3:24). Not the patriarch Levi; known only from this genealogical record.",
    tags: ["lineage", "NT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "matthat_luke_lower",
    name: "Matthat",
    alsoKnownAs: "Matthat son of Levi, in Luke's genealogy lower",
    gender: "male",
    testament: "NT",
    description: "Son of Levi and father of Heli in Luke's genealogy of Jesus (Luke 3:24). Known only from this genealogical record.",
    tags: ["lineage", "NT", "luke-genealogy"],
  });

  await safeInsertPerson({
    key: "heli",
    name: "Heli",
    alsoKnownAs: "Heli father-in-law of Joseph, Mary's father",
    gender: "male",
    testament: "NT",
    description: "Father-in-law of Joseph (husband of Mary) or Mary's father (Luke 3:23). The tradition that Luke gives Mary's genealogy rests on Heli being Mary's father — Joseph would be Heli's son-in-law in the Jewish custom of naming the husband in the father-in-law's line.",
    tags: ["lineage", "NT", "luke-genealogy"],
  });
}

// ── Relationships ──────────────────────────────────────────────────────────────
async function seedRelationships() {
  // David → Nathan (David's son via Bathsheba; different from Nathan the prophet)
  await insertRel("david", "parent_of", "nathan_david",
    "Nathan was David's son by Bathsheba (1 Chr 3:5); Luke traces Jesus's lineage through him rather than Solomon");

  // OT chain: Nathan down to Neri
  await insertRel("nathan_david", "parent_of", "mattatha");
  await insertRel("mattatha", "parent_of", "menna");
  await insertRel("menna", "parent_of", "melea");
  await insertRel("melea", "parent_of", "eliakim_luke");
  await insertRel("eliakim_luke", "parent_of", "jonam");
  await insertRel("jonam", "parent_of", "joseph_luke_upper");
  await insertRel("joseph_luke_upper", "parent_of", "judah_luke");
  await insertRel("judah_luke", "parent_of", "simeon_luke");
  await insertRel("simeon_luke", "parent_of", "levi_luke_upper");
  await insertRel("levi_luke_upper", "parent_of", "matthat_luke_upper");
  await insertRel("matthat_luke_upper", "parent_of", "jorim");
  await insertRel("jorim", "parent_of", "eliezer_luke");
  await insertRel("eliezer_luke", "parent_of", "joshua_luke");
  await insertRel("joshua_luke", "parent_of", "er_luke");
  await insertRel("er_luke", "parent_of", "elmadam");
  await insertRel("elmadam", "parent_of", "cosam");
  await insertRel("cosam", "parent_of", "addi");
  await insertRel("addi", "parent_of", "melchi_luke_upper");
  await insertRel("melchi_luke_upper", "parent_of", "neri");

  // Neri → Shealtiel (already in DB; note the theological discrepancy with Matthew)
  await insertRelLocalToName("neri", "parent_of", "Shealtiel",
    "Luke says Shealtiel is son of Neri (Luke 3:27); Matthew says son of Jehoiachin (Matt 1:12) — a theological discrepancy possibly explained by levirate marriage or adoption");

  // Zerubbabel (already in DB) → Rhesa (Luke-specific; Matthew has Abiud instead)
  await insertRelNameToLocal("Zerubbabel", "parent_of", "rhesa",
    "Luke's genealogy lists Rhesa as Zerubbabel's son (Luke 3:27); Matthew's genealogy has Abiud instead");

  // NT chain: Rhesa down to Heli
  await insertRel("rhesa", "parent_of", "joanan");
  await insertRel("joanan", "parent_of", "joda");
  await insertRel("joda", "parent_of", "josech");
  await insertRel("josech", "parent_of", "semein");
  await insertRel("semein", "parent_of", "matthias_luke_upper");
  await insertRel("matthias_luke_upper", "parent_of", "maath");
  await insertRel("maath", "parent_of", "naggai");
  await insertRel("naggai", "parent_of", "esli");
  await insertRel("esli", "parent_of", "nahum_luke");
  await insertRel("nahum_luke", "parent_of", "amos_luke");
  await insertRel("amos_luke", "parent_of", "matthias_luke_lower");
  await insertRel("matthias_luke_lower", "parent_of", "joseph_luke_lower");
  await insertRel("joseph_luke_lower", "parent_of", "jannai");
  await insertRel("jannai", "parent_of", "melchi_luke_lower");
  await insertRel("melchi_luke_lower", "parent_of", "levi_luke_lower");
  await insertRel("levi_luke_lower", "parent_of", "matthat_luke_lower");
  await insertRel("matthat_luke_lower", "parent_of", "heli");

  // Heli → Joseph husband of Mary (lookup by also_known_as to get the right Joseph)
  const josephNTRow = await db.execute(
    "SELECT id FROM people WHERE also_known_as='Joseph husband of Mary, Joseph of Nazareth' LIMIT 1"
  );
  const josephNTId = (josephNTRow.rows[0] as any)?.id;
  if (josephNTId) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO relationships (id,person_a_id,person_a_name,type,person_b_id,person_b_name,notes,created_at)
            VALUES (?,?,?,?,?,?,?,datetime('now'))`,
      args: [
        crypto.randomUUID(),
        id("heli"),
        "Heli",
        "parent_of",
        josephNTId,
        "Joseph",
        "Heli as father of Joseph (father-in-law per Luke 3:23 tradition)",
      ],
    });
  } else {
    console.warn("  ⚠ Could not find Joseph husband of Mary by also_known_as; skipping Heli→Joseph relationship");
  }
}

// ── Scripture references ───────────────────────────────────────────────────────
async function seedRefs() {
  // Nathan son of David — also gets 1 Chronicles ref
  await insertRef("nathan_david", "Luke", 3, 31, 3, 31, "Nathan listed in Luke's genealogy of Jesus");
  await insertRef("nathan_david", "1 Chronicles", 3, 5, 3, 5, "Nathan listed as son of David and Bathsheba");

  // Luke 3:31
  await insertRef("mattatha", "Luke", 3, 31, 3, 31, "Mattatha in Luke's genealogy of Jesus");
  await insertRef("menna", "Luke", 3, 31, 3, 31, "Menna in Luke's genealogy of Jesus");
  await insertRef("melea", "Luke", 3, 31, 3, 31, "Melea in Luke's genealogy of Jesus");

  // Luke 3:30
  await insertRef("eliakim_luke", "Luke", 3, 30, 3, 30, "Eliakim in Luke's genealogy of Jesus");
  await insertRef("jonam", "Luke", 3, 30, 3, 30, "Jonam in Luke's genealogy of Jesus");
  await insertRef("joseph_luke_upper", "Luke", 3, 30, 3, 30, "Joseph son of Jonam in Luke's genealogy");
  await insertRef("judah_luke", "Luke", 3, 30, 3, 30, "Judah in Luke's genealogy of Jesus");
  await insertRef("simeon_luke", "Luke", 3, 30, 3, 30, "Simeon in Luke's genealogy of Jesus");

  // Luke 3:29
  await insertRef("levi_luke_upper", "Luke", 3, 29, 3, 29, "Levi son of Simeon in Luke's genealogy");
  await insertRef("matthat_luke_upper", "Luke", 3, 29, 3, 29, "Matthat son of Levi (upper) in Luke's genealogy");
  await insertRef("jorim", "Luke", 3, 29, 3, 29, "Jorim in Luke's genealogy of Jesus");
  await insertRef("eliezer_luke", "Luke", 3, 29, 3, 29, "Eliezer son of Jorim in Luke's genealogy");
  await insertRef("joshua_luke", "Luke", 3, 29, 3, 29, "Joshua son of Eliezer in Luke's genealogy");

  // Luke 3:28
  await insertRef("er_luke", "Luke", 3, 28, 3, 28, "Er in Luke's genealogy of Jesus");
  await insertRef("elmadam", "Luke", 3, 28, 3, 28, "Elmadam in Luke's genealogy of Jesus");
  await insertRef("cosam", "Luke", 3, 28, 3, 28, "Cosam in Luke's genealogy of Jesus");
  await insertRef("addi", "Luke", 3, 28, 3, 28, "Addi in Luke's genealogy of Jesus");
  await insertRef("melchi_luke_upper", "Luke", 3, 28, 3, 28, "Melchi son of Addi (upper) in Luke's genealogy");

  // Luke 3:27
  await insertRef("neri", "Luke", 3, 27, 3, 27, "Neri in Luke's genealogy; father of Shealtiel per Luke");
  await insertRef("rhesa", "Luke", 3, 27, 3, 27, "Rhesa son of Zerubbabel in Luke's genealogy");
  await insertRef("joanan", "Luke", 3, 27, 3, 27, "Joanan in Luke's genealogy of Jesus");

  // Luke 3:26
  await insertRef("joda", "Luke", 3, 26, 3, 26, "Joda in Luke's genealogy of Jesus");
  await insertRef("josech", "Luke", 3, 26, 3, 26, "Josech in Luke's genealogy of Jesus");
  await insertRef("semein", "Luke", 3, 26, 3, 26, "Semein in Luke's genealogy of Jesus");
  await insertRef("matthias_luke_upper", "Luke", 3, 26, 3, 26, "Matthias son of Semein in Luke's genealogy");
  await insertRef("maath", "Luke", 3, 26, 3, 26, "Maath in Luke's genealogy of Jesus");

  // Luke 3:25
  await insertRef("naggai", "Luke", 3, 25, 3, 25, "Naggai in Luke's genealogy of Jesus");
  await insertRef("esli", "Luke", 3, 25, 3, 25, "Esli in Luke's genealogy of Jesus");
  await insertRef("nahum_luke", "Luke", 3, 25, 3, 25, "Nahum son of Esli in Luke's genealogy");
  await insertRef("amos_luke", "Luke", 3, 25, 3, 25, "Amos son of Nahum in Luke's genealogy");
  await insertRef("matthias_luke_lower", "Luke", 3, 25, 3, 25, "Matthias son of Amos in Luke's genealogy");

  // Luke 3:24
  await insertRef("joseph_luke_lower", "Luke", 3, 24, 3, 24, "Joseph son of Matthias in Luke's genealogy");
  await insertRef("jannai", "Luke", 3, 24, 3, 24, "Jannai in Luke's genealogy of Jesus");
  await insertRef("melchi_luke_lower", "Luke", 3, 24, 3, 24, "Melchi son of Jannai (lower) in Luke's genealogy");
  await insertRef("levi_luke_lower", "Luke", 3, 24, 3, 24, "Levi son of Melchi (lower) in Luke's genealogy");
  await insertRef("matthat_luke_lower", "Luke", 3, 24, 3, 24, "Matthat son of Levi (lower) in Luke's genealogy");

  // Luke 3:23
  await insertRef("heli", "Luke", 3, 23, 3, 23, "Heli in Luke's genealogy; father of Joseph or father-in-law of Joseph");

  // John the Baptist — Luke 3:1-22
  const johnId = await lookupId("John the Baptist");
  if (johnId) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO scripture_refs (id,person_id,book,chapter_start,verse_start,chapter_end,verse_end,note,created_at)
            VALUES (?,?,?,?,?,?,?,?,datetime('now'))`,
      args: [crypto.randomUUID(), johnId, "Luke", 3, 1, 3, 22,
        "John the Baptist's ministry, preaching, and baptism of Jesus (Luke 3:1–22)"],
    });
  } else {
    console.warn("  ⚠ Could not find 'John the Baptist'; skipping Luke 3:1-22 ref");
  }

  // Jesus — Luke 3:21-22 (his baptism)
  const jesusId = await lookupId("Jesus");
  if (jesusId) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO scripture_refs (id,person_id,book,chapter_start,verse_start,chapter_end,verse_end,note,created_at)
            VALUES (?,?,?,?,?,?,?,?,datetime('now'))`,
      args: [crypto.randomUUID(), jesusId, "Luke", 3, 21, 3, 22,
        "Baptism of Jesus by John; the Holy Spirit descends and the Father speaks (Luke 3:21–22)"],
    });
  } else {
    console.warn("  ⚠ Could not find 'Jesus'; skipping Luke 3:21-22 ref");
  }
}

async function main() {
  console.log("Seeding Luke 3:23–38 genealogy (Nathan line from David to Jesus)...");
  await loadCrossSeedPeople();
  await seedPeople();
  console.log("  People done");
  await seedRelationships();
  console.log("  Relationships done");
  await seedRefs();
  console.log("  Scripture refs done");
  console.log("Luke lineage seed complete.");
}

main().catch(console.error);
