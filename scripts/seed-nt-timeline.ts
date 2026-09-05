// New Testament timeline dataset. Extends the timeline past Malachi: stamps
// timeline_* columns onto the New Testament people already in the database,
// inserts the four Roman emperors the New Testament actually names, and seeds
// the intertestamental and New Testament events plus the Old-Testament-to-New
// prophecy links.
//
// YEARS: the timeline stores years counting DOWN, so AD is the negative of BC.
// AD 30 is -30. See lib/timeline-layout.ts for the convention and formatters.
//
// SCOPE NOTE: only Augustus, Tiberius, Claudius and Nero are inserted. Later
// emperors — Vespasian, who took Jerusalem, and Domitian, under whom Revelation
// is usually placed — are left out on purpose: this is a database of people in
// the Bible, and neither is named in it. Their events are still here; only the
// people are withheld.
//
// Idempotent — safe to re-run; a second run with unchanged data arrays
// produces neither inserts nor updates.
import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import { resolve } from "path";
import type { TimelineTrack, DateConfidence } from "../lib/types";
import { formatYearSpan, formatYear } from "../lib/timeline-layout";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN ?? process.env.TURSO_DATABASE_TURSO_AUTH_TOKEN,
});

const DRY_RUN = process.argv.includes("--dry-run");

// Same resolution rules as scripts/seed-timeline.ts: exact (name,
// also_known_as) only, and a hard failure rather than a guess when the pair is
// ambiguous. "James" alone matches three different men in this database.
async function resolvePersonRow(name: string, aka: string): Promise<{ id: string; description: string } | null> {
  const r = await db.execute({
    sql: "SELECT id, description FROM people WHERE name = ? AND also_known_as = ?",
    args: [name, aka],
  });
  if (r.rows.length > 1) {
    throw new Error(`Ambiguous person match: ${r.rows.length} rows for (name="${name}", aka="${aka}") — refusing to guess.`);
  }
  return (r.rows[0] as unknown as { id: string; description: string } | undefined) ?? null;
}

async function resolvePerson(name: string, aka: string): Promise<string | null> {
  const row = await resolvePersonRow(name, aka);
  return row ? row.id : null;
}

async function upsertTimelinePerson(p: {
  name: string; alsoKnownAs: string; gender: string; description: string; tags: string[];
}): Promise<string> {
  const existing = await resolvePersonRow(p.name, p.alsoKnownAs);
  if (existing) {
    if (existing.description !== p.description) {
      console.log(`  ${DRY_RUN ? "would update" : "updating"}: ${p.name} description`);
      if (!DRY_RUN) {
        await db.execute({ sql: "UPDATE people SET description = ? WHERE id = ?", args: [p.description, existing.id] });
      }
    }
    return existing.id;
  }
  const id = crypto.randomUUID();
  console.log(`  ${DRY_RUN ? "would insert" : "inserting"}: ${p.name} (${p.alsoKnownAs})`);
  if (!DRY_RUN) {
    await db.execute({
      sql: `INSERT INTO people (id,name,also_known_as,gender,testament,birth_year,death_year,description,tags,created_at)
            VALUES (?,?,?,?,'NT','','',?,?,datetime('now'))`,
      args: [id, p.name, p.alsoKnownAs, p.gender, p.description, JSON.stringify(p.tags)],
    });
  }
  return id;
}

async function seedMissingPeople() {
  console.log("Inserting the Roman emperors the New Testament names...");
  await upsertTimelinePerson({ name: "Caesar Augustus", alsoKnownAs: "Augustus, Octavian, Gaius Octavius",
    gender: "male", tags: ["ruler"],
    description: "First Roman emperor, whose census sent Joseph and Mary to Bethlehem. Great-nephew and heir of Julius Caesar, he ended a century of civil war and ruled a peaceful empire for over forty years — the roads, common language and open borders of which the first missionaries later travelled." });
  await upsertTimelinePerson({ name: "Tiberius", alsoKnownAs: "Tiberius Caesar, Tiberius Julius Caesar",
    gender: "male", tags: ["ruler"],
    description: "Stepson and successor of Augustus, and the emperor throughout Jesus' ministry. Luke dates the start of John the Baptist's preaching to his fifteenth year, and the coin Jesus asked for when he spoke of rendering to Caesar carried his face." });
  await upsertTimelinePerson({ name: "Claudius", alsoKnownAs: "Claudius Caesar, Tiberius Claudius Caesar",
    gender: "male", tags: ["ruler"],
    description: "Emperor during the early spread of the church. He expelled the Jews from Rome, which is how Priscilla and Aquila came to be in Corinth when Paul arrived, and a famine in his reign prompted the Antioch church's relief gift to Judea." });
  await upsertTimelinePerson({ name: "Nero", alsoKnownAs: "Nero Caesar, Nero Claudius Caesar",
    gender: "male", tags: ["ruler"],
    description: "The Caesar to whom Paul appealed, and the emperor who launched the first imperial persecution of Christians after the fire of Rome in AD 64. Both Peter and Paul are traditionally executed under him." });
}

// [name, also_known_as, startYear, endYear] — years count down, AD negative.
type Row = [string, string, number, number];

const MESSIAH: Row[] = [
  ["Jesus", "Jesus of Nazareth, Jesus Christ, the Messiah", 5, -30],
];
const JESUS_NOTE = "Jesus was born before Herod the Great died in 4 BC, so the birth is usually placed between 6 and 4 BC — the AD numbering itself comes from a sixth-century calculation now known to be a few years out. The crucifixion is dated either AD 30 or AD 33, both of which fit a Passover Friday; this timeline follows AD 30.";

const NT_PROPHETS: Row[] = [
  ["John the Baptist", "John son of Zechariah", -28, -29],
  ["Anna", "Anna the prophetess", 5, 5],
  ["Simeon", "Simeon of Jerusalem", 5, 5],
];
const NT_PROPHET_NOTES: Record<string, string> = {
  "John the Baptist": "Luke dates the start of John's preaching to the fifteenth year of Tiberius, which works out to AD 28 or 29. His execution by Herod Antipas is usually placed within a year or two after that.",
  "Anna": "Anna appears once only, at Jesus' presentation in the temple, so she is placed at that moment rather than given a ministry span. Luke says she was eighty-four and had been a widow for decades.",
  "Simeon": "Simeon appears once only, at the same presentation, and is placed there. Luke says only that he had been promised he would not die before seeing the Messiah.",
};

const APOSTLES: Row[] = [
  ["Peter", "Simon Peter, Cephas, Simon son of Jonah", -28, -64],
  ["Andrew", "Andrew the Apostle, brother of Peter", -28, -33],
  ["James", "James son of Zebedee, James the Greater", -28, -44],
  ["John", "John son of Zebedee, the Beloved Disciple", -28, -95],
  ["Philip", "Philip the Apostle", -28, -33],
  ["Bartholomew", "Bartholomew the Apostle, Nathanael", -28, -33],
  ["Matthew", "Matthew the Apostle, Levi the tax collector", -28, -33],
  ["Thomas", "Thomas the Apostle, Doubting Thomas, Didymus", -28, -33],
  ["James", "James son of Alphaeus, James the Less", -28, -33],
  ["Thaddaeus", "Thaddaeus, Judas son of James, Lebbaeus", -28, -33],
  ["Simon", "Simon the Zealot, Simon the Canaanite", -28, -33],
  ["Judas Iscariot", "Judas Iscariot, son of Simon Iscariot", -28, -30],
  ["Matthias", "", -30, -33],
  ["Paul", "Paul of Tarsus, Saul of Tarsus, the Apostle Paul", -33, -67],
];

// The default for a member of the Twelve whose later life Scripture never
// dates. Deliberately does NOT adopt the traditional mission fields and
// martyrdoms — those are church tradition, and this database keeps tradition
// out of its date columns.
const TWELVE_NOTE = "Called during Jesus' ministry and present at Pentecost, but Scripture records nothing after that which can be dated. The mission fields and deaths later assigned to the Twelve come from church tradition rather than the New Testament, so this span covers only the years the Gospels and Acts actually place him in.";

const APOSTLE_NOTES: Record<string, string> = {
  "Peter": "Peter's call is dated with Jesus' ministry. Scripture never records his death; early tradition places his execution in Rome during Nero's persecution, usually between AD 64 and 68.",
  "John": "John's call is dated with Jesus' ministry. Tradition holds he outlived the rest of the Twelve, was exiled to Patmos under Domitian and died at Ephesus around AD 100 — none of which Scripture dates.",
  "Matthias": "Matthias is chosen to replace Judas before Pentecost and is never mentioned again in Scripture. He is placed at that choosing; nothing further about him is dated.",
  "Paul": "Paul's conversion is usually placed AD 33-35 and his execution under Nero around AD 67; neither is dated in Scripture. The rest of his travels are fixed within a year or two by Gallio's proconsulship at Corinth (AD 51-52), which Acts 18 places him in front of.",
};
// The two whose dates come straight out of the text and need no caveat.
const FIRM_APOSTLE_AKAS = new Set([
  "James son of Zebedee, James the Greater",
  "Judas Iscariot, son of Simon Iscariot",
]);
const PAUL_AKA = "Paul of Tarsus, Saul of Tarsus, the Apostle Paul";

const CHURCH_LEADERS: Row[] = [
  ["James", "James the brother of Jesus, James the Just", -33, -62],
  ["Stephen", "", -33, -34],
  ["Philip the Evangelist", "Philip the Evangelist, Philip the deacon", -34, -57],
  ["Barnabas", "Joseph Barnabas, Son of Encouragement", -36, -50],
  ["Mark", "John Mark, Mark the Evangelist", -45, -65],
  ["Silas", "Silas, Silvanus", -49, -57],
  ["Luke", "Luke the physician, Luke the Evangelist", -49, -62],
  ["Timothy", "", -49, -66],
  ["Titus", "", -49, -66],
  ["Priscilla", "Priscilla, Prisca", -49, -57],
  ["Aquila", "", -49, -57],
  ["Apollos", "", -52, -57],
];
const CHURCH_LEADER_NOTES: Record<string, string> = {
  "Stephen": "Acts gives no dates for Stephen. He is placed just before Saul's conversion, which his stoning immediately precedes in the narrative.",
  "Barnabas": "Barnabas introduces Saul to the apostles, leads with him at Antioch and on the first missionary journey, then parts from him over John Mark around AD 50. Nothing after that is dated.",
  "Mark": "John Mark travels with Barnabas and Paul from the first missionary journey onward and is with Paul in Rome. Tradition places his later ministry in Alexandria and his death around AD 68; Scripture dates neither.",
  "Titus": "Titus travels with Paul from the Jerusalem Council onward and is left in Crete, but Acts never names him — his movements are pieced together from the letters alone.",
};
const DEFAULT_CHURCH_LEADER_NOTE = "Placed by the years Acts and the letters actually put him in Paul's company; nothing outside that window is dated.";
// Names whose span comes straight out of the narrative rather than inference.
const FIRM_CHURCH_LEADERS = new Set([
  "James", "Philip the Evangelist", "Silas", "Luke", "Timothy", "Priscilla", "Aquila", "Apollos",
]);

const ROMAN_RULERS: Row[] = [
  ["Caesar Augustus", "Augustus, Octavian, Gaius Octavius", 27, -14],
  ["Tiberius", "Tiberius Caesar, Tiberius Julius Caesar", -14, -37],
  ["Claudius", "Claudius Caesar, Tiberius Claudius Caesar", -41, -54],
  ["Nero", "Nero Caesar, Nero Claudius Caesar", -54, -68],
  ["Pontius Pilate", "Pilate, Pontius Pilate prefect of Judea", -26, -36],
  ["Felix", "Antonius Felix, governor of Judea", -52, -59],
  ["Festus", "Porcius Festus, governor of Judea", -59, -62],
];

const HERODIANS: Row[] = [
  ["Herod", "Herod the Great, Herod king of Judea", 37, 4],
  ["Herod Antipas", "Herod Antipas, tetrarch of Galilee", 4, -39],
  ["Herod Agrippa I", "Herod Agrippa I, king of Judea", -41, -44],
  ["Herod Agrippa II", "Herod Agrippa II, king Agrippa", -50, -93],
];
const HEROD_NOTES: Record<string, string> = {
  "Herod Agrippa II": "Agrippa II was granted territories piecemeal from about AD 50 rather than succeeding to a throne in one year, and the year of his death is disputed between AD 93 and AD 100.",
};

const JEWISH_LEADERS: Row[] = [
  ["Annas", "Annas the high priest, Annas son of Seth", -6, -15],
  ["Caiaphas", "Joseph Caiaphas, high priest who condemned Jesus", -18, -36],
  ["Gamaliel", "Gamaliel the Elder, Gamaliel I", -25, -50],
];
const JEWISH_LEADER_NOTES: Record<string, string> = {
  "Annas": "Annas held the high priesthood itself only from AD 6 to 15, but five of his sons and his son-in-law Caiaphas held it after him — which is why the Gospels still call him high priest at Jesus' trial.",
  "Gamaliel": "Gamaliel's career is known from Acts, where he intervenes for the apostles and is named as Paul's teacher, and from later rabbinic sources. No year of his birth or death is recorded.",
};

async function stampDates(
  rows: Row[],
  track: TimelineTrack,
  confidenceFor: (name: string, aka: string) => DateConfidence,
  noteFor: (name: string, aka: string) => string,
) {
  for (const [name, aka, startYear, endYear] of rows) {
    const id = await resolvePerson(name, aka);
    if (!id) { console.warn(`  MISSING: ${name} (aka="${aka}") — not found, skipping`); continue; }
    const confidence = confidenceFor(name, aka);
    const note = noteFor(name, aka);
    console.log(`  ${DRY_RUN ? "would stamp" : "stamping"}: ${name} ${formatYearSpan(startYear, endYear)} [${track}/${confidence}]`);
    if (!DRY_RUN) {
      await db.execute({
        sql: `UPDATE people SET timeline_start_bc = ?, timeline_end_bc = ?, timeline_track = ?,
              date_confidence = ?, date_uncertainty_note = ? WHERE id = ?`,
        args: [startYear, endYear, track, confidence, note, id],
      });
    }
  }
}

async function seedTimelineDates() {
  console.log("Stamping New Testament timeline dates...");
  await stampDates(MESSIAH, "messiah", () => "good", () => JESUS_NOTE);

  await stampDates(NT_PROPHETS, "nt_prophet",
    name => (name === "John the Baptist" ? "good" : "uncertain"),
    name => NT_PROPHET_NOTES[name] ?? "");

  await stampDates(APOSTLES, "apostle",
    (_name, aka) => (FIRM_APOSTLE_AKAS.has(aka) || aka === PAUL_AKA ? "good" : "uncertain"),
    (name, aka) => (FIRM_APOSTLE_AKAS.has(aka) ? "" : APOSTLE_NOTES[name] ?? TWELVE_NOTE));

  await stampDates(CHURCH_LEADERS, "church_leader",
    name => (FIRM_CHURCH_LEADERS.has(name) ? "good" : "uncertain"),
    name => CHURCH_LEADER_NOTES[name] ?? DEFAULT_CHURCH_LEADER_NOTE);

  await stampDates(ROMAN_RULERS, "roman_ruler",
    name => (name === "Felix" || name === "Festus" ? "good" : "firm"), () => "");

  await stampDates(HERODIANS, "herodian",
    name => (name === "Herod Agrippa II" ? "uncertain" : "firm"),
    name => HEROD_NOTES[name] ?? "");

  await stampDates(JEWISH_LEADERS, "jewish_leader",
    name => (name === "Gamaliel" ? "uncertain" : "firm"),
    name => JEWISH_LEADER_NOTES[name] ?? "");
}

type EventDef = {
  key: string; title: string; yearBc: number; era: string; description: string;
  dateUncertaintyNote?: string; dateConfidence?: DateConfidence;
};

const EVENTS: EventDef[] = [
  // ── Between the Testaments ────────────────────────────────────────────
  { key: "alexander", title: "Alexander the Great conquers Persia", yearBc: 332, era: "Between the Testaments",
    description: "Alexander defeats Darius III and takes the Persian empire. Greek language and culture spread across the region, and Greek becomes the common tongue the New Testament is later written in." },
  { key: "antiochus", title: "Antiochus IV desecrates the Temple", yearBc: 167, era: "Between the Testaments",
    description: "The Seleucid king Antiochus IV Epiphanes outlaws the Jewish faith, plunders the Temple and sacrifices a pig on its altar. The Maccabean revolt begins in response." },
  { key: "rededication", title: "The Temple is cleansed and rededicated", yearBc: 164, era: "Between the Testaments",
    description: "Judas Maccabeus retakes Jerusalem and rededicates the Temple three years after its desecration. This is the origin of Hanukkah — the Feast of Dedication that John 10:22 finds Jesus attending." },
  { key: "herod-king", title: "Rome makes Herod king of Judea", yearBc: 37, era: "Between the Testaments",
    description: "The Roman senate installs Herod, an Idumean, as client king over Judea. His rebuilt Temple and his massacre at Bethlehem are both part of the Gospels' opening scenes." },

  // ── The Coming of Christ ──────────────────────────────────────────────
  { key: "nativity", title: "Jesus is born in Bethlehem", yearBc: 5, era: "The Coming of Christ",
    description: "Born in Bethlehem during a Roman census, in the last years of Herod the Great. Shepherds are told first; wise men from the east arrive later, and Herod's response drives the family to Egypt.",
    dateConfidence: "good",
    dateUncertaintyNote: "Fixed only within a range: the birth precedes Herod the Great's death in 4 BC, so 6-4 BC is the usual window. The AD numbering itself rests on a sixth-century calculation now known to be a few years out." },
  { key: "herod-dies", title: "Herod the Great dies", yearBc: 4, era: "The Coming of Christ",
    description: "Herod dies at Jericho after a long and violent reign, and his kingdom is divided among his sons. An angel tells Joseph it is safe to bring the child back from Egypt." },

  // ── The Ministry of Jesus ─────────────────────────────────────────────
  { key: "john-preaching", title: "John begins preaching in the wilderness", yearBc: -28, era: "The Ministry of Jesus",
    description: "After four centuries with no prophet, John appears at the Jordan calling Israel to repent and be baptized, and announcing that someone greater is already among them." },
  { key: "baptism", title: "Jesus is baptized and begins his ministry", yearBc: -28, era: "The Ministry of Jesus",
    description: "Jesus is baptized by John, the Spirit descends on him and a voice from heaven names him as Son. Luke notes he was about thirty years old when he began." },
  { key: "entry", title: "The triumphal entry into Jerusalem", yearBc: -30, era: "The Ministry of Jesus",
    description: "Jesus rides into Jerusalem on a donkey's colt to crowds spreading cloaks and branches, deliberately entering as the king Zechariah described. The final week begins." },
  { key: "crucifixion", title: "Jesus is crucified", yearBc: -30, era: "The Ministry of Jesus",
    description: "Condemned by the Sanhedrin and sentenced by Pontius Pilate, Jesus is crucified outside Jerusalem at Passover, between two criminals, and buried in a borrowed tomb.",
    dateConfidence: "good",
    dateUncertaintyNote: "Dated to either AD 30 or AD 33; both years give a Passover falling on a Friday. This timeline follows AD 30 throughout." },
  { key: "resurrection", title: "Jesus rises from the dead", yearBc: -30, era: "The Ministry of Jesus",
    description: "On the third day the tomb is found empty. Over the following weeks Jesus appears to the women, to the Eleven, and to more than five hundred at once, then ascends.",
    dateConfidence: "good",
    dateUncertaintyNote: "Dated with the crucifixion, three days later." },

  // ── The Church Begins ─────────────────────────────────────────────────
  { key: "pentecost", title: "The Spirit comes at Pentecost", yearBc: -30, era: "The Church Begins",
    description: "Fifty days after Passover the Spirit falls on the gathered believers, who begin speaking in languages they never learned. Peter preaches, and about three thousand are baptized in a day.",
    dateConfidence: "good",
    dateUncertaintyNote: "Dated with the crucifixion and resurrection, fifty days after that Passover." },
  { key: "stephen", title: "Stephen is stoned and the church scatters", yearBc: -34, era: "The Church Begins",
    description: "Stephen is stoned after accusing the council of resisting the Spirit, with Saul approving. The persecution that follows scatters believers out of Jerusalem — and the gospel travels with them.",
    dateConfidence: "good",
    dateUncertaintyNote: "Acts gives no year; placed immediately before Saul's conversion, which it directly precedes." },
  { key: "damascus", title: "Saul is confronted on the Damascus road", yearBc: -34, era: "The Church Begins",
    description: "On his way to arrest believers in Damascus, Saul is blinded by a light and hears Jesus ask why he is persecuting him. The church's fiercest opponent becomes its furthest-travelling missionary.",
    dateConfidence: "good",
    dateUncertaintyNote: "Usually placed AD 33-35, working back from the fixed point of Gallio's proconsulship at Corinth." },
  { key: "cornelius", title: "The gospel opens to the Gentiles", yearBc: -40, era: "The Church Begins",
    description: "Peter, prepared by a vision, enters the house of the Roman centurion Cornelius and watches the Spirit fall on Gentiles exactly as at Pentecost. The church has to reckon with a door it did not open.",
    dateConfidence: "uncertain",
    dateUncertaintyNote: "Acts gives no date. Placed between Saul's conversion and the famine relief visit, the two events either side of it." },
  { key: "agrippa", title: "Herod Agrippa I kills James and dies at Caesarea", yearBc: -44, era: "The Church Begins",
    description: "Agrippa executes James the son of Zebedee — the first apostle martyred — and imprisons Peter, who is freed overnight. Agrippa himself dies at Caesarea shortly afterward, an event Josephus also records." },

  // ── Paul and the Nations ──────────────────────────────────────────────
  { key: "council", title: "The Jerusalem Council", yearBc: -49, era: "Paul and the Nations",
    description: "The apostles and elders rule that Gentile believers need not be circumcised or keep the law of Moses to belong. The decision settles what the church is, and lets the mission go everywhere.",
    dateConfidence: "good",
    dateUncertaintyNote: "Usually dated AD 48-49, between the first and second missionary journeys." },
  { key: "claudius-expels", title: "Claudius expels the Jews from Rome", yearBc: -49, era: "Paul and the Nations",
    description: "Claudius orders all Jews out of Rome, which is how Priscilla and Aquila come to be in Corinth when Paul arrives there and takes work with them as a tentmaker." },
  { key: "arrest", title: "Paul is arrested in Jerusalem", yearBc: -57, era: "Paul and the Nations",
    description: "A riot in the temple courts ends with Paul seized and taken into Roman custody. He spends the next two years imprisoned at Caesarea under Felix, then appeals to Caesar before Festus." },
  { key: "rome", title: "Paul reaches Rome", yearBc: -60, era: "Paul and the Nations",
    description: "After shipwreck at Malta, Paul arrives in Rome and spends two years under house arrest, receiving all who come and preaching without hindrance. Acts ends there, mid-story." },

  // ── The Apostles' End ─────────────────────────────────────────────────
  { key: "fire", title: "Nero's persecution begins after the fire of Rome", yearBc: -64, era: "The Apostles' End",
    description: "Fire destroys much of Rome and Nero blames the Christians. The first imperial persecution follows, and both Peter and Paul are traditionally executed in the years just after it." },
  { key: "temple-destroyed", title: "The Temple is destroyed", yearBc: -70, era: "The Apostles' End",
    description: "Rome ends the Jewish revolt by taking Jerusalem and burning the Temple. It has never been rebuilt, and the sacrificial system ends with it — about forty years after Jesus said not one stone would be left on another." },
  { key: "patmos", title: "John is exiled to Patmos", yearBc: -95, era: "The Apostles' End",
    description: "John is banished to the island of Patmos for his testimony, and there receives the visions written down as Revelation and sent to the seven churches of Asia.",
    dateConfidence: "good",
    dateUncertaintyNote: "Usually placed near the end of Domitian's reign on second-century testimony; a minority view dates Revelation before AD 70 instead." },
];

const eventIds: Record<string, string> = {};

async function seedEvents() {
  console.log("Seeding historical events...");
  for (const e of EVENTS) {
    const dateConfidence: DateConfidence = e.dateConfidence ?? "firm";
    const dateUncertaintyNote = e.dateUncertaintyNote ?? "";
    const existing = await db.execute({
      sql: `SELECT id, description, era, year_bc, date_uncertainty_note, date_confidence
            FROM historical_events WHERE title = ? LIMIT 1`,
      args: [e.title],
    });
    const row = existing.rows[0] as unknown as {
      id: string; description: string; era: string; year_bc: number;
      date_uncertainty_note: string; date_confidence: string;
    } | undefined;

    if (row) {
      eventIds[e.key] = row.id;
      const changed = row.description !== e.description || row.era !== e.era || row.year_bc !== e.yearBc
        || row.date_uncertainty_note !== dateUncertaintyNote || row.date_confidence !== dateConfidence;
      if (changed) {
        console.log(`  ${DRY_RUN ? "would update" : "updating"} event: ${e.title}`);
        if (!DRY_RUN) {
          await db.execute({
            sql: `UPDATE historical_events
                  SET description = ?, era = ?, year_bc = ?, date_uncertainty_note = ?, date_confidence = ?
                  WHERE id = ?`,
            args: [e.description, e.era, e.yearBc, dateUncertaintyNote, dateConfidence, row.id],
          });
        }
      }
      continue;
    }

    const id = crypto.randomUUID();
    eventIds[e.key] = id;
    console.log(`  ${DRY_RUN ? "would insert" : "inserting"} event: ${e.title} (${formatYear(e.yearBc)})`);
    if (!DRY_RUN) {
      await db.execute({
        sql: `INSERT INTO historical_events (id,title,year_bc,era,description,date_uncertainty_note,date_confidence,created_at)
              VALUES (?,?,?,?,?,?,?,datetime('now'))`,
        args: [id, e.title, e.yearBc, e.era, e.description, dateUncertaintyNote, dateConfidence],
      });
    }
  }
}

// Which book narrates each event. Every event needs one, or the book filter
// can never surface it — scripts/verify-timeline.ts asserts this.
const EVENT_REFS: { key: string; book: string; cs: number; vs: number; ce: number; ve: number; note: string }[] = [
  { key: "alexander",        book: "Daniel",     cs: 8,  vs: 20, ce: 8,  ve: 22, note: "The ram is Media and Persia, the goat Greece — read as Alexander's conquest" },
  { key: "antiochus",        book: "Daniel",     cs: 11, vs: 31, ce: 11, ve: 31, note: "Forces that desecrate the temple fortress and stop the daily sacrifice" },
  { key: "rededication",     book: "Daniel",     cs: 8,  vs: 13, ce: 8,  ve: 14, note: "How long until the sanctuary is restored to its rightful state" },
  { key: "herod-king",       book: "Matthew",    cs: 2,  vs: 1,  ce: 2,  ve: 2,  note: "Jesus is born in the days of Herod the king" },
  { key: "nativity",         book: "Luke",       cs: 2,  vs: 1,  ce: 2,  ve: 7,  note: "The census, the journey to Bethlehem and the birth" },
  { key: "herod-dies",       book: "Matthew",    cs: 2,  vs: 19, ce: 2,  ve: 20, note: "After Herod died, an angel tells Joseph to return from Egypt" },
  { key: "john-preaching",   book: "Luke",       cs: 3,  vs: 1,  ce: 3,  ve: 6,  note: "Dated to the fifteenth year of Tiberius Caesar" },
  { key: "baptism",          book: "Luke",       cs: 3,  vs: 21, ce: 3,  ve: 23, note: "Jesus is baptized and is about thirty years old" },
  { key: "entry",            book: "Matthew",    cs: 21, vs: 1,  ce: 21, ve: 11, note: "Jesus enters Jerusalem on a donkey's colt" },
  { key: "crucifixion",      book: "Luke",       cs: 23, vs: 33, ce: 23, ve: 46, note: "The crucifixion at the place called The Skull" },
  { key: "resurrection",     book: "Luke",       cs: 24, vs: 1,  ce: 24, ve: 8,  note: "The women find the stone rolled away and the tomb empty" },
  { key: "pentecost",        book: "Acts",       cs: 2,  vs: 1,  ce: 2,  ve: 4,  note: "The Spirit fills the gathered believers at Pentecost" },
  { key: "stephen",          book: "Acts",       cs: 7,  vs: 54, ce: 8,  ve: 1,  note: "Stephen is stoned as Saul looks on, and the church scatters" },
  { key: "damascus",         book: "Acts",       cs: 9,  vs: 1,  ce: 9,  ve: 9,  note: "The light on the Damascus road and Saul's blindness" },
  { key: "cornelius",        book: "Acts",       cs: 10, vs: 44, ce: 10, ve: 48, note: "The Spirit falls on Gentiles in Cornelius's house" },
  { key: "agrippa",          book: "Acts",       cs: 12, vs: 1,  ce: 12, ve: 23, note: "James is killed, Peter escapes prison, and Herod dies" },
  { key: "council",          book: "Acts",       cs: 15, vs: 6,  ce: 15, ve: 29, note: "The council's ruling and its letter to the Gentile churches" },
  { key: "claudius-expels",  book: "Acts",       cs: 18, vs: 1,  ce: 18, ve: 2,  note: "Claudius had ordered all Jews to leave Rome" },
  { key: "arrest",           book: "Acts",       cs: 21, vs: 27, ce: 21, ve: 36, note: "The riot in the temple courts and Paul's arrest" },
  { key: "rome",             book: "Acts",       cs: 28, vs: 16, ce: 28, ve: 31, note: "Two whole years in his own rented house, preaching unhindered" },
  { key: "fire",             book: "1 Peter",    cs: 4,  vs: 12, ce: 4,  ve: 16, note: "Do not be surprised at the fiery trial when it comes upon you" },
  { key: "temple-destroyed", book: "Matthew",    cs: 24, vs: 1,  ce: 24, ve: 2,  note: "Not one stone here will be left upon another" },
  { key: "patmos",           book: "Revelation", cs: 1,  vs: 9,  ce: 1,  ve: 9,  note: "I was on the island called Patmos on account of the word of God" },
];

async function seedEventRefs() {
  console.log("Tagging events with their narrating book...");
  for (const r of EVENT_REFS) {
    const eventId = eventIds[r.key];
    if (!eventId) { console.warn(`  MISSING event key: ${r.key}`); continue; }
    const existing = await db.execute({
      sql: `SELECT id, note FROM scripture_refs
            WHERE event_id = ? AND book = ? AND chapter_start = ? AND verse_start = ? AND chapter_end = ? AND verse_end = ?
            LIMIT 1`,
      args: [eventId, r.book, r.cs, r.vs, r.ce, r.ve],
    });
    const row = existing.rows[0] as unknown as { id: string; note: string } | undefined;
    if (row) {
      if (row.note !== r.note) {
        console.log(`  ${DRY_RUN ? "would update" : "updating"}: ${r.key} -> ${r.book} ${r.cs}:${r.vs} note`);
        if (!DRY_RUN) {
          await db.execute({ sql: "UPDATE scripture_refs SET note = ? WHERE id = ?", args: [r.note, row.id] });
        }
      }
      continue;
    }
    console.log(`  ${DRY_RUN ? "would tag" : "tagging"}: ${r.key} -> ${r.book} ${r.cs}:${r.vs}`);
    if (!DRY_RUN) {
      await db.execute({
        sql: `INSERT INTO scripture_refs
              (id,person_id,event_id,book,chapter_start,verse_start,chapter_end,verse_end,note,created_at)
              VALUES (?,'',?,?,?,?,?,?,?,datetime('now'))`,
        args: [crypto.randomUUID(), eventId, r.book, r.cs, r.vs, r.ce, r.ve, r.note],
      });
    }
  }
}

// Scripture refs for the emperors this script inserts, so the book filter can
// reach them the same way it reaches everyone else.
const PERSON_REFS: { name: string; aka: string; book: string; cs: number; vs: number; ce: number; ve: number; note: string }[] = [
  { name: "Caesar Augustus", aka: "Augustus, Octavian, Gaius Octavius", book: "Luke", cs: 2, vs: 1, ce: 2, ve: 5,
    note: "A decree went out from Caesar Augustus that all the world should be registered" },
  { name: "Tiberius", aka: "Tiberius Caesar, Tiberius Julius Caesar", book: "Luke", cs: 3, vs: 1, ce: 3, ve: 2,
    note: "In the fifteenth year of the reign of Tiberius Caesar" },
  { name: "Claudius", aka: "Claudius Caesar, Tiberius Claudius Caesar", book: "Acts", cs: 18, vs: 2, ce: 18, ve: 2,
    note: "Claudius had commanded all the Jews to leave Rome" },
  { name: "Claudius", aka: "Claudius Caesar, Tiberius Claudius Caesar", book: "Acts", cs: 11, vs: 28, ce: 11, ve: 28,
    note: "A great famine over all the world, which took place in the days of Claudius" },
  { name: "Nero", aka: "Nero Caesar, Nero Claudius Caesar", book: "Acts", cs: 25, vs: 10, ce: 25, ve: 12,
    note: "Paul appeals to Caesar — Nero, though Acts names only the office" },
];

async function seedPersonRefs() {
  console.log("Adding scripture refs for the inserted emperors...");
  for (const r of PERSON_REFS) {
    const personId = await resolvePerson(r.name, r.aka);
    if (!personId) { console.warn(`  MISSING person: ${r.name} (aka="${r.aka}")`); continue; }
    const existing = await db.execute({
      sql: `SELECT id, note FROM scripture_refs
            WHERE person_id = ? AND book = ? AND chapter_start = ? AND verse_start = ? AND chapter_end = ? AND verse_end = ?
            LIMIT 1`,
      args: [personId, r.book, r.cs, r.vs, r.ce, r.ve],
    });
    const row = existing.rows[0] as unknown as { id: string; note: string } | undefined;
    if (row) {
      if (row.note !== r.note) {
        console.log(`  ${DRY_RUN ? "would update" : "updating"}: ${r.name} ${r.book} ${r.cs}:${r.vs} note`);
        if (!DRY_RUN) {
          await db.execute({ sql: "UPDATE scripture_refs SET note = ? WHERE id = ?", args: [r.note, row.id] });
        }
      }
      continue;
    }
    console.log(`  ${DRY_RUN ? "would add" : "adding"}: ${r.name} -> ${r.book} ${r.cs}:${r.vs}`);
    if (!DRY_RUN) {
      await db.execute({
        sql: `INSERT INTO scripture_refs
              (id,person_id,event_id,book,chapter_start,verse_start,chapter_end,verse_end,note,created_at)
              VALUES (?,?,NULL,?,?,?,?,?,?,datetime('now'))`,
        args: [crypto.randomUUID(), personId, r.book, r.cs, r.vs, r.ce, r.ve, r.note],
      });
    }
  }
}

type LinkDef = {
  prophet: string; aka: string; book: string; cs: number; vs: number; ce: number; ve: number;
  eventKey: string; explanation: string; uncertaintyNote?: string;
};

// The point of the whole exercise: Old Testament promises tied to the New
// Testament moments they land on. Jesus appears here as a prophet too, for the
// one prophecy of his whose fulfillment this timeline can date.
const LINKS: LinkDef[] = [
  { prophet: "Micah", aka: "Micah of Moresheth", book: "Micah", cs: 5, vs: 2, ce: 5, ve: 2, eventKey: "nativity",
    explanation: "Micah named Bethlehem Ephrathah — too small to count among Judah's clans — as the birthplace of a ruler whose origins are from of old. Herod's own scribes quote this verse to the wise men." },
  { prophet: "Isaiah", aka: "Isaiah son of Amoz", book: "Isaiah", cs: 7, vs: 14, ce: 7, ve: 14, eventKey: "nativity",
    explanation: "Isaiah promised a sign: a virgin would conceive and bear a son called Immanuel, God with us. Matthew opens his Gospel by applying it to Jesus' birth.",
    uncertaintyNote: "The Hebrew word almah means a young woman of marriageable age; the Greek Old Testament that the New Testament writers quoted renders it parthenos, virgin. Isaiah 7 also has a nearer horizon in Ahaz's own day, which is why the verse is usually read as having both an immediate and a longer fulfillment." },
  { prophet: "Isaiah", aka: "Isaiah son of Amoz", book: "Isaiah", cs: 9, vs: 6, ce: 9, ve: 7, eventKey: "nativity",
    explanation: "Isaiah announced a child born to carry the government on his shoulders and to reign on David's throne without end." },
  { prophet: "Isaiah", aka: "Isaiah son of Amoz", book: "Isaiah", cs: 40, vs: 3, ce: 40, ve: 5, eventKey: "john-preaching",
    explanation: "Isaiah described a voice crying in the wilderness to prepare the Lord's way. All four Gospels apply it to John the Baptist." },
  { prophet: "Malachi", aka: "", book: "Malachi", cs: 3, vs: 1, ce: 3, ve: 1, eventKey: "john-preaching",
    explanation: "Malachi's promise of a messenger sent ahead to prepare the way is the note the Old Testament ends on. The Gospels pick it up four centuries later in John." },
  { prophet: "Zechariah", aka: "Zechariah son of Berechiah", book: "Zechariah", cs: 9, vs: 9, ce: 9, ve: 9, eventKey: "entry",
    explanation: "Zechariah pictured Jerusalem's king arriving humble and riding on a donkey's colt. Jesus deliberately entered the city that way in his final week." },
  { prophet: "Isaiah", aka: "Isaiah son of Amoz", book: "Isaiah", cs: 53, vs: 4, ce: 53, ve: 6, eventKey: "crucifixion",
    explanation: "Isaiah's suffering servant is pierced for other people's transgressions and crushed for their iniquities, and stays silent before his accusers." },
  { prophet: "David", aka: "", book: "Psalms", cs: 22, vs: 16, ce: 22, ve: 18, eventKey: "crucifixion",
    explanation: "David wrote of pierced hands and feet, and of onlookers dividing his garments by lot. The Gospels report both at the cross, and Jesus quotes this psalm's opening line from it." },
  { prophet: "Zechariah", aka: "Zechariah son of Berechiah", book: "Zechariah", cs: 11, vs: 12, ce: 11, ve: 13, eventKey: "crucifixion",
    explanation: "Zechariah's shepherd is valued at thirty pieces of silver, which are then thrown to the potter in the house of the Lord. Matthew reports both details in Judas' betrayal and the buying of the potter's field." },
  { prophet: "Daniel", aka: "Belteshazzar", book: "Daniel", cs: 9, vs: 26, ce: 9, ve: 26, eventKey: "crucifixion",
    explanation: "Daniel's seventy weeks include an anointed one cut off with nothing, followed by the destruction of the city and the sanctuary.",
    uncertaintyNote: "The seventy-weeks passage is among the most debated in the Bible. Both the arithmetic and the starting decree are disputed, and readings differ over whether it points to Christ, to Antiochus IV, or to a still-future figure." },
  { prophet: "David", aka: "", book: "Psalms", cs: 16, vs: 9, ce: 16, ve: 10, eventKey: "resurrection",
    explanation: "David wrote that God would not abandon him to the grave or let his holy one see decay. Peter preached this at Pentecost, pointing out that David's own tomb was still there and still occupied." },
  { prophet: "Joel", aka: "Joel son of Pethuel", book: "Joel", cs: 2, vs: 28, ce: 2, ve: 32, eventKey: "pentecost",
    explanation: "Joel foresaw God pouring out his Spirit on all people, with sons and daughters prophesying. Peter's first words at Pentecost were that this is that." },
  { prophet: "Daniel", aka: "Belteshazzar", book: "Daniel", cs: 8, vs: 20, ce: 8, ve: 22, eventKey: "alexander",
    explanation: "Daniel's vision named the ram as Media and Persia and the goat as Greece, whose great horn would be broken and replaced by four. Alexander's empire was divided among four of his generals after his death." },
  { prophet: "Daniel", aka: "Belteshazzar", book: "Daniel", cs: 11, vs: 31, ce: 11, ve: 31, eventKey: "antiochus",
    explanation: "Daniel described forces that would desecrate the temple fortress, stop the daily sacrifice and set up the abomination that causes desolation — which is what Antiochus IV did in 167 BC." },
  { prophet: "Jesus", aka: "Jesus of Nazareth, Jesus Christ, the Messiah", book: "Matthew", cs: 24, vs: 1, ce: 24, ve: 2, eventKey: "temple-destroyed",
    explanation: "Leaving the temple, Jesus told his disciples that not one stone would be left standing on another. Rome burned it about forty years later." },
];

async function seedProphecyLinks() {
  console.log("Seeding prophecy links...");
  for (const l of LINKS) {
    const prophetId = await resolvePerson(l.prophet, l.aka);
    if (!prophetId) { console.warn(`  MISSING prophet: ${l.prophet} (aka="${l.aka}")`); continue; }
    const eventId = eventIds[l.eventKey];
    if (!eventId) { console.warn(`  MISSING event key: ${l.eventKey}`); continue; }
    const uncertaintyNote = l.uncertaintyNote ?? "";

    const existing = await db.execute({
      sql: `SELECT id, fulfillment_event_id, explanation, uncertainty_note FROM prophecy_links
            WHERE prophet_person_id = ? AND prophecy_book = ? AND prophecy_chapter_start = ? AND prophecy_verse_start = ?
            LIMIT 1`,
      args: [prophetId, l.book, l.cs, l.vs],
    });
    const row = existing.rows[0] as unknown as {
      id: string; fulfillment_event_id: string; explanation: string; uncertainty_note: string;
    } | undefined;

    if (row) {
      const changed = row.fulfillment_event_id !== eventId
        || row.explanation !== l.explanation || row.uncertainty_note !== uncertaintyNote;
      if (changed) {
        console.log(`  ${DRY_RUN ? "would update" : "updating"}: ${l.prophet} ${l.book} ${l.cs}:${l.vs} -> ${l.eventKey}`);
        if (!DRY_RUN) {
          await db.execute({
            sql: `UPDATE prophecy_links SET fulfillment_event_id = ?, explanation = ?, uncertainty_note = ? WHERE id = ?`,
            args: [eventId, l.explanation, uncertaintyNote, row.id],
          });
        }
      }
      continue;
    }

    console.log(`  ${DRY_RUN ? "would link" : "linking"}: ${l.prophet} ${l.book} ${l.cs}:${l.vs} -> ${l.eventKey}`);
    if (!DRY_RUN) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO prophecy_links
              (id,prophet_person_id,prophecy_book,prophecy_chapter_start,prophecy_verse_start,
               prophecy_chapter_end,prophecy_verse_end,fulfillment_event_id,explanation,uncertainty_note,created_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))`,
        args: [crypto.randomUUID(), prophetId, l.book, l.cs, l.vs, l.ce, l.ve, eventId, l.explanation, uncertaintyNote],
      });
    }
  }
}

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== LIVE RUN ===");
  await seedMissingPeople();
  await seedTimelineDates();
  await seedEvents();
  await seedEventRefs();
  await seedPersonRefs();
  await seedProphecyLinks();
  console.log("Done.");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
