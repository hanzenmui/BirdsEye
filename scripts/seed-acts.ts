// Acts of the Apostles and the early church
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
  // ── Paul ─────────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "paul", name: "Paul", alsoKnownAs: "Paul of Tarsus, Saul of Tarsus, the Apostle Paul",
    gender: "male",
    birthYear: "c. 5 AD", deathYear: "c. 64-68 AD",
    description: "Born Saul in Tarsus of Cilicia, a Roman citizen by birth, a Pharisee trained under Gamaliel in Jerusalem. Breathed murderous threats against the church; present at Stephen's stoning holding the cloaks. On the road to Damascus a blinding light struck him down and Jesus said 'Saul, Saul, why do you persecute me?' He was led blind into the city; Ananias restored his sight and baptized him. Took the Roman name Paul. Went on three missionary journeys throughout the Mediterranean world planting churches. Wrote at least 13 New Testament letters. Shipwrecked, beaten, imprisoned repeatedly, stoned. Appealed to Caesar; arrived in Rome; according to tradition beheaded under Nero. 'I have fought the good fight, I have finished the race, I have kept the faith.'",
    tags: ["apostle", "pharisee", "teacher"] });

  // ── Jerusalem church leaders ───────────────────────────────────────────
  await safeInsertPerson({ key: "stephen", name: "Stephen",
    gender: "male",
    deathYear: "c. 34-36 AD",
    description: "One of the seven men chosen to serve the Jerusalem church, full of faith and the Holy Spirit. Performed signs and wonders; debated in the synagogues; accused of blasphemy and brought before the Sanhedrin. Delivered a sweeping speech through Israel's history. When he declared he saw the Son of Man standing at God's right hand, the crowd rushed him and stoned him outside the city — the first Christian martyr. As he died, prayed 'Lord, do not hold this sin against them.' Saul (Paul) held the cloaks of those who stoned him and witnessed his death, an event that haunted Paul for years.",
    tags: ["deacon", "martyr"] });

  await safeInsertPerson({ key: "barnabas", name: "Barnabas", alsoKnownAs: "Joseph Barnabas, Son of Encouragement",
    gender: "male",
    description: "Levite from Cyprus named Joseph, nicknamed Barnabas ('Son of Encouragement') by the apostles. Sold a field and brought the money to the apostles. The first to vouch for the converted Paul when the Jerusalem church was afraid of him — brought Paul to the apostles and explained his conversion. Sent by Jerusalem to Antioch to investigate the growing Gentile church; was delighted and went to Tarsus to find Paul, bringing him back. Led the first missionary journey with Paul. Parted with Paul over John Mark; took Mark to Cyprus while Paul went with Silas.",
    tags: ["apostle", "levite"] });

  await safeInsertPerson({ key: "james_lord", name: "James", alsoKnownAs: "James the brother of Jesus, James the Just",
    gender: "male",
    deathYear: "c. 62 AD",
    description: "Brother of Jesus (son of Mary and Joseph), initially skeptical of Jesus's ministry (John 7:5: 'even his brothers did not believe in him'). After the resurrection Jesus appeared specifically to James (1 Cor 15:7), transforming him. Became the leader of the Jerusalem church; recognized as a pillar alongside Peter and John (Gal 2:9). Known for his extreme piety — called 'James the Just' by early tradition. Presided at the Jerusalem Council (Acts 15). Wrote the Epistle of James. Executed by the high priest Ananus II c. 62 AD; stoned to death according to Josephus.",
    tags: ["apostle", "teacher"] });

  // ── Philip the Evangelist ─────────────────────────────────────────────
  await safeInsertPerson({ key: "philip_evangelist", name: "Philip the Evangelist", alsoKnownAs: "Philip the Evangelist, Philip the deacon",
    gender: "male",
    description: "One of the seven deacons chosen to serve the Hellenist widows in Jerusalem. After Stephen's martyrdom scattered the church, Philip went to Samaria and preached to great effect — people were healed and delivered from evil spirits; Simon the magician believed. An angel directed him to the Gaza road; he met the Ethiopian eunuch reading Isaiah 53, explained that it was about Jesus, and baptized him. The Spirit then caught Philip away; he appeared in Azotus and preached his way north to Caesarea where he settled. Paul stayed at his home on the final journey to Jerusalem; his four daughters were prophetesses. Not to be confused with Philip the Apostle.",
    tags: ["deacon", "evangelist"] });

  // ── Matthias and replacement ───────────────────────────────────────────
  await safeInsertPerson({ key: "matthias", name: "Matthias",
    gender: "male",
    description: "Chosen by lot to replace Judas Iscariot among the Twelve (Acts 1:21-26). Had accompanied Jesus throughout his ministry from John's baptism to the ascension. Joseph called Barsabbas was the other candidate; Matthias was chosen. Only mentioned here in the New Testament; later tradition places him in Ethiopia or other mission fields.",
    tags: ["apostle"] });

  // ── Ananias and Sapphira ──────────────────────────────────────────────
  await safeInsertPerson({ key: "ananias_sap", name: "Ananias", alsoKnownAs: "Ananias husband of Sapphira",
    gender: "male",
    description: "Early Jerusalem believer who, with his wife Sapphira, sold property and secretly kept back part of the proceeds while claiming to give all to the apostles. Peter declared this was lying to the Holy Spirit, not to men. Ananias fell dead immediately. Not to be confused with Ananias of Damascus who baptized Paul.",
    tags: ["other"] });

  await safeInsertPerson({ key: "sapphira", name: "Sapphira",
    gender: "female",
    description: "Wife of Ananias. Three hours after her husband died, came in not knowing what had happened. Peter asked if they had sold the land for the stated price; she confirmed the lie. Peter said 'How is it that you have agreed together to test the Spirit of the Lord?' She fell dead at his feet. The dual deaths brought great fear upon the whole church and all who heard.",
    tags: ["other"] });

  // ── Ananias of Damascus ───────────────────────────────────────────────
  await safeInsertPerson({ key: "ananias_damascus", name: "Ananias of Damascus", alsoKnownAs: "Ananias the disciple in Damascus",
    gender: "male",
    description: "Disciple in Damascus to whom the Lord appeared in a vision, directing him to go to 'the street called Straight' and lay hands on Saul. Ananias protested that Saul had been persecuting the church; the Lord said 'He is a chosen instrument of mine to carry my name before the Gentiles and kings.' Ananias went, restored Saul's sight, baptized him, and so became the human bridge between the persecutor and the apostle. Not to be confused with Ananias husband of Sapphira.",
    tags: ["disciple"] });

  // ── Cornelius ────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "cornelius", name: "Cornelius",
    gender: "male",
    description: "Roman centurion of the Italian Cohort stationed in Caesarea, 'a devout man who feared God with all his household, gave alms generously to the people, and prayed continually to God.' An angel told him to send for Simon called Peter in Joppa. God simultaneously gave Peter the vision of the unclean animals ('What God has made clean, do not call common'). Peter came and preached; the Holy Spirit fell on Cornelius's whole household before they were even baptized — the decisive breakthrough for Gentile inclusion in the church. Peter's report to Jerusalem established the principle that God shows no partiality.",
    tags: ["roman official", "disciple"] });

  // ── Paul's companions ─────────────────────────────────────────────────
  await safeInsertPerson({ key: "silas", name: "Silas", alsoKnownAs: "Silas, Silvanus",
    gender: "male",
    description: "Prophet and leader in the Jerusalem church, chosen to deliver the letter from the Jerusalem Council to Antioch. Selected by Paul as a travel companion after the split with Barnabas over John Mark. Imprisoned with Paul in Philippi; they sang hymns at midnight; an earthquake opened the doors; the jailer and his household were baptized. Co-author of 1 and 2 Thessalonians with Paul. Also worked with Peter, according to 1 Peter 5:12.",
    tags: ["prophet", "apostle"] });

  await safeInsertPerson({ key: "timothy", name: "Timothy",
    gender: "male",
    description: "Son of a Jewish-Christian mother (Eunice) and a Greek father; from Lystra. Well-spoken of by the believers in Lystra and Iconium. Paul had him circumcised to avoid offense to Jews in the region. Became Paul's closest associate and representative — sent ahead to churches to represent Paul's teaching. Paul addressed him as 'my true child in the faith.' Imprisoned at some point (Heb 13:23). Paul wrote two personal letters to him (1 and 2 Timothy) with pastoral instruction. Tradition holds he became bishop of Ephesus and was martyred.",
    tags: ["teacher", "disciple"] });

  await safeInsertPerson({ key: "mark_evangelist", name: "Mark", alsoKnownAs: "John Mark, Mark the Evangelist",
    gender: "male",
    description: "John Mark, cousin of Barnabas, associated with the Jerusalem church (his mother Mary's house was a prayer meeting location where Peter went after the angel freed him). Accompanied Paul and Barnabas on the first missionary journey but deserted them in Pamphylia. This caused a sharp disagreement when Paul refused to take him on the second journey, splitting the team — Barnabas took Mark to Cyprus. Later fully restored: Paul called him 'useful to me for ministry' (2 Tim 4:11). Traditionally associated with Peter, whose eyewitness accounts he recorded as the Gospel of Mark. According to tradition, founded the church in Alexandria.",
    tags: ["evangelist", "disciple"] });

  await safeInsertPerson({ key: "luke", name: "Luke", alsoKnownAs: "Luke the physician, Luke the Evangelist",
    gender: "male",
    description: "Physician (Col 4:14) and Gentile Christian, the author of the Gospel of Luke and the Acts of the Apostles — together comprising the longest single contribution to the NT by any one author. Joined Paul's company at Troas (the 'we' passages in Acts begin there). Accompanied Paul on the journey to Rome including the shipwreck at Malta. One of Paul's most faithful companions: 'Luke alone is with me' (2 Tim 4:11). His Gospel is the most literary of the four, addressed to Theophilus and emphasizing the inclusion of women, Samaritans, and Gentiles.",
    tags: ["evangelist", "physician"] });

  await safeInsertPerson({ key: "titus", name: "Titus",
    gender: "male",
    description: "Greek Christian and one of Paul's most trusted lieutenants. Never circumcised — his case became a test case at the Jerusalem Council for whether Gentile believers needed circumcision. Sent to Corinth to smooth relations during a difficult period. Paul's letter to him (Titus) gives instructions for organizing the church in Crete, where Paul had left him. Later mentioned as having gone to Dalmatia. Called 'my true child in a common faith.'",
    tags: ["disciple", "teacher"] });

  // ── Priscilla and Aquila ──────────────────────────────────────────────
  await safeInsertPerson({ key: "priscilla", name: "Priscilla", alsoKnownAs: "Priscilla, Prisca",
    gender: "female",
    description: "Jewish Christian tent-maker who with her husband Aquila had left Rome after Claudius expelled the Jews (c. 49 AD). Met Paul in Corinth; he stayed and worked with them. Traveled with Paul to Ephesus; stayed there and together with Aquila instructed the eloquent Apollos 'more accurately' in the way of God. Paul greeted them in Romans 16:3 as 'fellow workers in Christ Jesus, who risked their necks for my life.' Notably, Priscilla is named first in four of the six NT references to the couple — unusual for a woman in antiquity, suggesting she was the more prominent teacher.",
    tags: ["teacher", "disciple"] });

  await safeInsertPerson({ key: "aquila", name: "Aquila",
    gender: "male",
    description: "Jewish Christian tent-maker from Pontus, husband of Priscilla. Expelled from Rome with his wife under Claudius's edict. Met Paul in Corinth; Paul lodged and worked with them. Traveled to Ephesus and with Priscilla instructed Apollos more accurately. Together their home hosted a church (Rom 16:5; 1 Cor 16:19).",
    tags: ["teacher", "disciple"] });

  // ── Apollos ────────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "apollos", name: "Apollos",
    gender: "male",
    description: "Jew from Alexandria, eloquent and mighty in the Scriptures. Had been instructed in the way of the Lord and spoke with burning enthusiasm and accuracy about Jesus — though he knew only John's baptism. Priscilla and Aquila took him aside and explained the way of God more accurately. Went to Achaia (Corinth) where he greatly helped the believers, 'powerfully refuting the Jews in public, showing by the Scriptures that the Christ was Jesus.' Became a significant figure in Corinth — some said 'I follow Apollos' while others said Paul or Cephas; Paul insisted all belonged to Christ and called Apollos a fellow worker.",
    tags: ["teacher", "evangelist"] });

  // ── Gamaliel ──────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "gamaliel", name: "Gamaliel", alsoKnownAs: "Gamaliel the Elder, Gamaliel I",
    gender: "male",
    description: "Pharisee and teacher of the Law held in honor by all the people, Paul's teacher (Acts 22:3: 'I was educated at the feet of Gamaliel'). When the Sanhedrin wanted to kill the apostles after their second arrest, Gamaliel urged caution: 'If this plan or this undertaking is of man, it will fail; but if it is of God, you will not be able to overthrow them. You might even be found opposing God!' The council took his advice and released the apostles (after flogging). The most revered rabbi of his generation.",
    tags: ["pharisee", "teacher"] });

  // ── Roman officials (Acts 24-26) ──────────────────────────────────────
  await safeInsertPerson({ key: "felix", name: "Felix", alsoKnownAs: "Antonius Felix, governor of Judea",
    gender: "male",
    description: "Roman governor of Judea c. 52–59 AD. Paul was transferred to him after a plot was uncovered in Jerusalem. Felix heard Paul's defense, knew about the Way, and adjourned the case saying he would decide when Lysias came. Kept Paul imprisoned for two years, often summoning him for conversation, hoping Paul would offer a bribe. Trembled when Paul reasoned about righteousness, self-control, and the coming judgment. When Festus replaced him, wanting to do the Jews a favor, he left Paul in prison.",
    tags: ["roman official"] });

  await safeInsertPerson({ key: "festus", name: "Festus", alsoKnownAs: "Porcius Festus, governor of Judea",
    gender: "male",
    description: "Roman governor who succeeded Felix c. 59 AD. Three days after arriving, chief priests asked him to send Paul to Jerusalem (planning an ambush). Festus offered to try him in Jerusalem; Paul appealed to Caesar. Festus consulted King Agrippa II on the case. When Paul gave his defense before Festus and Agrippa, Festus interrupted: 'Paul, you are out of your mind; your great learning is driving you mad!' Paul appealed to Agrippa: 'Do you believe the prophets?' Festus concluded 'This man is doing nothing deserving death or imprisonment' but had to send him to Caesar since he had appealed.",
    tags: ["roman official"] });

  await safeInsertPerson({ key: "agrippa2", name: "Herod Agrippa II", alsoKnownAs: "Herod Agrippa II, king Agrippa",
    gender: "male",
    description: "Son of Herod Agrippa I, great-grandson of Herod the Great. Given oversight of the Temple treasury and appointment of the high priest by Rome; later given territories in the north. Came with his sister Bernice to Caesarea to greet Festus. Sat in the audience hall to hear Paul's defense. Paul directed much of his speech to Agrippa, appealing to the prophets. When Paul pressed 'Do you believe the prophets?', Agrippa replied 'In a short time would you persuade me to be a Christian?' Said to Festus 'This man could have been set free if he had not appealed to Caesar.'",
    tags: ["king"] });

  // ── Lydia ─────────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "lydia", name: "Lydia", alsoKnownAs: "Lydia of Thyatira, Lydia seller of purple",
    gender: "female",
    description: "God-fearer (Gentile who worshipped the God of Israel) from Thyatira, a dealer in purple cloth, living in Philippi. The Spirit directed Paul to Macedonia in a vision; arriving in Philippi on the Sabbath, Paul spoke to women gathering by the river. 'The Lord opened her heart to pay attention to what was said by Paul.' Baptized with her household — the first recorded European convert. Urged Paul and Silas to stay at her home: 'If you have judged me to be faithful to the Lord, come to my house.' Her home became the base for the Philippian church.",
    tags: ["disciple"] });
}

// ── Relationships ─────────────────────────────────────────────────────────────
async function seedRelationships() {
  // ── Paul's conversion chain ───────────────────────────────────────────
  await insertRelByName("Jesus",   "mentor_of", "Paul",          "Damascus road; 'Saul why do you persecute me'; chosen instrument");
  await insertRel("gamaliel",      "mentor_of", "paul",          "Paul educated at Gamaliel's feet (Acts 22:3)");
  await insertRel("paul",          "enemy_of",  "stephen",       "Paul (Saul) held cloaks; witnessed Stephen's martyrdom (Acts 7:58)");
  await insertRel("ananias_damascus","ally_of", "paul",          "Restored sight; baptized Saul in Damascus (Acts 9:17-19)");
  await insertRel("barnabas",      "ally_of",   "paul",          "Vouched for Paul; co-led first missionary journey; later parted over Mark");
  await insertRel("paul",          "mentor_of", "timothy",       "Paul's 'true child in the faith'; most trusted representative");
  await insertRel("paul",          "mentor_of", "titus",         "Paul's 'true child in a common faith'; sent to Corinth and Crete");
  await insertRel("paul",          "ally_of",   "silas",         "Second missionary journey companions; imprisoned together in Philippi");
  await insertRel("paul",          "ally_of",   "luke",          "Physician companion; with Paul from Troas to Rome");
  await insertRel("paul",          "ally_of",   "priscilla",     "Worked together; Paul lodged with them in Corinth");
  await insertRel("paul",          "ally_of",   "aquila",        "Tent-making partners in Corinth; fellow workers in Christ");
  await insertRel("paul",          "ally_of",   "apollos",       "Fellow workers; both served the Corinthian church");
  await insertRel("paul",          "ally_of",   "mark_evangelist","Initially excluded then fully restored: 'useful to me for ministry'");

  // ── Jerusalem church ──────────────────────────────────────────────────
  await insertRelNameToLocal("Jesus","sibling_of","james_lord",  "James brother of Jesus (Matt 13:55; Gal 1:19)");
  await insertRel("barnabas",      "ally_of",   "mark_evangelist","Cousins; Barnabas took Mark on second journey after split with Paul");
  await insertRel("ananias_sap",   "spouse_of", "sapphira",      "Both lied about land proceeds; both struck dead (Acts 5:1-11)");

  // ── Apollos and teachers ──────────────────────────────────────────────
  await insertRel("priscilla",     "spouse_of", "aquila",        "Husband and wife team; named together six times in NT");
  await insertRel("priscilla",     "mentor_of", "apollos",       "Explained the way of God more accurately to Apollos (Acts 18:26)");
  await insertRel("aquila",        "mentor_of", "apollos",       "Together with Priscilla instructed Apollos more accurately");

  // ── Roman officials ───────────────────────────────────────────────────
  await insertRel("felix",         "ruler_of",  "paul",          "Kept Paul imprisoned two years hoping for a bribe (Acts 24:26)");
  await insertRel("festus",        "ruler_of",  "paul",          "Heard Paul's case; sent him to Caesar after appeal (Acts 25)");
  await insertRel("agrippa2",      "ally_of",   "festus",        "Came with Bernice to Caesarea; heard Paul's defense together");
  await insertRelByName("Herod Agrippa I","parent_of","Herod Agrippa II","Agrippa II is Agrippa I's son");

  // ── Philip and others ─────────────────────────────────────────────────
  await insertRelByName("Jesus",   "ally_of",   "Cornelius",     "Chose Cornelius as first Gentile; Spirit fell before baptism");
  await insertRelByName("Peter",   "ally_of",   "Cornelius",     "Preached to Cornelius; established Gentile inclusion principle");
  await insertRelByName("Paul",    "ally_of",   "Lydia",         "Her home was the base for the Philippian church (Acts 16)");
}

// ── Scripture references ───────────────────────────────────────────────────────
async function seedRefs() {
  await insertRef("paul",            "Acts",     7, 58,  9, 31, "Holds cloaks at Stephen; Damascas road; conversion; early ministry");
  await insertRef("paul",            "Acts",    13,  1, 28, 31, "Three missionary journeys; trials; appeal to Caesar; Rome");
  await insertRef("paul",            "Romans",   1,  1,  1,  7, "Greeting and introduction");
  await insertRef("stephen",         "Acts",     6,  5,  8,  2, "Chosen as deacon; signs; arrested; speech; martyrdom");
  await insertRef("barnabas",        "Acts",     4, 36, 15, 41, "Sells field; vouches for Paul; first journey; split with Paul");
  await insertRef("james_lord",      "Acts",    15,  1, 15, 29, "Presides at Jerusalem Council; 'my judgment is...'");
  await insertRef("james_lord",      "Galatians",2,  9,  2, 12, "Pillar of the church; met Paul in Jerusalem");
  await insertRef("philip_evangelist","Acts",    6,  5,  6,  6, "Chosen as one of the seven deacons");
  await insertRef("philip_evangelist","Acts",    8,  4,  8, 40, "Samaria mission; Ethiopian eunuch; transported to Azotus");
  await insertRef("matthias",        "Acts",     1, 21,  1, 26, "Chosen by lot to replace Judas Iscariot");
  await insertRef("ananias_sap",     "Acts",     5,  1,  5,  6, "Lied about land price; struck dead at Peter's word");
  await insertRef("sapphira",        "Acts",     5,  1, 5, 11,  "Confirmed husband's lie; died three hours later");
  await insertRef("ananias_damascus","Acts",     9, 10,  9, 19, "Vision to go to Saul; restores sight; baptizes Paul");
  await insertRef("cornelius",       "Acts",    10,  1, 11, 18, "Devout centurion; angel's vision; Peter's visit; Spirit falls");
  await insertRef("silas",           "Acts",    15, 22, 18,  5, "Chosen to deliver Jerusalem letter; imprisoned with Paul in Philippi");
  await insertRef("timothy",         "Acts",    16,  1, 20,  4, "Joins Paul in Lystra; circumcised; travels throughout");
  await insertRef("mark_evangelist", "Acts",    12, 12, 15, 41, "Prayer meeting at his mother's house; first journey; deserted; restored");
  await insertRef("luke",            "Acts",    16, 10, 28, 31, "We-passages: Troas through Rome; Philippi; shipwreck; Malta");
  await insertRef("titus",           "2 Corinthians",7, 6, 7, 7,"Brought good news from Corinth to Paul");
  await insertRef("priscilla",       "Acts",    18,  1, 18, 28, "Corinth; Ephesus; instructed Apollos");
  await insertRef("aquila",          "Acts",    18,  1, 18, 28, "Tent-making with Paul in Corinth; Ephesus; instructed Apollos");
  await insertRef("apollos",         "Acts",    18, 24, 19,  1, "Eloquent Alexandrian; instructed by Priscilla and Aquila; Corinth");
  await insertRef("apollos",         "1 Corinthians",3, 4, 3, 9,"'I follow Apollos' faction; Paul: 'we are fellow workers'");
  await insertRef("gamaliel",        "Acts",     5, 34,  5, 40, "Urged Sanhedrin to leave the apostles alone");
  await insertRef("gamaliel",        "Acts",    22,  3,  22, 3, "Paul 'educated at the feet of Gamaliel'");
  await insertRef("felix",           "Acts",    24,  1, 24, 27, "Hears Paul; trembles at righteousness; keeps him 2 years for bribe");
  await insertRef("festus",          "Acts",    25,  1, 26, 32, "Hears case; Paul appeals to Caesar; 'out of your mind'");
  await insertRef("agrippa2",        "Acts",    25, 13, 26, 32, "'In a short time would you persuade me to be a Christian?'");
  await insertRef("lydia",           "Acts",    16, 14, 16, 40, "First European convert; baptized; hosts the Philippian church");
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Seeding Acts people...");
  await seedPeople();
  console.log("Seeding Acts relationships...");
  await seedRelationships();
  console.log("Seeding Acts scripture references...");
  await seedRefs();

  const pc = await db.execute("SELECT COUNT(*) as c FROM people");
  const rc = await db.execute("SELECT COUNT(*) as c FROM relationships");
  const sc = await db.execute("SELECT COUNT(*) as c FROM scripture_refs");
  console.log(`\n✓ Acts seed complete.`);
  console.log(`  Total people now: ${(pc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total relationships now: ${(rc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total scripture refs now: ${(sc.rows[0] as unknown as { c: number }).c}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
