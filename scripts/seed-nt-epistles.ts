// NT Epistles (Romans – Jude): named co-workers, church leaders, and household members
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

async function insertRelNameToLocal(aName: string, type: string, bKey: string, notes?: string) {
  const aId = await lookupId(aName);
  if (!aId) { console.warn(`  ⚠ Could not find ${aName} for link to ${bKey}`); return; }
  await db.execute({
    sql: `INSERT OR IGNORE INTO relationships (id,person_a_id,person_a_name,type,person_b_id,person_b_name,notes,created_at)
          VALUES (?,?,?,?,?,?,?,datetime('now'))`,
    args: [crypto.randomUUID(), aId, aName, type, id(bKey), names[bKey] ?? bKey, notes ?? ''],
  });
}

// ── Load cross-seed people ─────────────────────────────────────────────────────
async function loadCrossSeedPeople() {
  await loadExisting("paul", "Paul");
  await loadExisting("timothy", "Timothy");
  await loadExisting("james_lord", "James");   // James the brother of Jesus (from Acts seed)
  await loadExisting("john_ap", "John");       // Apostle John (from NT ministry seed)
  await loadExisting("peter", "Peter");        // Apostle Peter (from NT passion/ministry seed)
}

// ── People ─────────────────────────────────────────────────────────────────────
async function seedPeople() {
  // ── Romans ─────────────────────────────────────────────────────────────────
  await safeInsertPerson({
    key: "phoebe",
    name: "Phoebe",
    alsoKnownAs: "Phoebe deaconess of Cenchreae",
    gender: "female",
    description: "Deaconess of the church at Cenchreae who personally carried Paul's letter to Rome (Romans 16:1–2). Called 'a servant/deaconess' and 'a benefactor of many'.",
    tags: ["deaconess", "early church", "NT"],
  });

  await safeInsertPerson({
    key: "andronicus",
    name: "Andronicus",
    alsoKnownAs: "Andronicus kinsman of Paul",
    gender: "male",
    description: "Jewish Christian kinsman of Paul, imprisoned with him, and described as 'outstanding among the apostles' (Romans 16:7).",
    tags: ["apostle", "early church", "NT"],
  });

  await safeInsertPerson({
    key: "junia",
    name: "Junia",
    alsoKnownAs: "Junia kinswoman of Paul",
    gender: "female",
    description: "Jewish Christian kinswoman of Paul, imprisoned with him, praised as 'outstanding among the apostles' (Romans 16:7). Likely a female apostle.",
    tags: ["apostle", "early church", "NT"],
  });

  await safeInsertPerson({
    key: "rufus_roman",
    name: "Rufus",
    alsoKnownAs: "Rufus chosen in the Lord",
    gender: "male",
    description: "Greeted by Paul as 'chosen in the Lord'; his mother is also commended (Romans 16:13). Possibly the son of Simon of Cyrene.",
    tags: ["early church", "NT"],
  });

  await safeInsertPerson({
    key: "tertius",
    name: "Tertius",
    alsoKnownAs: "Tertius secretary of Paul",
    gender: "male",
    description: "Paul's secretary who actually wrote down the letter to the Romans as Paul dictated (Romans 16:22). Inserts his own greeting.",
    tags: ["secretary", "early church", "NT"],
  });

  // ── 1 Corinthians ──────────────────────────────────────────────────────────
  await safeInsertPerson({
    key: "chloe",
    name: "Chloe",
    alsoKnownAs: "Chloe of Corinth",
    gender: "female",
    description: "Prominent woman in Corinth whose household members reported factions in the church to Paul (1 Corinthians 1:11).",
    tags: ["early church", "NT"],
  });

  await safeInsertPerson({
    key: "stephanas",
    name: "Stephanas",
    alsoKnownAs: "Stephanas of Corinth",
    gender: "male",
    description: "Head of one of the first households Paul baptized in Achaia; his household 'devoted themselves to the service of the saints' (1 Corinthians 1:16; 16:15–17).",
    tags: ["early church", "NT"],
  });

  await safeInsertPerson({
    key: "crispus",
    name: "Crispus",
    alsoKnownAs: "Crispus ruler of the synagogue",
    gender: "male",
    description: "Former ruler of the synagogue at Corinth who believed in Jesus with his whole household. One of the few Paul personally baptized (Acts 18:8; 1 Corinthians 1:14).",
    tags: ["synagogue ruler", "early church", "NT"],
  });

  await safeInsertPerson({
    key: "gaius_corinth",
    name: "Gaius of Corinth",
    alsoKnownAs: "Gaius host of the whole church in Corinth",
    gender: "male",
    description: "Baptized by Paul himself; hosted Paul and the whole church of Corinth in his home (Romans 16:23; 1 Corinthians 1:14).",
    tags: ["host", "early church", "NT"],
  });

  // ── Philippians ────────────────────────────────────────────────────────────
  await safeInsertPerson({
    key: "epaphroditus",
    name: "Epaphroditus",
    alsoKnownAs: "Epaphroditus messenger of the Philippian church",
    gender: "male",
    description: "The Philippian church's delegate who brought their gift to Paul in prison and nearly died from illness while serving him (Philippians 2:25–30; 4:18).",
    tags: ["messenger", "early church", "NT"],
  });

  await safeInsertPerson({
    key: "euodia",
    name: "Euodia",
    alsoKnownAs: "Euodia of Philippi",
    gender: "female",
    description: "Church leader in Philippi whom Paul urges to reconcile with Syntyche. She 'contended at his side in the cause of the gospel' (Philippians 4:2–3).",
    tags: ["church leader", "early church", "NT"],
  });

  await safeInsertPerson({
    key: "syntyche",
    name: "Syntyche",
    alsoKnownAs: "Syntyche of Philippi",
    gender: "female",
    description: "Church leader in Philippi whom Paul urges to reconcile with Euodia. She 'contended at his side in the cause of the gospel' (Philippians 4:2–3).",
    tags: ["church leader", "early church", "NT"],
  });

  await safeInsertPerson({
    key: "clement_phil",
    name: "Clement",
    alsoKnownAs: "Clement co-worker of Paul in Philippi",
    gender: "male",
    description: "Co-worker of Paul in Philippi; his name is in the book of life (Philippians 4:3). Sometimes identified with Clement of Rome, though uncertain.",
    tags: ["co-worker", "early church", "NT"],
  });

  // ── Colossians & Philemon ──────────────────────────────────────────────────
  await safeInsertPerson({
    key: "philemon",
    name: "Philemon",
    alsoKnownAs: "Philemon of Colossae",
    gender: "male",
    description: "Wealthy Christian whose house church met in Colossae. Owner of the slave Onesimus; Paul's letter urges him to receive Onesimus back as a brother (Philemon 1:1–21).",
    tags: ["church leader", "slave owner", "early church", "NT"],
  });

  await safeInsertPerson({
    key: "apphia",
    name: "Apphia",
    alsoKnownAs: "Apphia sister in Philemon's household",
    gender: "female",
    description: "Addressed in Paul's letter to Philemon as 'our sister'; likely Philemon's wife and co-leader of the house church (Philemon 1:2).",
    tags: ["early church", "NT"],
  });

  await safeInsertPerson({
    key: "archippus",
    name: "Archippus",
    alsoKnownAs: "Archippus fellow soldier of Paul",
    gender: "male",
    description: "Called 'our fellow soldier' in Philemon 1:2 and told to complete his ministry in Colossians 4:17. Possibly Philemon's son.",
    tags: ["minister", "early church", "NT"],
  });

  await safeInsertPerson({
    key: "onesimus",
    name: "Onesimus",
    alsoKnownAs: "Onesimus slave of Philemon",
    gender: "male",
    description: "A slave of Philemon who ran away, met Paul in prison, and was converted. Paul appeals for him to be received back as a beloved brother rather than a slave (Philemon 1:10–16; Colossians 4:9).",
    tags: ["slave", "convert", "early church", "NT"],
  });

  await safeInsertPerson({
    key: "epaphras",
    name: "Epaphras",
    alsoKnownAs: "Epaphras founder of the Colossian church",
    gender: "male",
    description: "A Colossian Christian who founded the church at Colossae and reported on it to the imprisoned Paul. Called Paul's 'fellow prisoner' in Philemon 1:23 and an 'agonizing' prayer warrior for the Colossians (Colossians 1:7; 4:12–13).",
    tags: ["church founder", "early church", "NT"],
  });

  await safeInsertPerson({
    key: "nympha",
    name: "Nympha",
    alsoKnownAs: "Nympha of Laodicea",
    gender: "female",
    description: "A woman (or possibly man) in Laodicea whose home served as a house church; greeted in Colossians 4:15.",
    tags: ["house church host", "early church", "NT"],
  });

  await safeInsertPerson({
    key: "aristarchus",
    name: "Aristarchus",
    alsoKnownAs: "Aristarchus of Thessalonica",
    gender: "male",
    description: "Macedonian from Thessalonica and faithful companion of Paul. Shared his imprisonment, sailed with him to Rome, and is named in Colossians 4:10 and Philemon 1:24.",
    tags: ["companion", "early church", "NT"],
  });

  // ── Pastoral Epistles (1–2 Timothy, Titus) ─────────────────────────────────
  await safeInsertPerson({
    key: "lois",
    name: "Lois",
    alsoKnownAs: "Lois grandmother of Timothy",
    gender: "female",
    description: "Timothy's grandmother, praised by Paul for the sincere faith she passed down to her daughter Eunice and grandson Timothy (2 Timothy 1:5).",
    tags: ["grandmother", "early church", "NT"],
  });

  await safeInsertPerson({
    key: "eunice",
    name: "Eunice",
    alsoKnownAs: "Eunice mother of Timothy",
    gender: "female",
    description: "Timothy's Jewish-Christian mother, a woman of sincere faith (2 Timothy 1:5; Acts 16:1). She raised Timothy in the Scriptures.",
    tags: ["mother", "early church", "NT"],
  });

  await safeInsertPerson({
    key: "demas",
    name: "Demas",
    alsoKnownAs: "Demas co-worker of Paul",
    gender: "male",
    description: "Once a co-worker of Paul (Colossians 4:14; Philemon 1:24), but later deserted him, 'having loved this present world' and gone to Thessalonica (2 Timothy 4:10).",
    tags: ["co-worker", "deserter", "early church", "NT"],
  });

  await safeInsertPerson({
    key: "hymenaeus",
    name: "Hymenaeus",
    alsoKnownAs: "Hymenaeus false teacher",
    gender: "male",
    description: "False teacher who 'shipwrecked' his faith and was handed over to Satan by Paul (1 Timothy 1:20). Also named in 2 Timothy 2:17 for teaching the resurrection had already occurred.",
    tags: ["false teacher", "early church", "NT"],
  });

  // ── 3 John ─────────────────────────────────────────────────────────────────
  await safeInsertPerson({
    key: "gaius_3john",
    name: "Gaius of 3 John",
    alsoKnownAs: "Gaius beloved disciple of John the Elder",
    gender: "male",
    description: "Addressed as 'the beloved Gaius' in 3 John 1:1. A faithful man who showed hospitality to traveling missionaries even as Diotrephes refused them.",
    tags: ["disciple", "early church", "NT"],
  });

  await safeInsertPerson({
    key: "diotrephes",
    name: "Diotrephes",
    alsoKnownAs: "Diotrephes who loves to be first",
    gender: "male",
    description: "Domineering church leader rebuked by John the Elder for refusing to welcome traveling missionaries, spreading malicious gossip about John, and expelling those who tried to help (3 John 1:9–10).",
    tags: ["church leader", "early church", "NT"],
  });

  await safeInsertPerson({
    key: "demetrius_3john",
    name: "Demetrius",
    alsoKnownAs: "Demetrius commended by John",
    gender: "male",
    description: "Commended by John the Elder as a man of good reputation and truth (3 John 1:12). Possibly the bearer of 3 John to Gaius.",
    tags: ["early church", "NT"],
  });

  // ── Jude ───────────────────────────────────────────────────────────────────
  await safeInsertPerson({
    key: "jude_brother",
    name: "Jude",
    alsoKnownAs: "Jude brother of James, Judas son of Mary",
    gender: "male",
    description: "Author of the letter of Jude. Identifies himself as 'brother of James', making him a brother of Jesus. Wrote urging believers to 'contend for the faith' against false teachers (Jude 1:1–3).",
    tags: ["apostle", "brother of Jesus", "NT"],
  });
}

// ── Relationships ──────────────────────────────────────────────────────────────
async function seedRelationships() {
  // Romans
  await insertRel("phoebe", "ally_of", "paul", "Carried the letter to the Romans; a benefactor/patron of Paul");
  await insertRel("andronicus", "ally_of", "paul", "Kinsman and fellow prisoner; outstanding among the apostles (Rom 16:7)");
  await insertRel("junia", "ally_of", "paul", "Kinswoman and fellow prisoner; outstanding among the apostles (Rom 16:7)");
  await insertRel("andronicus", "ally_of", "junia", "Named together as fellow prisoners and prominent apostles");
  await insertRel("tertius", "servant_of", "paul", "Paul's amanuensis who wrote down the letter to the Romans");

  // Philippians
  await insertRel("epaphroditus", "ally_of", "paul", "Philippian delegate who nearly died serving Paul in prison (Phil 2:25–30)");
  await insertRel("euodia", "ally_of", "paul", "Co-labored with Paul in the gospel (Phil 4:3)");
  await insertRel("syntyche", "ally_of", "paul", "Co-labored with Paul in the gospel (Phil 4:3)");
  await insertRel("clement_phil", "ally_of", "paul", "Co-worker with Paul in Philippi (Phil 4:3)");
  await insertRel("euodia", "ally_of", "syntyche", "Church leaders urged by Paul to reconcile (Phil 4:2)");

  // Colossians / Philemon
  await insertRel("philemon", "ally_of", "paul", "Beloved co-worker; host of house church in Colossae");
  await insertRel("apphia", "ally_of", "paul", "Co-addressed in letter to Philemon; probably Philemon's wife");
  await insertRel("apphia", "spouse_of", "philemon", "Likely Philemon's wife and co-host of the house church");
  await insertRel("archippus", "ally_of", "paul", "Fellow soldier called to complete his ministry (Col 4:17; Phlm 1:2)");
  await insertRel("philemon", "parent_of", "archippus", "Archippus possibly Philemon's son, addressed with him in the same letter");
  await insertRel("onesimus", "servant_of", "philemon", "Runaway slave whom Paul converted and sent back as a brother (Phlm 1:10–16)");
  await insertRel("onesimus", "ally_of", "paul", "Converted in prison; Paul calls him 'my very heart' (Phlm 1:12)");
  await insertRel("epaphras", "ally_of", "paul", "Founded Colossae church; shared imprisonment with Paul (Phlm 1:23)");
  await insertRel("aristarchus", "ally_of", "paul", "Faithful companion; shared Paul's imprisonment (Col 4:10; Phlm 1:24)");
  await insertRel("demas", "ally_of", "paul", "Former co-worker before he departed (Col 4:14; Phlm 1:24)");

  // Pastoral Epistles
  await insertRel("lois", "parent_of", "eunice", "Lois is Eunice's mother and Timothy's grandmother (2 Tim 1:5)");
  await insertRel("eunice", "parent_of", "timothy", "Mother of Timothy; Jewish Christian woman of sincere faith (2 Tim 1:5; Acts 16:1)");

  // 3 John
  await insertRel("john_ap", "mentor_of", "gaius_3john", "John the Elder addresses Gaius as 'the beloved' (3 John 1:1)");
  await insertRel("john_ap", "other", "diotrephes", "Diotrephes rejected John's authority and missionaries (3 John 1:9–10)");
  await insertRel("john_ap", "ally_of", "demetrius_3john", "John commends Demetrius to Gaius (3 John 1:12)");

  // Jude
  await insertRel("jude_brother", "sibling_of", "james_lord", "Jude identifies himself as 'brother of James' (Jude 1:1)");
  // Paul mentions meeting James and seeing no other apostle except Peter; cross-links to NT seed people
  await insertRelNameToLocal("Paul", "ally_of", "jude_brother", "Both brothers of James the Lord; Paul met them in Jerusalem (Gal 1:19; 1 Cor 9:5)");
}

// ── Scripture references ───────────────────────────────────────────────────────
async function seedRefs() {
  // Romans
  await insertRef("phoebe", "Romans", 16, 1, 16, 2, "Deaconess who carried the letter to Rome");
  await insertRef("andronicus", "Romans", 16, 7, 16, 7, "Outstanding among the apostles; kinsman of Paul");
  await insertRef("junia", "Romans", 16, 7, 16, 7, "Outstanding among the apostles; kinswoman of Paul");
  await insertRef("rufus_roman", "Romans", 16, 13, 16, 13, "Chosen in the Lord; his mother like a mother to Paul");
  await insertRef("tertius", "Romans", 16, 22, 16, 22, "Paul's secretary who wrote down the letter");
  await insertRef("gaius_corinth", "Romans", 16, 23, 16, 23, "Host of Paul and the whole church");

  // 1 Corinthians
  await insertRef("chloe", "1 Corinthians", 1, 11, 1, 11, "Household reported factions to Paul");
  await insertRef("stephanas", "1 Corinthians", 1, 16, 1, 16, "First convert in Achaia; baptized by Paul");
  await insertRef("stephanas", "1 Corinthians", 16, 15, 16, 17, "Household devoted to service of the saints");
  await insertRef("crispus", "1 Corinthians", 1, 14, 1, 14, "Baptized by Paul");
  await insertRef("gaius_corinth", "1 Corinthians", 1, 14, 1, 14, "Baptized by Paul");

  // Philippians
  await insertRef("epaphroditus", "Philippians", 2, 25, 2, 30, "Messenger of Philippians, nearly died serving Paul");
  await insertRef("epaphroditus", "Philippians", 4, 18, 4, 18, "Brought the Philippians' gift to Paul");
  await insertRef("euodia", "Philippians", 4, 2, 4, 3, "Urged by Paul to reconcile with Syntyche");
  await insertRef("syntyche", "Philippians", 4, 2, 4, 3, "Urged by Paul to reconcile with Euodia");
  await insertRef("clement_phil", "Philippians", 4, 3, 4, 3, "Co-worker with Paul; his name in the book of life");

  // Philemon
  await insertRef("philemon", "Philemon", 1, 1, 1, 21, "Primary recipient of Paul's letter");
  await insertRef("apphia", "Philemon", 1, 2, 1, 2, "Addressed as 'our sister' in Philemon's letter");
  await insertRef("archippus", "Philemon", 1, 2, 1, 2, "Fellow soldier co-addressed with Philemon");
  await insertRef("onesimus", "Philemon", 1, 10, 1, 16, "Runaway slave converted by Paul, sent back as a brother");
  await insertRef("onesimus", "Colossians", 4, 9, 4, 9, "Faithful and dear brother, one of you");

  // Colossians
  await insertRef("epaphras", "Colossians", 1, 7, 1, 7, "Dear fellow servant, faithful minister to the Colossians");
  await insertRef("epaphras", "Colossians", 4, 12, 4, 13, "Always wrestling in prayer for the Colossians");
  await insertRef("nympha", "Colossians", 4, 15, 4, 15, "House church in Laodicea met in her home");
  await insertRef("archippus", "Colossians", 4, 17, 4, 17, "Told to complete the ministry he received in the Lord");
  await insertRef("aristarchus", "Colossians", 4, 10, 4, 10, "Fellow prisoner; sends greetings");
  await insertRef("demas", "Colossians", 4, 14, 4, 14, "Sends greetings alongside Luke");

  // 2 Timothy
  await insertRef("lois", "2 Timothy", 1, 5, 1, 5, "Timothy's grandmother of sincere faith");
  await insertRef("eunice", "2 Timothy", 1, 5, 1, 5, "Timothy's mother of sincere faith");
  await insertRef("demas", "2 Timothy", 4, 10, 4, 10, "Deserted Paul, having loved the present world");
  await insertRef("hymenaeus", "1 Timothy", 1, 20, 1, 20, "Handed over to Satan for blasphemy");
  await insertRef("hymenaeus", "2 Timothy", 2, 17, 2, 18, "Taught the resurrection had already occurred");

  // 3 John
  await insertRef("gaius_3john", "3 John", 1, 1, 1, 8, "Beloved recipient of John's third letter");
  await insertRef("diotrephes", "3 John", 1, 9, 1, 10, "Church leader who rejected John's authority");
  await insertRef("demetrius_3john", "3 John", 1, 12, 1, 12, "Commended by John the Elder");

  // Jude
  await insertRef("jude_brother", "Jude", 1, 1, 1, 3, "Author of the letter of Jude; brother of James");
}

async function main() {
  console.log("Seeding NT Epistles...");
  await loadCrossSeedPeople();
  await seedPeople();
  console.log("  People done");
  await seedRelationships();
  console.log("  Relationships done");
  await seedRefs();
  console.log("  Scripture refs done");
  console.log("NT Epistles seed complete.");
}

main().catch(console.error);
