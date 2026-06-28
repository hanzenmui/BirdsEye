// NT gaps: fills named NT individuals not yet in DB and adds scripture refs to
// currently-zero-coverage books (Ephesians, 1/2 Thessalonians, Titus, Hebrews,
// James, 1/2 Peter, 1/2 John, Galatians).
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

async function loadExistingByAka(key: string, displayName: string, aka: string): Promise<boolean> {
  const r = await db.execute({
    sql: "SELECT id, name FROM people WHERE also_known_as = ? LIMIT 1",
    args: [aka],
  });
  const row = r.rows[0] as unknown as { id: string; name: string } | undefined;
  if (row) { ids[key] = row.id; names[key] = row.name; return true; }
  console.warn(`  ⚠ Could not find existing person by aka: ${displayName} (aka: ${aka})`);
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
  await loadExisting("paul", "Paul");
  await loadExisting("timothy", "Timothy");
  await loadExisting("peter", "Peter");
  await loadExisting("john", "John");
  await loadExisting("silas", "Silas");
  await loadExisting("titus", "Titus");
  await loadExisting("stephanas", "Stephanas");
  await loadExistingByAka(
    "james_brother",
    "James the brother of Jesus",
    "James the brother of Jesus, James the Just",
  );
}

// ── People ─────────────────────────────────────────────────────────────────────
async function seedPeople() {
  await safeInsertPerson({
    key: "tychicus",
    name: "Tychicus",
    alsoKnownAs: "Tychicus dear brother and faithful minister of Paul",
    gender: "male",
    description: "A trusted co-worker and letter-carrier for Paul, described as 'our dear brother and faithful servant in the Lord' (Eph 6:21; Col 4:7). He delivered the letters to the Ephesians and Colossians and was later sent to Ephesus by Paul (2 Tim 4:12).",
    tags: ["messenger", "co-worker", "NT"],
  });

  await safeInsertPerson({
    key: "onesiphorus",
    name: "Onesiphorus",
    alsoKnownAs: "Onesiphorus who refreshed Paul in Rome",
    gender: "male",
    description: "A faithful friend of Paul who 'often refreshed me and was not ashamed of my chains' (2 Tim 1:16). He searched diligently for Paul in Rome and found him. Paul prays that the Lord will show mercy to his household (2 Tim 1:16–18; 4:19).",
    tags: ["co-worker", "NT"],
  });

  await safeInsertPerson({
    key: "crescens",
    name: "Crescens",
    alsoKnownAs: "Crescens co-worker of Paul, went to Galatia",
    gender: "male",
    description: "A co-worker of Paul mentioned in 2 Timothy 4:10 as having 'gone to Galatia'. Nothing further is recorded of him in scripture.",
    tags: ["co-worker", "NT"],
  });

  await safeInsertPerson({
    key: "linus",
    name: "Linus",
    alsoKnownAs: "Linus of Rome, possibly first bishop after Peter",
    gender: "male",
    description: "A believer in Rome who sends greetings to Timothy with Paul (2 Tim 4:21). Traditionally identified as the second bishop of Rome after Peter, though this identification is not made in scripture itself.",
    tags: ["bishop", "early church", "NT"],
  });

  await safeInsertPerson({
    key: "claudia",
    name: "Claudia",
    alsoKnownAs: "Claudia of Rome, sends greetings",
    gender: "female",
    description: "A believer in Rome who sends greetings to Timothy along with Paul, Eubulus, Pudens, and Linus (2 Tim 4:21). Nothing further is known of her from scripture.",
    tags: ["early church", "NT"],
  });

  await safeInsertPerson({
    key: "pudens",
    name: "Pudens",
    alsoKnownAs: "Pudens of Rome, sends greetings",
    gender: "male",
    description: "A believer in Rome who sends greetings to Timothy along with Paul, Eubulus, Linus, and Claudia (2 Tim 4:21). Nothing further is known of him from scripture.",
    tags: ["early church", "NT"],
  });

  await safeInsertPerson({
    key: "alexander_coppersmith",
    name: "Alexander the coppersmith",
    alsoKnownAs: "Alexander the coppersmith, opponent of Paul",
    gender: "male",
    description: "A man who 'did me a great deal of harm' according to Paul (2 Tim 4:14). Paul warns Timothy to be on guard against him. Possibly the same Alexander who, with Hymenaeus, shipwrecked his faith and was handed over to Satan by Paul (1 Tim 1:20).",
    tags: ["opponent", "early church", "NT"],
  });

  await safeInsertPerson({
    key: "fortunatus",
    name: "Fortunatus",
    alsoKnownAs: "Fortunatus of Stephanas's household",
    gender: "male",
    description: "A member of Stephanas's household who visited Paul in Ephesus along with Stephanas and Achaicus, refreshing his spirit (1 Cor 16:17–18).",
    tags: ["early church", "NT"],
  });

  await safeInsertPerson({
    key: "achaicus",
    name: "Achaicus",
    alsoKnownAs: "Achaicus of Stephanas's household",
    gender: "male",
    description: "A member of Stephanas's household who visited Paul in Ephesus along with Stephanas and Fortunatus, refreshing his spirit (1 Cor 16:17–18).",
    tags: ["early church", "NT"],
  });

  await safeInsertPerson({
    key: "elect_lady",
    name: "The Elect Lady",
    alsoKnownAs: "the Elect Lady and her children, recipient of 2 John",
    gender: "female",
    description: "The recipient of 2 John, addressed as 'the chosen lady and her children' (2 John 1:1). Scholars debate whether this refers to a specific named woman and her household or is a symbolic way of addressing a local church congregation.",
    tags: ["early church", "NT"],
  });
}

// ── Relationships ──────────────────────────────────────────────────────────────
async function seedRelationships() {
  await insertRel("tychicus", "ally_of", "paul",
    "Fellow servant and letter-carrier; 'dear brother and faithful servant in the Lord' (Eph 6:21; Col 4:7)");
  await insertRel("onesiphorus", "ally_of", "paul",
    "Refreshed Paul often and was not ashamed of his chains; searched for him in Rome (2 Tim 1:16)");
  await insertRel("crescens", "ally_of", "paul",
    "Co-worker who went to Galatia (2 Tim 4:10)");
  await insertRel("linus", "ally_of", "paul",
    "Sends greetings with Paul to Timothy (2 Tim 4:21)");
  await insertRel("linus", "ally_of", "peter",
    "Traditionally became bishop of Rome after Peter");
  await insertRel("claudia", "ally_of", "paul",
    "Sends greetings with Paul to Timothy (2 Tim 4:21)");
  await insertRel("pudens", "ally_of", "paul",
    "Sends greetings with Paul to Timothy (2 Tim 4:21)");
  await insertRel("alexander_coppersmith", "enemy_of", "paul",
    "Did Paul a great deal of harm; Paul warns Timothy to be on guard (2 Tim 4:14)");
  await insertRel("fortunatus", "ally_of", "paul",
    "Visited Paul with Stephanas, refreshing his spirit (1 Cor 16:17)");
  await insertRel("achaicus", "ally_of", "paul",
    "Visited Paul with Stephanas, refreshing his spirit (1 Cor 16:17)");
  await insertRel("fortunatus", "ally_of", "stephanas",
    "Member of Stephanas's household (1 Cor 16:17)");
  await insertRel("achaicus", "ally_of", "stephanas",
    "Member of Stephanas's household (1 Cor 16:17)");
  await insertRel("john", "mentor_of", "elect_lady",
    "The Elder writes 'to the chosen lady and her children, whom I love in the truth' (2 John 1:1)");
}

// ── Scripture references — new people ─────────────────────────────────────────
async function seedNewPeopleRefs() {
  // Tychicus
  await insertRef("tychicus", "Ephesians", 6, 21, 6, 21, "Tychicus named as Paul's messenger to the Ephesians");
  await insertRef("tychicus", "Colossians", 4, 7, 4, 7, "Tychicus described as 'dear brother and faithful servant'");
  await insertRef("tychicus", "2 Timothy", 4, 12, 4, 12, "Paul sends Tychicus to Ephesus");

  // Onesiphorus
  await insertRef("onesiphorus", "2 Timothy", 1, 16, 1, 18, "Onesiphorus refreshed Paul and searched for him in Rome");
  await insertRef("onesiphorus", "2 Timothy", 4, 19, 4, 19, "Paul greets the household of Onesiphorus");

  // Crescens
  await insertRef("crescens", "2 Timothy", 4, 10, 4, 10, "Crescens has gone to Galatia");

  // Linus
  await insertRef("linus", "2 Timothy", 4, 21, 4, 21, "Linus sends greetings to Timothy");

  // Claudia
  await insertRef("claudia", "2 Timothy", 4, 21, 4, 21, "Claudia sends greetings to Timothy");

  // Pudens
  await insertRef("pudens", "2 Timothy", 4, 21, 4, 21, "Pudens sends greetings to Timothy");

  // Alexander the coppersmith
  await insertRef("alexander_coppersmith", "1 Timothy", 1, 20, 1, 20, "Alexander named with Hymenaeus as having shipwrecked his faith");
  await insertRef("alexander_coppersmith", "2 Timothy", 4, 14, 4, 14, "Alexander the coppersmith did Paul great harm");

  // Fortunatus
  await insertRef("fortunatus", "1 Corinthians", 16, 17, 16, 17, "Fortunatus visits Paul with Stephanas and Achaicus");

  // Achaicus
  await insertRef("achaicus", "1 Corinthians", 16, 17, 16, 17, "Achaicus visits Paul with Stephanas and Fortunatus");

  // The Elect Lady
  await insertRef("elect_lady", "2 John", 1, 1, 1, 13, "The chosen lady and her children: recipient of 2 John");
}

// ── Scripture references — existing people (adding coverage to zero-ref books) ─
async function seedExistingPeopleRefs() {
  // Paul
  await insertRef("paul", "Galatians", 1, 1, 1, 1, "Paul identifies himself as author: 'Paul, an apostle'");
  await insertRef("paul", "Ephesians", 1, 1, 1, 1, "Paul opens Ephesians: 'Paul, an apostle of Christ Jesus'");
  await insertRef("paul", "Philippians", 1, 1, 1, 1, "Paul co-author of Philippians");
  await insertRef("paul", "1 Thessalonians", 1, 1, 1, 1, "Paul co-author of 1 Thessalonians");
  await insertRef("paul", "2 Thessalonians", 1, 1, 1, 1, "Paul co-author of 2 Thessalonians");
  await insertRef("paul", "Titus", 1, 4, 1, 4, "Paul addresses Titus: 'To Titus, my true child in a common faith'");
  await insertRef("paul", "Hebrews", 13, 24, 13, 24, "Greetings sent; possibly Pauline closing");

  // Timothy
  await insertRef("timothy", "1 Thessalonians", 1, 1, 1, 1, "Timothy co-author of 1 Thessalonians");
  await insertRef("timothy", "2 Thessalonians", 1, 1, 1, 1, "Timothy co-author of 2 Thessalonians");
  await insertRef("timothy", "Hebrews", 13, 23, 13, 23, "Timothy's release announced: 'our brother Timothy has been released'");

  // Silas
  await insertRef("silas", "1 Thessalonians", 1, 1, 1, 1, "Silas co-author of 1 Thessalonians");
  await insertRef("silas", "2 Thessalonians", 1, 1, 1, 1, "Silas co-author of 2 Thessalonians");

  // Titus
  await insertRef("titus", "Titus", 1, 4, 1, 4, "Titus named as recipient: 'To Titus, my true child in a common faith'");
  await insertRef("titus", "Galatians", 2, 1, 2, 1, "Titus accompanied Paul to Jerusalem");

  // James (brother of Jesus)
  await insertRef("james_brother", "James", 1, 1, 1, 1, "James identifies himself as author: 'James, a servant of God and of the Lord Jesus Christ'");
  await insertRef("james_brother", "James", 2, 14, 2, 14, "The 'faith without works' teaching central to the letter of James");

  // Peter
  await insertRef("peter", "1 Peter", 1, 1, 1, 1, "Peter identifies himself as author: 'Peter, an apostle of Jesus Christ'");
  await insertRef("peter", "2 Peter", 1, 1, 1, 1, "Peter identifies himself as author: 'Simon Peter, a servant and apostle'");
  await insertRef("peter", "1 Peter", 5, 13, 5, 13, "Greetings from 'she who is in Babylon' — the Roman church");

  // John
  await insertRef("john", "1 John", 1, 1, 1, 1, "John opens 1 John: 'That which was from the beginning, which we have heard, which we have seen'");
  await insertRef("john", "2 John", 1, 1, 1, 1, "The Elder writes to the chosen lady and her children");
  await insertRef("john", "3 John", 1, 1, 1, 1, "The Elder writes to the beloved Gaius");
}

async function main() {
  console.log("Seeding NT gaps...");
  await loadCrossSeedPeople();
  await seedPeople();
  console.log("  People done");
  await seedRelationships();
  console.log("  Relationships done");
  await seedNewPeopleRefs();
  console.log("  New-people scripture refs done");
  await seedExistingPeopleRefs();
  console.log("  Existing-people scripture refs done");
  console.log("NT gaps seed complete.");
}

main().catch(console.error);
