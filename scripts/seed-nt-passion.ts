// Passion narrative characters: religious authorities, Pilate, Herod Antipas, and others
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
  description: string; tags: string[]; birthYear?: string; deathYear?: string;
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
          VALUES (?,?,?,?,'NT',?,?,?,?,datetime('now'))`,
    args: [id(p.key), p.name, aka, p.gender, p.birthYear ?? '', p.deathYear ?? '', p.description, JSON.stringify(p.tags)],
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

async function lookupIdByAka(name: string, aka: string): Promise<string | null> {
  const r = await db.execute({ sql: "SELECT id FROM people WHERE name = ? AND also_known_as = ? LIMIT 1", args: [name, aka] });
  return (r.rows[0] as unknown as { id: string } | undefined)?.id ?? null;
}

async function insertRelLocalToAka(aKey: string, type: string, bName: string, bAka: string, notes?: string) {
  const bId = await lookupIdByAka(bName, bAka);
  if (!bId) { console.warn(`  ⚠ Could not find ${bName} (${bAka})`); return; }
  await db.execute({
    sql: `INSERT OR IGNORE INTO relationships (id,person_a_id,person_a_name,type,person_b_id,person_b_name,notes,created_at)
          VALUES (?,?,?,?,?,?,?,datetime('now'))`,
    args: [crypto.randomUUID(), id(aKey), names[aKey] ?? aKey, type, bId, bName, notes ?? ''],
  });
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

async function insertRelNameToLocal(aName: string, type: string, bKey: string, notes?: string) {
  const aId = await lookupId(aName);
  if (!aId) { console.warn(`  ⚠ Could not find ${aName}`); return; }
  await db.execute({
    sql: `INSERT OR IGNORE INTO relationships (id,person_a_id,person_a_name,type,person_b_id,person_b_name,notes,created_at)
          VALUES (?,?,?,?,?,?,?,datetime('now'))`,
    args: [crypto.randomUUID(), aId, aName, type, id(bKey), names[bKey] ?? bKey, notes ?? ''],
  });
}

// ── People ────────────────────────────────────────────────────────────────────
async function seedPeople() {
  // ── High priestly family ──────────────────────────────────────────────
  await safeInsertPerson({ key: "annas", name: "Annas", alsoKnownAs: "Annas the high priest, Annas son of Seth",
    gender: "male",
    description: "High priest of Israel from c. 6–15 AD, removed by the Roman prefect Valerius Gratus. Though officially deposed, he remained the most powerful religious figure in Jerusalem — five of his sons and his son-in-law Caiaphas later served as high priest. Jesus was brought first to Annas for preliminary questioning before being sent to Caiaphas. The New Testament often describes both Annas and Caiaphas as acting 'high priests.' Luke dates John the Baptist's ministry to their joint high priesthood. Appeared with Caiaphas when Peter and John were arrested (Acts 4:6).",
    tags: ["priest", "antagonist"] });

  await safeInsertPerson({ key: "caiaphas", name: "Caiaphas", alsoKnownAs: "Joseph Caiaphas, high priest who condemned Jesus",
    gender: "male",
    description: "Son-in-law of Annas, high priest from c. 18–36 AD — the longest-serving high priest of the Roman period. Presided at the Sanhedrin meeting that decided to arrest Jesus: 'It is better for you that one man should die for the people, not that the whole nation should perish' — John comments this was an unwitting prophecy. Led the night trial of Jesus, tore his robes when Jesus confessed to being the Christ, and declared it blasphemy. Sent Jesus to Pilate. Present when Peter and John were arrested. Was high priest when Paul was converted (Acts 9:1).",
    tags: ["priest", "antagonist"] });

  // ── Roman authorities ─────────────────────────────────────────────────
  await safeInsertPerson({ key: "pilate", name: "Pontius Pilate", alsoKnownAs: "Pilate, Pontius Pilate prefect of Judea",
    gender: "male",
    description: "Roman prefect of Judea c. 26–36 AD. Tried Jesus and found no guilt in him; attempted to release him using the Passover custom of releasing a prisoner; when the crowd chose Barabbas instead, washed his hands saying 'I am innocent of this man's blood'; had Jesus flogged; sentenced him to crucifixion under crowd pressure. His wife sent word: 'Have nothing to do with that righteous man, for I have suffered much because of him today in a dream.' Posted a sign above the cross: 'Jesus of Nazareth, King of the Jews' in Hebrew, Latin, and Greek. Refused to change it despite the chief priests' objections. Later recalled to Rome and his fate is unknown.",
    tags: ["roman official", "antagonist"] });

  // ── Herod Antipas and family ──────────────────────────────────────────
  await safeInsertPerson({ key: "herod_antipas", name: "Herod Antipas", alsoKnownAs: "Herod Antipas, tetrarch of Galilee",
    gender: "male",
    description: "Son of Herod the Great, tetrarch of Galilee and Perea (4 BC – 39 AD). Married his brother Philip's wife Herodias — for which John the Baptist publicly rebuked him. Imprisoned and eventually beheaded John to please Herodias's daughter Salome. When Jesus was tried, Pilate sent him to Herod Antipas (as a Galilean); Herod mocked Jesus, dressed him in elegant robes, and sent him back. Jesus called him 'that fox.' Eventually exiled to Gaul by Emperor Caligula. Not to be confused with Herod the Great or Herod Agrippa I.",
    tags: ["king", "antagonist"] });

  await safeInsertPerson({ key: "herodias", name: "Herodias",
    gender: "female",
    description: "Granddaughter of Herod the Great, niece and wife of Herod Philip I, then abandoned him to marry Herod Antipas (her husband's brother). John the Baptist repeatedly condemned this as unlawful. Herodias held a deep grudge against John and wanted him executed but Herod feared the people. When her daughter Salome's dance pleased Herod at a banquet, Herodias seized the opportunity — instructing her daughter to ask for John's head on a platter. Her scheming achieved what raw power could not: John's immediate execution.",
    tags: ["queen", "antagonist"] });

  await safeInsertPerson({ key: "salome_herodias", name: "Salome", alsoKnownAs: "Salome daughter of Herodias",
    gender: "female",
    description: "Daughter of Herodias by her first husband Herod Philip I, stepdaughter of Herod Antipas. Her name is not given in the Gospels but is supplied by the historian Josephus. Danced before Herod and his guests at a birthday banquet, pleasing him so much he offered her anything up to half his kingdom. Prompted by her mother, she immediately asked for John the Baptist's head on a platter. Her request was instantly granted. Not to be confused with Salome wife of Zebedee and mother of James and John.",
    tags: ["antagonist"] });

  // ── Other passion figures ─────────────────────────────────────────────
  await safeInsertPerson({ key: "barabbas", name: "Barabbas",
    gender: "male",
    description: "Prisoner in Jerusalem at the time of Jesus's trial, described as a notorious criminal or insurrectionist who had committed murder in an uprising. Pilate offered to release one prisoner at Passover and proposed Jesus, but the crowd demanded Barabbas. He was released while Jesus was condemned. His name bar-Abbas means 'son of the father' — a detail rich in irony: the guilty 'son of the father' went free while the innocent Son of the Father was crucified.",
    tags: ["antagonist"] });

  await safeInsertPerson({ key: "joseph_arimathea", name: "Joseph of Arimathea",
    gender: "male",
    description: "Rich man from Arimathea, a member of the Sanhedrin who 'was looking for the kingdom of God' and had not consented to the council's decision. A secret disciple of Jesus, fearing the Jewish authorities. After the crucifixion went boldly to Pilate and asked for Jesus's body — the only person who did so. Wrapped the body in clean linen and placed it in his own new tomb cut from the rock, which he sealed with a great stone. Nicodemus came with him bringing burial spices. The last human act of dignity toward Jesus's body.",
    tags: ["disciple"] });

  await safeInsertPerson({ key: "simon_cyrene", name: "Simon of Cyrene",
    gender: "male",
    description: "Man from Cyrene (North Africa, modern Libya) who was coming in from the country when Roman soldiers compelled him to carry Jesus's cross to Golgotha. Mark identifies him as the father of Alexander and Rufus — men apparently known to Mark's Roman audience, suggesting he or his family became believers. The only named person compelled into service in the Passion narrative.",
    tags: ["other"] });

  await safeInsertPerson({ key: "herod_agrippa1", name: "Herod Agrippa I", alsoKnownAs: "Herod Agrippa I, king of Judea",
    gender: "male",
    birthYear: "c. 10 BC", deathYear: "44 AD",
    description: "Grandson of Herod the Great, appointed king over most of his grandfather's territory by Emperor Claudius. To please the Jewish leadership, had James son of Zebedee executed by the sword — the first apostle martyred. When he saw it pleased them, also arrested Peter; an angel released Peter from prison the night before his scheduled trial. Died suddenly and gruesomely in Caesarea after accepting divine worship from a crowd: 'An angel of the Lord struck him down, and he was eaten by worms and died' (Acts 12:23). Not to be confused with Herod the Great, Herod Antipas, or Herod Agrippa II.",
    tags: ["king", "antagonist"] });
}

// ── Relationships ─────────────────────────────────────────────────────────────
async function seedRelationships() {
  // ── High priestly hierarchy ───────────────────────────────────────────
  await insertRel("annas",      "other",      "caiaphas",      "Caiaphas was Annas's son-in-law, not son — father-in-law relationship (John 18:13)");
  await insertRelByName("Annas",     "enemy_of", "Jesus",         "Preliminary interrogation of Jesus (John 18:13-24)");
  await insertRelByName("Caiaphas",  "enemy_of", "Jesus",         "'Better one man die for the people' — night trial; declared blasphemy");
  await insertRelByName("Annas",     "enemy_of", "John the Baptist","High priestly establishment threatened by John's movement");

  // ── Herod Antipas ─────────────────────────────────────────────────────
  await insertRel("herod_antipas","spouse_of","herodias",      "Married his brother Philip's wife (Mark 6:17-18)");
  await insertRel("herodias",   "parent_of",  "salome_herodias","Salome's mother; engineered John's execution (Mark 6:24)");
  await insertRelByName("Herod Antipas","enemy_of","John the Baptist","Imprisoned John for rebuking his marriage; beheaded him");
  await insertRelByName("Herodias",    "enemy_of","John the Baptist","Nursed grudge; used daughter's dance to get John executed");
  await insertRelNameToLocal("Herod","parent_of","herod_antipas","Herod the Great's son by Malthace (Luke 3:1)");

  // ── Pilate ────────────────────────────────────────────────────────────
  await insertRelByName("Pontius Pilate","enemy_of","Jesus",   "Condemned Jesus despite finding no guilt; washed hands");
  await insertRelByName("Herod Antipas", "enemy_of","Jesus",   "Mocked Jesus; sent him back to Pilate (Luke 23:11)");
  await insertRel("pilate",     "ally_of",    "herod_antipas", "Became friends through Jesus's trial (Luke 23:12)");

  // ── Agrippa I ─────────────────────────────────────────────────────────
  await insertRelLocalToAka("herod_agrippa1","enemy_of","James","James son of Zebedee, James the Greater","Had James beheaded; first apostle martyred (Acts 12:2)");
  await insertRelByName("Herod Agrippa I","enemy_of","Peter",  "Arrested Peter; angel released him the night before trial");
  await insertRelNameToLocal("Herod","ancestor_of","herod_agrippa1","Grandson of Herod the Great (through Aristobulus)");

  // ── Cross connections ─────────────────────────────────────────────────
  await insertRelByName("Joseph of Arimathea","ally_of","Nicodemus","Both came to bury Jesus; Joseph's tomb; Nicodemus's spices");
  await insertRelByName("Jesus","ally_of","Joseph of Arimathea","Jesus buried in Joseph's new tomb (Matt 27:57-60)");
}

// ── Scripture references ───────────────────────────────────────────────────────
async function seedRefs() {
  await insertRef("annas",           "John",    18, 13, 18, 24, "Preliminary examination of Jesus before Caiaphas");
  await insertRef("annas",           "Acts",     4,  6,  4,  7, "Present when Peter and John arraigned");
  await insertRef("caiaphas",        "Matthew", 26, 57, 26, 68, "Night trial; tore robes; declared blasphemy");
  await insertRef("caiaphas",        "John",    11, 49, 11, 53, "'Better one man die for the people' — unwitting prophecy");
  await insertRef("caiaphas",        "John",    18, 24, 18, 28, "Interrogation; sent to Pilate");
  await insertRef("pilate",          "Matthew", 27,  1, 27, 66, "Trial; Barabbas; 'I am innocent'; crucifixion");
  await insertRef("pilate",          "John",    18, 28, 19, 22, "Full trial narrative; 'What is truth?'; 'INRI' title");
  await insertRef("herod_antipas",   "Matthew", 14,  1, 14, 12, "John's head on a platter; hears of Jesus's miracles");
  await insertRef("herod_antipas",   "Luke",    23,  7, 23, 12, "Jesus sent to him at trial; mocked and returned to Pilate");
  await insertRef("herodias",        "Matthew", 14,  3, 14, 12, "Divorced Philip; married Antipas; orchestrated John's death");
  await insertRef("salome_herodias", "Matthew", 14,  6, 14, 11, "Dance pleased Herod; asked for John's head on a platter");
  await insertRef("barabbas",        "Matthew", 27, 15, 27, 26, "Chosen by crowd over Jesus; murderous insurrectionist released");
  await insertRef("joseph_arimathea","Matthew", 27, 57, 27, 61, "Asked Pilate for body; wrapped in linen; placed in his new tomb");
  await insertRef("joseph_arimathea","John",    19, 38, 19, 42, "Secret disciple; boldly went to Pilate; tomb sealed with stone");
  await insertRef("simon_cyrene",    "Matthew", 27, 32, 27, 32, "Compelled to carry Jesus's cross to Golgotha");
  await insertRef("simon_cyrene",    "Mark",    15, 21, 15, 21, "Father of Alexander and Rufus (known to Mark's readers)");
  await insertRef("herod_agrippa1",  "Acts",    12,  1, 12, 24, "Kills James; arrests Peter; struck dead by angel at Caesarea");
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Seeding NT Passion people...");
  await seedPeople();
  console.log("Seeding NT Passion relationships...");
  await seedRelationships();
  console.log("Seeding NT Passion scripture references...");
  await seedRefs();

  const pc = await db.execute("SELECT COUNT(*) as c FROM people");
  const rc = await db.execute("SELECT COUNT(*) as c FROM relationships");
  const sc = await db.execute("SELECT COUNT(*) as c FROM scripture_refs");
  console.log(`\n✓ NT Passion seed complete.`);
  console.log(`  Total people now: ${(pc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total relationships now: ${(rc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total scripture refs now: ${(sc.rows[0] as unknown as { c: number }).c}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
