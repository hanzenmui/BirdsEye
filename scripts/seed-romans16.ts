// Romans 16 — named individuals not yet seeded
// Seeds 22 new people from Paul's greetings list plus loads 8 already-seeded people for relationships
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

// ── Load already-seeded people ─────────────────────────────────────────────────
async function loadCrossSeedPeople() {
  await loadExisting("paul", "Paul");
  await loadExisting("phoebe", "Phoebe");
  await loadExisting("priscilla", "Priscilla");
  await loadExisting("aquila", "Aquila");
  await loadExisting("andronicus", "Andronicus");
  await loadExisting("junia", "Junia");
  await loadExisting("rufus", "Rufus");
  await loadExisting("tertius", "Tertius");
  await loadExisting("gaius_corinth", "Gaius of Corinth");
}

// ── People ─────────────────────────────────────────────────────────────────────
async function seedPeople() {
  await safeInsertPerson({
    key: "epaenetus",
    name: "Epaenetus",
    alsoKnownAs: "Epaenetus first convert in Asia",
    gender: "male",
    description: "Greeted by Paul in Romans 16:5 as 'my dear friend... who was the first convert to Christ in the province of Asia.' The first recorded Christian convert in Asia Minor.",
    tags: ["romans16", "NT", "early-church"],
  });

  await safeInsertPerson({
    key: "mary_of_rome",
    name: "Mary of Rome",
    alsoKnownAs: "Mary of Rome, church worker",
    gender: "female",
    description: "Greeted by Paul in Romans 16:6 as one 'who worked very hard for you.' Not to be confused with Mary the mother of Jesus, Mary Magdalene, or Mary of Bethany. A female church worker in Rome.",
    tags: ["romans16", "NT", "early-church"],
  });

  await safeInsertPerson({
    key: "ampliatus",
    name: "Ampliatus",
    alsoKnownAs: "Ampliatus beloved in the Lord",
    gender: "male",
    description: "Greeted by Paul in Romans 16:8 as 'my dear friend in the Lord.' A common slave name in the Roman world; may have been a freed slave or slave in a Christian household.",
    tags: ["romans16", "NT", "early-church"],
  });

  await safeInsertPerson({
    key: "urbanus",
    name: "Urbanus",
    alsoKnownAs: "Urbanus co-worker of Paul",
    gender: "male",
    description: "Greeted by Paul in Romans 16:9 as 'our co-worker in Christ.' A Latin name common among Roman freedmen and slaves.",
    tags: ["romans16", "NT", "early-church"],
  });

  await safeInsertPerson({
    key: "stachys",
    name: "Stachys",
    alsoKnownAs: "Stachys dear friend of Paul",
    gender: "male",
    description: "Greeted by Paul in Romans 16:9 as 'my dear friend.' A Greek name meaning 'ear of grain,' relatively rare in Roman contexts.",
    tags: ["romans16", "NT", "early-church"],
  });

  await safeInsertPerson({
    key: "apelles",
    name: "Apelles",
    alsoKnownAs: "Apelles tested and approved in Christ",
    gender: "male",
    description: "Greeted by Paul in Romans 16:10 as one 'whose fidelity to Christ has stood the test.' The phrase suggests he had passed through some trial or persecution that proved his faith.",
    tags: ["romans16", "NT", "early-church"],
  });

  await safeInsertPerson({
    key: "herodion",
    name: "Herodion",
    alsoKnownAs: "Herodion kinsman of Paul",
    gender: "male",
    description: "Greeted by Paul in Romans 16:11 as a kinsman (fellow Jew or possibly blood relative). His name suggests a connection to the Herodian household; possibly a freed slave of Herod's family.",
    tags: ["romans16", "NT", "early-church"],
  });

  await safeInsertPerson({
    key: "tryphena",
    name: "Tryphena",
    alsoKnownAs: "Tryphena worker in the Lord",
    gender: "female",
    description: "Greeted by Paul in Romans 16:12 as one who 'work[s] hard in the Lord.' Named alongside Tryphosa; possibly sisters or close ministry partners. The name means 'dainty' or 'luxurious.'",
    tags: ["romans16", "NT", "early-church"],
  });

  await safeInsertPerson({
    key: "tryphosa",
    name: "Tryphosa",
    alsoKnownAs: "Tryphosa worker in the Lord",
    gender: "female",
    description: "Greeted by Paul in Romans 16:12 as one who 'work[s] hard in the Lord.' Named alongside Tryphena; possibly sisters or close ministry partners. The name means 'delicate.'",
    tags: ["romans16", "NT", "early-church"],
  });

  await safeInsertPerson({
    key: "persis",
    name: "Persis",
    alsoKnownAs: "Persis who worked hard for the Lord",
    gender: "female",
    description: "Greeted by Paul in Romans 16:12 as 'dear Persis, who has worked very hard in the Lord.' Described as 'dear,' suggesting she was especially close to Paul. Her name means 'Persian woman,' suggesting possible eastern origin or slave background.",
    tags: ["romans16", "NT", "early-church"],
  });

  await safeInsertPerson({
    key: "rufus_mother",
    name: "Mother of Rufus",
    alsoKnownAs: "mother of Rufus, also a mother to Paul",
    gender: "female",
    description: "Unnamed woman greeted in Romans 16:13. Paul calls her mother of Rufus and says she 'has been a mother to me, too,' indicating she had personally cared for Paul at some point. Possibly the wife of Simon of Cyrene if Rufus is identified with Mark 15:21.",
    tags: ["romans16", "NT", "early-church"],
  });

  await safeInsertPerson({
    key: "asyncritus",
    name: "Asyncritus",
    alsoKnownAs: "Asyncritus of Rome",
    gender: "male",
    description: "Greeted by Paul in Romans 16:14 as one of a group of five brothers. The name means 'incomparable.' Likely a member of a Roman house church.",
    tags: ["romans16", "NT", "early-church"],
  });

  await safeInsertPerson({
    key: "phlegon",
    name: "Phlegon",
    alsoKnownAs: "Phlegon of Rome",
    gender: "male",
    description: "Greeted by Paul in Romans 16:14 as one of a group of five brothers. The name means 'burning' or 'blazing.' Likely a member of a Roman house church.",
    tags: ["romans16", "NT", "early-church"],
  });

  await safeInsertPerson({
    key: "hermas",
    name: "Hermas",
    alsoKnownAs: "Hermas of Rome",
    gender: "male",
    description: "Greeted by Paul in Romans 16:14 as one of a group of five brothers. Some early tradition identifies him with the author of the Shepherd of Hermas, though this is uncertain. A common Greek name derived from the god Hermes.",
    tags: ["romans16", "NT", "early-church"],
  });

  await safeInsertPerson({
    key: "patrobas",
    name: "Patrobas",
    alsoKnownAs: "Patrobas of Rome",
    gender: "male",
    description: "Greeted by Paul in Romans 16:14 as one of a group of five brothers. The name is a contraction of Patrobius, a name found among Nero's freedmen. Likely a member of a Roman house church.",
    tags: ["romans16", "NT", "early-church"],
  });

  await safeInsertPerson({
    key: "hermes",
    name: "Hermes",
    alsoKnownAs: "Hermes of Rome",
    gender: "male",
    description: "Greeted by Paul in Romans 16:14 as one of a group of five brothers. Not the Greek deity; Hermes was an extremely common slave name in the Roman world. Likely a member of a Roman house church.",
    tags: ["romans16", "NT", "early-church"],
  });

  await safeInsertPerson({
    key: "philologus",
    name: "Philologus",
    alsoKnownAs: "Philologus of Rome, possibly husband of Julia",
    gender: "male",
    description: "Greeted by Paul in Romans 16:15 alongside Julia. The pairing of their names suggests they may have been husband and wife. The name means 'lover of words/learning' and was common among freedmen.",
    tags: ["romans16", "NT", "early-church"],
  });

  await safeInsertPerson({
    key: "julia",
    name: "Julia",
    alsoKnownAs: "Julia of Rome, possibly wife of Philologus",
    gender: "female",
    description: "Greeted by Paul in Romans 16:15 alongside Philologus. The pairing of their names suggests they may have been husband and wife. Julia was the most common female name in Rome, frequently borne by freedwomen of the Julian household.",
    tags: ["romans16", "NT", "early-church"],
  });

  await safeInsertPerson({
    key: "nereus",
    name: "Nereus",
    alsoKnownAs: "Nereus and his sister",
    gender: "male",
    description: "Greeted by Paul in Romans 16:15 along with 'his sister' (unnamed). Some early tradition links him with Nereus the martyr of the Domitilla catacombs. A member of a Roman house church.",
    tags: ["romans16", "NT", "early-church"],
  });

  await safeInsertPerson({
    key: "sister_of_nereus",
    name: "Sister of Nereus",
    alsoKnownAs: "sister of Nereus, unnamed",
    gender: "female",
    description: "Unnamed woman greeted by Paul in Romans 16:15 alongside her brother Nereus. Her name is not recorded; she is known only through her relationship to Nereus.",
    tags: ["romans16", "NT", "early-church"],
  });

  await safeInsertPerson({
    key: "olympas",
    name: "Olympas",
    alsoKnownAs: "Olympas of Rome",
    gender: "male",
    description: "Greeted by Paul in Romans 16:15 as part of the group with Philologus, Julia, Nereus and his sister. The name may be a shortened form of Olympiodorus. A member of a Roman house church.",
    tags: ["romans16", "NT", "early-church"],
  });

  await safeInsertPerson({
    key: "erastus",
    name: "Erastus",
    alsoKnownAs: "Erastus city treasurer of Corinth",
    gender: "male",
    description: "Identified in Romans 16:23 as 'the city's director of public works' (city treasurer/aedile of Corinth). Also mentioned in Acts 19:22 (sent with Timothy to Macedonia) and 2 Timothy 4:20 (stayed in Corinth). A Corinthian inscription mentioning an Erastus who paved a plaza at his own expense may refer to this same individual.",
    tags: ["romans16", "NT", "early-church", "corinth"],
  });
}

// ── Relationships ──────────────────────────────────────────────────────────────
async function seedRelationships() {
  // All new people are allies of Paul
  await insertRel("epaenetus", "ally_of", "paul", "Paul's dear friend; first convert in Asia (Rom 16:5)");
  await insertRel("mary_of_rome", "ally_of", "paul", "Worked very hard for the Roman church; greeted by Paul (Rom 16:6)");
  await insertRel("ampliatus", "ally_of", "paul", "Paul's dear friend in the Lord (Rom 16:8)");
  await insertRel("urbanus", "ally_of", "paul", "Co-worker with Paul in Christ (Rom 16:9)");
  await insertRel("stachys", "ally_of", "paul", "Paul's dear friend (Rom 16:9)");
  await insertRel("apelles", "ally_of", "paul", "Tested and approved in Christ; greeted by Paul (Rom 16:10)");
  await insertRel("herodion", "ally_of", "paul", "Kinsman of Paul (Rom 16:11)");
  await insertRel("tryphena", "ally_of", "paul", "Worked hard in the Lord; greeted by Paul (Rom 16:12)");
  await insertRel("tryphosa", "ally_of", "paul", "Worked hard in the Lord; greeted by Paul (Rom 16:12)");
  await insertRel("persis", "ally_of", "paul", "Dear Persis, who worked very hard in the Lord (Rom 16:12)");
  await insertRel("rufus_mother", "ally_of", "paul", "Has been like a mother to Paul as well as to Rufus (Rom 16:13)");
  await insertRel("asyncritus", "ally_of", "paul", "Greeted by Paul among the brothers (Rom 16:14)");
  await insertRel("phlegon", "ally_of", "paul", "Greeted by Paul among the brothers (Rom 16:14)");
  await insertRel("hermas", "ally_of", "paul", "Greeted by Paul among the brothers (Rom 16:14)");
  await insertRel("patrobas", "ally_of", "paul", "Greeted by Paul among the brothers (Rom 16:14)");
  await insertRel("hermes", "ally_of", "paul", "Greeted by Paul among the brothers (Rom 16:14)");
  await insertRel("philologus", "ally_of", "paul", "Greeted by Paul (Rom 16:15)");
  await insertRel("julia", "ally_of", "paul", "Greeted by Paul (Rom 16:15)");
  await insertRel("nereus", "ally_of", "paul", "Greeted by Paul (Rom 16:15)");
  await insertRel("sister_of_nereus", "ally_of", "paul", "Greeted by Paul alongside her brother Nereus (Rom 16:15)");
  await insertRel("olympas", "ally_of", "paul", "Greeted by Paul (Rom 16:15)");
  await insertRel("erastus", "ally_of", "paul", "City treasurer of Corinth; co-worker with Paul (Rom 16:23)");

  // Tryphena and Tryphosa — fellow workers, possibly sisters
  await insertRel("tryphena", "ally_of", "tryphosa", "Named together as fellow workers in the Lord (Rom 16:12); possibly sisters or close ministry partners");

  // Philologus and Julia — possibly a couple
  await insertRel("philologus", "ally_of", "julia", "Named together in Rom 16:15; possibly husband and wife");

  // Nereus and his unnamed sister
  await insertRel("nereus", "sibling_of", "sister_of_nereus", "Paul greets Nereus 'and his sister' (Rom 16:15)");

  // Mother of Rufus → parent_of Rufus (already in DB)
  await insertRelLocalToName("rufus_mother", "parent_of", "Rufus", "Mother of Rufus who was like a mother to Paul (Rom 16:13)");
}

// ── Scripture references ───────────────────────────────────────────────────────
async function seedRefs() {
  await insertRef("epaenetus", "Romans", 16, 5, 16, 5, "First convert to Christ in the province of Asia");
  await insertRef("mary_of_rome", "Romans", 16, 6, 16, 6, "Mary who worked very hard for the Roman church");
  await insertRef("ampliatus", "Romans", 16, 8, 16, 8, "Paul's dear friend in the Lord");
  await insertRef("urbanus", "Romans", 16, 9, 16, 9, "Co-worker with Paul in Christ");
  await insertRef("stachys", "Romans", 16, 9, 16, 9, "Paul's dear friend");
  await insertRef("apelles", "Romans", 16, 10, 16, 10, "Tested and approved in Christ");
  await insertRef("herodion", "Romans", 16, 11, 16, 11, "Kinsman of Paul");
  await insertRef("tryphena", "Romans", 16, 12, 16, 12, "Works hard in the Lord");
  await insertRef("tryphosa", "Romans", 16, 12, 16, 12, "Works hard in the Lord");
  await insertRef("persis", "Romans", 16, 12, 16, 12, "Dear Persis who worked very hard in the Lord");
  await insertRef("rufus_mother", "Romans", 16, 13, 16, 13, "Mother of Rufus, also a mother to Paul");
  await insertRef("asyncritus", "Romans", 16, 14, 16, 14, "Greeted among the brothers in Rome");
  await insertRef("phlegon", "Romans", 16, 14, 16, 14, "Greeted among the brothers in Rome");
  await insertRef("hermas", "Romans", 16, 14, 16, 14, "Greeted among the brothers in Rome");
  await insertRef("patrobas", "Romans", 16, 14, 16, 14, "Greeted among the brothers in Rome");
  await insertRef("hermes", "Romans", 16, 14, 16, 14, "Greeted among the brothers in Rome");
  await insertRef("philologus", "Romans", 16, 15, 16, 15, "Greeted alongside Julia");
  await insertRef("julia", "Romans", 16, 15, 16, 15, "Greeted alongside Philologus");
  await insertRef("nereus", "Romans", 16, 15, 16, 15, "Greeted with his sister");
  await insertRef("sister_of_nereus", "Romans", 16, 15, 16, 15, "Unnamed sister of Nereus, greeted by Paul");
  await insertRef("olympas", "Romans", 16, 15, 16, 15, "Greeted in the group with Philologus and Julia");
  await insertRef("erastus", "Romans", 16, 23, 16, 23, "City director of public works (treasurer) of Corinth");
  await insertRef("erastus", "Acts", 19, 22, 19, 22, "Timothy and Erastus sent ahead to Macedonia by Paul");
  await insertRef("erastus", "2 Timothy", 4, 20, 4, 20, "Erastus stayed in Corinth");
}

async function main() {
  console.log("Seeding Romans 16 individuals...");
  await loadCrossSeedPeople();
  await seedPeople();
  console.log("  People done");
  await seedRelationships();
  console.log("  Relationships done");
  await seedRefs();
  console.log("  Scripture refs done");
  console.log("Romans 16 seed complete.");
}

main().catch(console.error);
