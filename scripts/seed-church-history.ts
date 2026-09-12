// Church-history timeline dataset: AD 101 (end of the New Testament era) to
// AD 1980. Stamps timeline_* columns onto ~57 figures from the persecuted
// church through the twentieth century, and seeds the ~60 events tying the
// eight new periods together (councils, schisms, revivals). Follows
// scripts/seed-nt-timeline.ts's conventions exactly.
//
// SCOPE: this script seeds PEOPLE and EVENTS only -- not traditions/
// denominations, which get their own table and seed script
// (scripts/seed-traditions.ts, Phase 3). A person here who founded a
// tradition (Luther, Wesley) is linked to it via tradition_people once that
// table exists; for now they are ordinary timeline people like any prophet
// or apostle.
//
// YEARS: the timeline stores years counting DOWN, so AD is the negative of
// BC. AD 1517 is -1517. See lib/timeline-layout.ts.
//
// Idempotent -- safe to re-run; a second run with unchanged data arrays
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

async function resolvePersonRow(name: string, aka: string): Promise<{ id: string; description: string } | null> {
  const r = await db.execute({
    sql: "SELECT id, description FROM people WHERE name = ? AND also_known_as = ?",
    args: [name, aka],
  });
  if (r.rows.length > 1) {
    throw new Error(`Ambiguous person match: ${r.rows.length} rows for (name="${name}", aka="${aka}") -- refusing to guess.`);
  }
  return (r.rows[0] as unknown as { id: string; description: string } | undefined) ?? null;
}

async function resolvePerson(name: string, aka: string): Promise<string | null> {
  const row = await resolvePersonRow(name, aka);
  return row ? row.id : null;
}

async function upsertPerson(p: {
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
            VALUES (?,?,?,?,'CH','','',?,?,datetime('now'))`,
      args: [id, p.name, p.alsoKnownAs, p.gender, p.description, JSON.stringify(p.tags)],
    });
  }
  return id;
}

// [name, also_known_as, startYear, endYear] -- years count down, AD negative.
type Row = [string, string, number, number];

// ── Church fathers (patristic era, c. 100-430) ─────────────────────────────
const CHURCH_FATHERS: Row[] = [
  ["Ignatius", "Ignatius of Antioch", -35, -107],
  ["Polycarp", "Polycarp of Smyrna, disciple of John", -69, -155],
  ["Justin Martyr", "Justin the Martyr, Justin of Caesarea", -100, -165],
  ["Irenaeus", "Irenaeus of Lyon", -130, -202],
  ["Tertullian", "Tertullian of Carthage", -155, -220],
  ["Origen", "Origen of Alexandria", -185, -253],
  ["Athanasius", "Athanasius of Alexandria", -296, -373],
  ["Basil the Great", "Basil of Caesarea", -330, -379],
  ["Gregory of Nazianzus", "Gregory the Theologian", -329, -390],
  ["Ambrose", "Ambrose of Milan", -339, -397],
  ["John Chrysostom", "John of Antioch, Archbishop of Constantinople", -347, -407],
  ["Jerome", "Jerome of Stridon, translator of the Vulgate", -347, -420],
  ["Augustine of Hippo", "Augustine, Aurelius Augustinus", -354, -430],
];
const CHURCH_FATHER_NOTES: Record<string, string> = {
  "Ignatius": "Traditionally martyred under Trajan; the exact year is disputed anywhere from AD 107 to AD 140.",
  "Polycarp": "Traditionally John's own disciple. His martyrdom is dated variously to AD 155, 156 or 167 depending on which Roman proconsul's term it is matched against.",
  "Justin Martyr": "Birth year is an estimate from his own writings' internal chronology, not a recorded date.",
};

// ── Church rulers (popes and organisers) ───────────────────────────────────
const CHURCH_RULERS: Row[] = [
  ["Leo I", "Leo the Great, Pope Leo I", -400, -461],
  ["Gregory the Great", "Pope Gregory I", -540, -604],
];
const CHURCH_RULER_NOTES: Record<string, string> = {
  "Leo I": "Birth year is an estimate; his death (461) and his decisive role at the Council of Chalcedon (451) are firmly dated.",
  "Gregory the Great": "Birth year is an estimate; his papacy (590-604) and the mission he sent to England (597) are firmly dated.",
};

// ── Missionaries ────────────────────────────────────────────────────────────
const MISSIONARIES: Row[] = [
  ["Patrick", "Patrick of Ireland, Saint Patrick", -385, -461],
  ["Columba", "Columba of Iona", -521, -597],
  ["Augustine of Canterbury", "Augustine, first Archbishop of Canterbury", -597, -604],
  ["Boniface", "Boniface, Apostle to the Germans, Winfrid", -675, -754],
  ["Cyril", "Cyril, Apostle to the Slavs, Constantine the Philosopher", -827, -869],
  ["Methodius", "Methodius, Apostle to the Slavs", -815, -885],
  ["William Carey", "William Carey, father of modern missions", -1761, -1834],
  ["George Whitefield", "George Whitefield, evangelist of the Great Awakening", -1714, -1770],
  ["Hudson Taylor", "James Hudson Taylor, founder of the China Inland Mission", -1832, -1905],
];
const MISSIONARY_NOTES: Record<string, string> = {
  "Patrick": "Birth year is a scholarly estimate; nothing in his own writings gives one.",
  "Columba": "Both dates are firmly attested; his founding of Iona (563) is the better-known marker of his mission.",
  "Augustine of Canterbury": "No birth year is recorded at all. Dated instead by his mission: landing in Kent in 597 and dying, still archbishop, in 604.",
};

// ── Theologians ─────────────────────────────────────────────────────────────
const THEOLOGIANS: Row[] = [
  ["Anselm", "Anselm of Canterbury", -1033, -1109],
  ["Bernard of Clairvaux", "Bernard of Clairvaux", -1090, -1153],
  ["Thomas Aquinas", "Thomas Aquinas, the Angelic Doctor", -1225, -1274],
  ["Jonathan Edwards", "Jonathan Edwards, theologian of the Great Awakening", -1703, -1758],
  ["Karl Barth", "Karl Barth, author of the Barmen Declaration", -1886, -1968],
  ["C. S. Lewis", "Clive Staples Lewis", -1898, -1963],
];

// ── Reformers (and their medieval forerunners) ─────────────────────────────
// Wycliffe and Hus are the one pair here genuinely placed by lifespan: both
// died before 1517 and belong, correctly, in "Christendom Divided" as
// forerunners -- that IS the point of that chapter's summary. Everyone from
// Luther onward is placed by when their reforming activity actually began,
// not their birth, for a concrete reason: every one of them was born before
// 1517, so seeding them by birth year would put the entire cast of "The
// Reformation" chapter in the previous chapter instead, leaving the one era
// named after the Reformation with no reformers in it. This is exactly the
// "ministry span reads better than lifespan" treatment the findings doc
// already promised and the prophets already get -- applied here because a
// concrete check surfaced that skipping it wasn't a stylistic nicety but a
// correctness bug. End year stays each reformer's actual death.
const REFORMERS: Row[] = [
  ["John Wycliffe", "John Wycliffe, the Morning Star of the Reformation", -1328, -1384],
  ["Jan Hus", "Jan Hus, Bohemian reformer", -1369, -1415],
  ["Martin Luther", "Martin Luther, author of the Ninety-five Theses", -1517, -1546],
  ["Huldrych Zwingli", "Huldrych Zwingli, reformer of Zurich", -1519, -1531],
  ["Thomas Cranmer", "Thomas Cranmer, Archbishop of Canterbury", -1533, -1556],
  ["William Tyndale", "William Tyndale, Bible translator", -1525, -1536],
  ["Menno Simons", "Menno Simons, namesake of the Mennonites", -1536, -1561],
  ["John Calvin", "John Calvin, reformer of Geneva", -1536, -1564],
  ["John Knox", "John Knox, reformer of Scotland", -1559, -1572],
  ["George Fox", "George Fox, founder of the Quakers", -1647, -1691],
  ["John Wesley", "John Wesley, founder of Methodism", -1703, -1791],
];
const REFORMER_NOTES: Record<string, string> = {
  "John Wycliffe": "Birth year is an estimate.",
  "Jan Hus": "Birth year is an estimate.",
  "Martin Luther": "Shown from the Ninety-five Theses (1517) to his death, not his birth (1483) -- see the note above this table.",
  "Huldrych Zwingli": "Shown from his arrival in Zurich and start of reform preaching (1519) to his death, not his birth (1484).",
  "Thomas Cranmer": "Shown from becoming Archbishop of Canterbury (1533) to his death, not his birth (1489).",
  "William Tyndale": "Shown from his English New Testament reaching print (1525) to his execution, not his birth (c. 1494, itself an estimate).",
  "Menno Simons": "Shown from leaving the priesthood to join the Anabaptists (1536) to his death, not his birth (c. 1496, itself an estimate).",
  "John Calvin": "Shown from reaching Geneva and publishing the Institutes (1536) to his death, not his birth (1509).",
  "John Knox": "Shown from returning to Scotland to lead its Reformation (1559) to his death, not his birth (c. 1514).",
  "George Fox": "Shown from the start of his public ministry (1647) to his death, not his birth (1624).",
};

// ── Church leaders (a deliberately broad catch-all -- monastic founders,
// Counter-Reformation figures, revivalists, modern figures -- none of whom
// fits cleanly as a father, a reformer, or a missionary, and all of whom
// would be worse off forced into one of those boxes than left in a plainly
// generic "church leader" lane) ────────────────────────────────────────────
const CHURCH_LEADERS: Row[] = [
  ["Francis of Assisi", "Francis of Assisi, founder of the Franciscans", -1181, -1226],
  ["Ignatius of Loyola", "Ignatius of Loyola, founder of the Jesuits", -1491, -1556],
  ["Teresa of Avila", "Teresa of Avila, Carmelite reformer and mystic", -1515, -1582],
  ["John Bunyan", "John Bunyan, author of The Pilgrim's Progress", -1628, -1688],
  ["Charles Wesley", "Charles Wesley, hymn writer, co-founder of Methodism", -1707, -1788],
  ["Charles Finney", "Charles Grandison Finney, revivalist", -1792, -1875],
  ["William Booth", "William Booth, founder of the Salvation Army", -1829, -1912],
  ["Charles Spurgeon", "Charles Haddon Spurgeon, the Prince of Preachers", -1834, -1892],
  ["D. L. Moody", "Dwight Lyman Moody, evangelist", -1837, -1899],
  ["D. S. Warner", "Daniel Sidney Warner, founder of the Church of God (Anderson)", -1842, -1895],
  ["William J. Seymour", "William Joseph Seymour, leader of the Azusa Street revival", -1870, -1922],
  ["Dietrich Bonhoeffer", "Dietrich Bonhoeffer, Confessing Church pastor and martyr", -1906, -1945],
  ["Mother Teresa", "Mother Teresa of Calcutta, Anjeze Gonxhe Bojaxhiu", -1910, -1997],
  ["Billy Graham", "Billy Graham, evangelist", -1918, -2018],
  ["Martin Luther King Jr.", "Martin Luther King Jr., Baptist minister and civil rights leader", -1929, -1968],
];

async function stampDates(
  rows: Row[],
  track: TimelineTrack,
  confidence: DateConfidence,
  noteFor: (name: string) => string,
) {
  for (const [name, aka, startYear, endYear] of rows) {
    const id = await resolvePerson(name, aka);
    if (!id) { console.warn(`  MISSING: ${name} (aka="${aka}") -- not found, skipping`); continue; }
    const note = noteFor(name);
    console.log(`  ${DRY_RUN ? "would stamp" : "stamping"}: ${name} ${formatYearSpan(startYear, endYear)} [${track}]`);
    if (!DRY_RUN) {
      await db.execute({
        sql: `UPDATE people SET timeline_start_bc = ?, timeline_end_bc = ?, timeline_track = ?,
              date_confidence = ?, date_uncertainty_note = ? WHERE id = ?`,
        args: [startYear, endYear, track, note ? "good" : confidence, note, id],
      });
    }
  }
}

async function seedMissingPeople() {
  console.log("Inserting church-history figures not already in the database...");
  const all: { rows: Row[]; describe: (name: string) => string; tags: string[] }[] = [
    { rows: CHURCH_FATHERS, tags: ["church father"], describe: name => CHURCH_FATHER_DESCRIPTIONS[name] },
    { rows: CHURCH_RULERS, tags: ["pope"], describe: name => CHURCH_RULER_DESCRIPTIONS[name] },
    { rows: MISSIONARIES, tags: ["missionary"], describe: name => MISSIONARY_DESCRIPTIONS[name] },
    { rows: THEOLOGIANS, tags: ["theologian"], describe: name => THEOLOGIAN_DESCRIPTIONS[name] },
    { rows: REFORMERS, tags: ["reformer"], describe: name => REFORMER_DESCRIPTIONS[name] },
    { rows: CHURCH_LEADERS, tags: ["church leader"], describe: name => CHURCH_LEADER_DESCRIPTIONS[name] },
  ];
  for (const group of all) {
    for (const [name, aka] of group.rows) {
      await upsertPerson({
        name, alsoKnownAs: aka, gender: FEMALE_NAMES.has(name) ? "female" : "male",
        description: group.describe(name), tags: group.tags,
      });
    }
  }
}

const FEMALE_NAMES = new Set(["Teresa of Avila", "Mother Teresa"]);

// One-line descriptions, keyed by name. Kept separate from the Row tuples so
// the date tables above stay scannable.
const CHURCH_FATHER_DESCRIPTIONS: Record<string, string> = {
  "Ignatius": "Bishop of Antioch, traditionally a disciple of the apostle John. Wrote seven letters to churches while under guard on the way to his martyrdom in Rome, urging unity around the bishop and warning against docetism.",
  "Polycarp": "Bishop of Smyrna, traditionally a disciple of the apostle John himself. His martyrdom account -- refusing to curse Christ after eighty-six years of service to him -- is the earliest surviving account of a Christian martyrdom outside the New Testament.",
  "Justin Martyr": "A philosopher converted to Christianity who kept his philosopher's cloak, arguing that Christ is the Logos every honest philosophy was already reaching toward. Beheaded at Rome for refusing to sacrifice to the gods.",
  "Irenaeus": "Bishop of Lyon and student of Polycarp. His Against Heresies is the first sustained defense of the four-Gospel canon and the rule of apostolic succession against Gnostic teachers.",
  "Tertullian": "North African lawyer turned theologian, the first major Christian writer in Latin and the first to use the word 'Trinity' (trinitas) for the triune God. Coined 'the blood of the martyrs is the seed of the church.'",
  "Origen": "Alexandrian scholar of enormous output, the first systematic Christian theologian and a pioneering biblical textual critic. Later condemned for some of his speculative views, but formative for how the early church argued theology at all.",
  "Athanasius": "Bishop of Alexandria and the fiercest defender of the Nicene Creed's claim that the Son is of one substance with the Father, exiled five times for it. His 39th Festal Letter (367) is the earliest surviving list of exactly the 27 New Testament books.",
  "Basil the Great": "Bishop of Caesarea, one of the three Cappadocian Fathers who completed the doctrine of the Trinity after Nicaea. Also organized Christian charity and monastic life on a scale that shaped both permanently.",
  "Gregory of Nazianzus": "Known as 'the Theologian,' one of the three Cappadocian Fathers. His orations at Constantinople defended and clarified the divinity of the Holy Spirit as much as of the Son.",
  "Ambrose": "Bishop of Milan who baptized Augustine and once made the emperor Theodosius do public penance for a massacre -- establishing that even an emperor answered to the church's moral authority.",
  "John Chrysostom": "Archbishop of Constantinople nicknamed 'Golden-mouthed' for his preaching. Repeatedly exiled for denouncing the excesses of the imperial court, and died on the way to his final exile.",
  "Jerome": "Translated the entire Bible into Latin -- the Vulgate -- working from the original Hebrew and Greek rather than earlier Latin translations. That version remained the West's standard Bible for a thousand years.",
  "Augustine of Hippo": "Bishop of Hippo in North Africa and the most influential theologian in Western Christian history. His Confessions and City of God shaped Catholic and Protestant thought alike on grace, sin, the will, and the church's relationship to worldly power.",
};
const CHURCH_RULER_DESCRIPTIONS: Record<string, string> = {
  "Leo I": "Pope whose Tome shaped the Council of Chalcedon's definition of Christ in two natures, and who reportedly persuaded Attila the Hun to turn back from Rome. The strongest early assertion of Roman primacy among the bishops.",
  "Gregory the Great": "Pope who reformed the church's finances and worship, wrote a hugely influential manual on pastoral care, and sent Augustine of Canterbury to evangelize England in 597.",
};
const MISSIONARY_DESCRIPTIONS: Record<string, string> = {
  "Patrick": "Enslaved in Ireland as a young man, escaped, then returned voluntarily as a missionary bishop. Traditionally credited with converting much of Ireland and founding its church.",
  "Columba": "Irish monk who founded the monastery at Iona, the base from which Christianity spread through Scotland and northern England.",
  "Augustine of Canterbury": "Sent by Pope Gregory the Great to evangelize the Anglo-Saxons. Landed in Kent in 597, baptized King Ethelbert, and became the first Archbishop of Canterbury.",
  "Boniface": "English monk called the 'Apostle to the Germans' for his mission to the Germanic tribes, famously felling a sacred oak dedicated to Thor to demonstrate its powerlessness. Martyred by a group he was trying to evangelize.",
  "Cyril": "With his brother Methodius, devised the Glagolitic alphabet (ancestor of Cyrillic) to translate scripture and liturgy into Slavic languages, giving the Slavic peoples both a written language and the Christian faith in it.",
  "Methodius": "Brother of Cyril and co-missionary to the Slavs. Continued their translation work and organized the Slavic church after Cyril's death.",
  "William Carey": "English cobbler turned missionary to India, often called the father of modern missions. Translated scripture into multiple Indian languages and helped found the Baptist Missionary Society.",
  "George Whitefield": "Itinerant preacher of the Great Awakening on both sides of the Atlantic, friend and sometime rival of the Wesleys, credited with some of the largest open-air crowds of the eighteenth century.",
  "Hudson Taylor": "Founded the China Inland Mission, insisted missionaries adopt Chinese dress and customs rather than Western ones, and became one of the most influential missionary figures of the modern era.",
};
const THEOLOGIAN_DESCRIPTIONS: Record<string, string> = {
  "Anselm": "Archbishop of Canterbury whose Cur Deus Homo ('Why God Became Man') gave the classic medieval account of why Christ's death was necessary to satisfy divine justice. Also framed the ontological argument for God's existence.",
  "Bernard of Clairvaux": "Cistercian abbot whose preaching and writing on the love of God shaped medieval spirituality profoundly, and who preached the Second Crusade.",
  "Thomas Aquinas": "Dominican friar whose Summa Theologica synthesized Aristotelian philosophy with Christian theology into the framework that still defines Catholic theology today. Died leaving the Summa unfinished.",
  "Jonathan Edwards": "New England pastor and philosopher-theologian of the Great Awakening, best known for the sermon 'Sinners in the Hands of an Angry God' but regarded by scholars as America's most significant theologian.",
  "Karl Barth": "Swiss theologian whose Church Dogmatics reoriented much of twentieth-century Protestant theology back toward the Bible and away from liberal theology's confidence in human reason. Chief author of the Barmen Declaration against Nazi control of the German church.",
  "C. S. Lewis": "Oxford and Cambridge scholar turned popular Christian apologist and novelist. Mere Christianity, The Screwtape Letters and the Chronicles of Narnia made him one of the most widely read Christian writers of the twentieth century.",
};
const REFORMER_DESCRIPTIONS: Record<string, string> = {
  "John Wycliffe": "Oxford theologian who argued scripture alone, not the church hierarchy, is the final authority, and organized the first English translation of the whole Bible. Condemned as a heretic after his death; his body was exhumed and burned in 1428.",
  "Jan Hus": "Bohemian priest influenced by Wycliffe who preached against clerical corruption and papal authority. Burned at the Council of Constance in 1415 despite a promised safe conduct, sparking the Hussite movement.",
  "Martin Luther": "German monk whose Ninety-five Theses against the sale of indulgences (1517) opened the Reformation. Taught salvation by faith alone, translated the Bible into German, and was excommunicated and outlawed for refusing to recant.",
  "Huldrych Zwingli": "Led the Reformation in Zurich independently of Luther, breaking further from Catholic practice on the Lord's Supper. Died in battle defending Zurich's Protestant cantons.",
  "Thomas Cranmer": "Archbishop of Canterbury under Henry VIII and Edward VI, chief architect of the Book of Common Prayer. Burned at the stake under the Catholic Mary I after recanting his recantation.",
  "William Tyndale": "Translated the New Testament into English directly from Greek, against English law, printing copies abroad and smuggling them in. Executed for heresy; much of his wording survives in the King James Bible.",
  "Menno Simons": "Former Catholic priest who became a leading Anabaptist teacher, giving his name to the Mennonites. Taught believer's baptism, nonresistance, and separation of church and state.",
  "John Calvin": "French reformer based in Geneva whose Institutes of the Christian Religion systematized Reformed theology, emphasizing God's sovereignty in salvation. His influence shaped Presbyterian, Reformed, and Puritan traditions.",
  "John Knox": "Led the Reformation in Scotland, establishing Presbyterianism as the national church's government. A student of Calvin's Geneva who brought its model home.",
  "George Fox": "Founded the Religious Society of Friends (Quakers), teaching that the Spirit speaks directly to every believer without need of clergy, creed, or sacrament, and rejecting oaths and violence.",
  "John Wesley": "Anglican priest whose heart was 'strangely warmed' at a meeting on Aldersgate Street (1738); organized the 'Methodist' societies within the Church of England that became, after his death, the separate Methodist Church.",
};
const CHURCH_LEADER_DESCRIPTIONS: Record<string, string> = {
  "Francis of Assisi": "Wealthy merchant's son who renounced his inheritance to live in radical poverty, founding the Franciscan order on preaching, poverty, and care for the poor and creation.",
  "Ignatius of Loyola": "Spanish soldier converted during a long convalescence, who founded the Jesuits (Society of Jesus) to serve as an educated, mobile arm of Catholic renewal and mission during the Counter-Reformation.",
  "Teresa of Avila": "Carmelite nun and mystic who reformed her order back toward strict contemplative life, and whose writings on prayer remain foundational in Catholic spirituality. A Doctor of the Church.",
  "John Bunyan": "Puritan preacher jailed for years for preaching without a license, during which he wrote The Pilgrim's Progress -- one of the most widely read books in the English language after the Bible.",
  "Charles Wesley": "Brother of John Wesley and co-founder of Methodism, wrote over six thousand hymns including 'Hark! The Herald Angels Sing' and 'And Can It Be,' shaping how English-speaking Christians sing to this day.",
  "Charles Finney": "Lawyer turned revivalist of the Second Great Awakening, pioneered 'new measures' in evangelism and taught that revival could be deliberately produced rather than merely prayed for.",
  "William Booth": "Methodist preacher who founded the Salvation Army in London's East End to evangelize and serve the urban poor, organizing it along quasi-military lines that spread worldwide.",
  "Charles Spurgeon": "London Baptist pastor known as the 'Prince of Preachers,' whose sermons were transcribed and distributed by the millions and are still widely read today.",
  "D. L. Moody": "Shoe salesman turned evangelist whose revival campaigns in Britain and America, and the schools and Bible institute he founded, made him one of the most influential figures of nineteenth-century evangelicalism.",
  "D. S. Warner": "Left the General Eldership of the Churches of God in 1881, holding that denominational organization itself was unbiblical, and founded what became the Church of God (Anderson, Indiana) reformation movement.",
  "William J. Seymour": "Son of formerly enslaved parents, led the Azusa Street revival (1906) in Los Angeles, from which Pentecostalism spread to become a global movement.",
  "Dietrich Bonhoeffer": "German Lutheran pastor and theologian, a leader of the Confessing Church's resistance to Nazi control of the church. Executed by the Nazis weeks before the war's end for involvement in a plot against Hitler.",
  "Mother Teresa": "Albanian-born Catholic nun who founded the Missionaries of Charity in Calcutta to care for the poorest and dying, becoming one of the most recognized Christian figures of the twentieth century.",
  "Billy Graham": "American evangelist whose crusades, beginning with Los Angeles in 1949, reached more people in person than perhaps any preacher in history, and who became an informal spiritual advisor to multiple U.S. presidents.",
  "Martin Luther King Jr.": "Baptist minister who led the American civil rights movement through nonviolent resistance grounded explicitly in Christian theology and the Hebrew prophets' call for justice. Assassinated in 1968.",
};

async function seedTimelineDates() {
  console.log("Stamping church-history timeline dates...");
  await stampDates(CHURCH_FATHERS, "church_father", "good", name => CHURCH_FATHER_NOTES[name] ?? "");
  await stampDates(CHURCH_RULERS, "church_ruler", "good", name => CHURCH_RULER_NOTES[name] ?? "");
  await stampDates(MISSIONARIES, "missionary", "firm", name => MISSIONARY_NOTES[name] ?? "");
  await stampDates(THEOLOGIANS, "theologian", "firm", () => "");
  await stampDates(REFORMERS, "reformer", "firm", name => REFORMER_NOTES[name] ?? "");
  await stampDates(CHURCH_LEADERS, "church_leader", "firm", () => "");
}

type EventDef = {
  key: string; title: string; yearBc: number; era: string; description: string;
  dateUncertaintyNote?: string; dateConfidence?: DateConfidence;
};

const EVENTS: EventDef[] = [
  // ── The Persecuted Church (101-312) ──────────────────────────────────────
  { key: "ignatius-martyred", title: "Ignatius of Antioch is martyred at Rome", yearBc: -107, era: "The Persecuted Church",
    description: "Condemned to be thrown to wild beasts in Rome's arena, Ignatius writes seven letters to churches along the way, the earliest surviving Christian writings outside the New Testament.",
    dateConfidence: "uncertain", dateUncertaintyNote: "Dated anywhere from AD 107 to AD 140 depending on which emperor's reign is assumed." },
  { key: "polycarp-martyred", title: "Polycarp is burned at Smyrna", yearBc: -155, era: "The Persecuted Church",
    description: "The aged bishop, reportedly John's own disciple, refuses to curse Christ -- 'eighty-six years I have served him, and he has done me no wrong' -- and is burned before a crowd.",
    dateConfidence: "uncertain", dateUncertaintyNote: "Variously dated to AD 155, 156 or 167." },
  { key: "justin-martyred", title: "Justin Martyr is beheaded at Rome", yearBc: -165, era: "The Persecuted Church",
    description: "A philosopher who became a Christian apologist, Justin is executed with several companions for refusing to sacrifice to the Roman gods." },
  { key: "irenaeus-writes", title: "Irenaeus writes Against Heresies", yearBc: -180, era: "The Persecuted Church",
    description: "The bishop of Lyon mounts the first sustained defense of the four-Gospel canon and apostolic succession against Gnostic teachers claiming secret revelation." },
  { key: "decian-persecution", title: "The Decian persecution", yearBc: -250, era: "The Persecuted Church",
    description: "Emperor Decius orders empire-wide sacrifice to the Roman gods on pain of death, the first systematic, empire-wide persecution of Christians. The aftermath forces the church to decide what to do with believers who complied." },
  { key: "great-persecution", title: "Diocletian's Great Persecution begins", yearBc: -303, era: "The Persecuted Church",
    description: "The last and most severe empire-wide persecution: churches destroyed, scriptures burned, and Christians ordered to sacrifice or die." },
  { key: "milvian-bridge", title: "Constantine wins at the Milvian Bridge", yearBc: -312, era: "The Persecuted Church",
    description: "Constantine defeats his rival Maxentius after reportedly seeing a vision of the cross, becoming the first Christian emperor and ending the age of persecution." },

  // ── The Church and the Empire (313-450) ──────────────────────────────────
  { key: "edict-of-milan", title: "The Edict of Milan", yearBc: -313, era: "The Church and the Empire",
    description: "Constantine and co-emperor Licinius legalize Christianity throughout the empire, ending persecution -- toleration, not yet establishment as the state religion." },
  { key: "nicaea-1", title: "The First Council of Nicaea", yearBc: -325, era: "The Church and the Empire",
    description: "The first ecumenical council, called by Constantine, condemns Arius's teaching that the Son was created rather than eternal, and declares the Son 'of one substance' (homoousios) with the Father." },
  { key: "athanasius-canon", title: "Athanasius lists the New Testament's 27 books", yearBc: -367, era: "The Church and the Empire",
    description: "In his 39th Festal Letter, Athanasius names exactly the 27 books that make up the New Testament today -- the earliest surviving list that matches it exactly." },
  { key: "edict-thessalonica", title: "Christianity becomes the empire's religion", yearBc: -380, era: "The Church and the Empire",
    description: "The Edict of Thessalonica, issued by Theodosius I, makes Nicene Christianity the official religion of the Roman Empire." },
  { key: "constantinople-1", title: "The First Council of Constantinople", yearBc: -381, era: "The Church and the Empire",
    description: "Completes the Nicene Creed as it is still recited today, affirming the full divinity of the Holy Spirit alongside the Father and the Son." },
  { key: "carthage-canon", title: "The Council of Carthage confirms the biblical canon", yearBc: -397, era: "The Church and the Empire",
    description: "Following the earlier Council of Hippo (393), Carthage confirms the 27-book New Testament canon as authoritative for the Western church." },
  { key: "vulgate-finished", title: "Jerome completes the Latin Vulgate", yearBc: -405, era: "The Church and the Empire",
    description: "Jerome finishes translating the whole Bible into Latin directly from the Hebrew and Greek. It remains the West's standard Bible for the next thousand years." },
  { key: "rome-sacked", title: "Rome is sacked by Alaric", yearBc: -410, era: "The Church and the Empire",
    description: "Visigothic forces sack Rome for the first time in eight centuries. Pagans blame the abandonment of the old gods; Augustine responds with City of God." },
  { key: "ephesus-431", title: "The Council of Ephesus", yearBc: -431, era: "The Church and the Empire",
    description: "Condemns Nestorius's teaching on how Christ's divine and human natures relate, and affirms Mary as Theotokos, 'God-bearer.' The Church of the East, based in Persia, does not accept the council's condemnation and goes its own way." },
  { key: "chalcedon-451", title: "The Council of Chalcedon", yearBc: -451, era: "The Church and the Empire",
    description: "Defines Christ as one person in two natures, divine and human, 'without confusion, without change, without division, without separation.' The churches that would become the Oriental Orthodox communion reject this formula and separate." },

  // ── Councils, Islam & the Mission to Europe (451-1053) ───────────────────
  { key: "last-western-emperor", title: "The last western Roman emperor is deposed", yearBc: -476, era: "Councils, Islam & the Mission to Europe",
    description: "Romulus Augustulus is deposed by Odoacer, conventionally marking the end of the Western Roman Empire -- itself a marker of convenience rather than a clean historical break." },
  { key: "monte-cassino", title: "Benedict founds Monte Cassino", yearBc: -529, era: "Councils, Islam & the Mission to Europe",
    description: "Benedict founds his monastery at Monte Cassino and writes his Rule, which becomes the template for Western monasticism for a thousand years." },
  { key: "iona-founded", title: "Columba founds the monastery at Iona", yearBc: -563, era: "Councils, Islam & the Mission to Europe",
    description: "The Irish monk Columba establishes Iona off the coast of Scotland, the base from which Christianity spreads through Scotland and northern England." },
  { key: "canterbury-mission", title: "Augustine of Canterbury lands in Kent", yearBc: -597, era: "Councils, Islam & the Mission to Europe",
    description: "Sent by Pope Gregory the Great, Augustine begins the mission that converts the Anglo-Saxon kingdoms and establishes the see of Canterbury." },
  { key: "hijra", title: "The Hijra", yearBc: -622, era: "Councils, Islam & the Mission to Europe",
    description: "Muhammad's emigration from Mecca to Medina marks the start of the Islamic calendar. Within a century, Islamic conquest sweeps across the ancient Christian heartlands of North Africa and the Middle East." },
  { key: "iconoclasm-begins", title: "The iconoclast controversy begins", yearBc: -726, era: "Councils, Islam & the Mission to Europe",
    description: "Byzantine emperor Leo III orders the destruction of religious icons, beginning a controversy over religious images that convulses the Eastern church on and off until 843." },
  { key: "nicaea-2", title: "The Second Council of Nicaea", yearBc: -787, era: "Councils, Islam & the Mission to Europe",
    description: "Restores the veneration of icons, distinguishing it from the worship due to God alone. The last ecumenical council both the Eastern and Western churches fully accept." },
  { key: "charlemagne-crowned", title: "Charlemagne is crowned emperor", yearBc: -800, era: "Councils, Islam & the Mission to Europe",
    description: "Pope Leo III crowns Charlemagne 'Emperor of the Romans' on Christmas Day, reviving an imperial title in the West that Constantinople had never recognized as vacant -- a fresh source of friction between the two halves of Christendom." },
  { key: "cyril-methodius-sent", title: "Cyril and Methodius are sent to the Slavs", yearBc: -863, era: "Councils, Islam & the Mission to Europe",
    description: "The Byzantine mission to Moravia gives the Slavic peoples a written alphabet and a liturgy in their own language, shaping Slavic Christianity and culture ever after." },
  { key: "baptism-of-rus", title: "The Baptism of Rus'", yearBc: -988, era: "Councils, Islam & the Mission to Europe",
    description: "Grand Prince Vladimir of Kyiv adopts Byzantine Christianity for his realm, orienting Russian and Ukrainian Christianity toward Constantinople rather than Rome." },

  // ── Christendom Divided (1054-1516) ──────────────────────────────────────
  { key: "great-schism", title: "The Great Schism", yearBc: -1054, era: "Christendom Divided",
    description: "A papal legate and the Patriarch of Constantinople excommunicate each other in a dispute over papal authority and liturgical practice. The Western and Eastern churches separate into what become the Roman Catholic and Eastern Orthodox communions.",
    dateConfidence: "good", dateUncertaintyNote: "Not a clean break: the July 1054 excommunications were between two legates and one patriarch, not two churches, and both sides said in 1965 that this was never meant to divide the churches permanently. Many historians treat the 1204 sack of Constantinople as the real point of no return." },
  { key: "first-crusade", title: "The First Crusade is called at Clermont", yearBc: -1095, era: "Christendom Divided",
    description: "Pope Urban II calls for a Crusade to aid Byzantium and recapture Jerusalem, launching two centuries of Crusading that deepen, more than heal, the rift between East and West." },
  { key: "constantinople-sacked", title: "Crusaders sack Constantinople", yearBc: -1204, era: "Christendom Divided",
    description: "The Fourth Crusade, diverted by debts and politics, sacks the Christian city of Constantinople instead of reaching the Holy Land. Byzantines still consider this the true, unforgivable break with the West." },
  { key: "lateran-4", title: "The Fourth Lateran Council", yearBc: -1215, era: "Christendom Divided",
    description: "Requires annual confession for all Catholics and formally defines transubstantiation, cementing medieval Catholic sacramental practice." },
  { key: "aquinas-dies", title: "Thomas Aquinas dies", yearBc: -1274, era: "Christendom Divided",
    description: "Dies leaving his Summa Theologica unfinished, having reportedly said after a mystical experience that all he had written seemed like straw." },
  { key: "western-schism", title: "The Western Schism begins", yearBc: -1378, era: "Christendom Divided",
    description: "Rival claimants to the papacy divide Western Christendom for decades, at one point with three men simultaneously claiming to be pope, until the Council of Constance resolves it in 1417." },
  { key: "wycliffe-bible", title: "Wycliffe's English Bible", yearBc: -1382, era: "Christendom Divided",
    description: "John Wycliffe and his followers produce the first complete English translation of the Bible, arguing scripture belongs to ordinary believers, not only the clergy. Condemned as heresy; his body is exhumed and burned in 1428." },
  { key: "hus-burned", title: "Jan Hus is burned at Constance", yearBc: -1415, era: "Christendom Divided",
    description: "Despite a promised safe conduct, the Council of Constance burns the Bohemian reformer Jan Hus for teaching influenced by Wycliffe. His followers, the Hussites, fight a series of wars in his name." },
  { key: "constantinople-falls", title: "Constantinople falls to the Ottomans", yearBc: -1453, era: "Christendom Divided",
    description: "The Byzantine Empire ends after over a thousand years. Orthodox Christianity survives under Ottoman rule and increasingly looks to Moscow -- soon calling itself the 'Third Rome' -- for leadership." },
  { key: "gutenberg-bible", title: "The Gutenberg Bible", yearBc: -1456, era: "Christendom Divided",
    description: "Johannes Gutenberg's printing press produces the first major book printed with movable type in the West. The technology that will spread Luther's ideas across Europe within weeks already exists." },

  // ── The Reformation (1517-1648) ──────────────────────────────────────────
  { key: "ninety-five-theses", title: "Luther posts the Ninety-five Theses", yearBc: -1517, era: "The Reformation",
    description: "Martin Luther challenges the sale of indulgences at Wittenberg, sparking a debate that grows into the Protestant Reformation. Not itself a founding document of a new church -- Luther still considered himself Catholic at the time." },
  { key: "diet-of-worms", title: "The Diet of Worms", yearBc: -1521, era: "The Reformation",
    description: "Ordered to recant before the Holy Roman Emperor, Luther reportedly declares 'Here I stand, I can do no other.' He is declared an outlaw of the empire." },
  { key: "first-anabaptist-baptism", title: "The first Anabaptist baptism", yearBc: -1525, era: "The Reformation",
    description: "Conrad Grebel baptizes George Blaurock as an adult believer at Zollikon near Zurich, the first of the 'rebaptisms' that give the Anabaptists their name and mark their break from both Catholic and mainline Protestant practice on infant baptism." },
  { key: "augsburg-confession", title: "The Augsburg Confession", yearBc: -1530, era: "The Reformation",
    description: "Philip Melanchthon's statement of Lutheran belief, presented to Emperor Charles V, becomes the foundational confessional document of Lutheranism as a distinct body." },
  { key: "act-of-supremacy", title: "The Act of Supremacy", yearBc: -1534, era: "The Reformation",
    description: "The English Parliament declares Henry VIII 'Supreme Head' of the Church in England, breaking its legal submission to the pope and founding what becomes the Anglican tradition." },
  { key: "calvin-geneva", title: "Calvin publishes the Institutes and reaches Geneva", yearBc: -1536, era: "The Reformation",
    description: "John Calvin publishes the first edition of his Institutes of the Christian Religion and settles in Geneva, which becomes the model city of the Reformed tradition." },
  { key: "trent-opens", title: "The Council of Trent opens", yearBc: -1545, era: "The Reformation",
    description: "Running on and off until 1563, Trent defines Catholic doctrine against Protestant teaching and reforms clerical abuses, shaping Catholic identity for the next four centuries." },
  { key: "peace-of-augsburg", title: "The Peace of Augsburg", yearBc: -1555, era: "The Reformation",
    description: "Ends religious war in the Holy Roman Empire on the principle cuius regio, eius religio -- each ruler determines the religion of his territory, Lutheran or Catholic." },
  { key: "thirty-nine-articles", title: "The Thirty-nine Articles", yearBc: -1563, era: "The Reformation",
    description: "The Church of England's doctrinal settlement, blending Catholic structure with Reformed theology -- the compromise that defines Anglican identity ever after." },
  { key: "first-baptist-church", title: "The first Baptist congregation", yearBc: -1609, era: "The Reformation",
    description: "John Smyth baptizes himself and his followers as believers in Amsterdam. Thomas Helwys brings the movement back to England around 1611/12, founding the first Baptist church on English soil." },
  { key: "king-james-bible", title: "The King James Bible", yearBc: -1611, era: "The Reformation",
    description: "Commissioned by James I, this English translation becomes the most influential English Bible in history, shaping the language itself for centuries." },
  { key: "synod-of-dort", title: "The Synod of Dort", yearBc: -1619, era: "The Reformation",
    description: "Dutch Reformed churches condemn the teaching of Jacobus Arminius on free will and predestination, defining Reformed orthodoxy in the five points later summarized as 'TULIP.'" },
  { key: "westminster-confession", title: "The Westminster Confession", yearBc: -1646, era: "The Reformation",
    description: "Drafted by an assembly of English and Scottish theologians, it becomes the doctrinal standard for Presbyterian churches worldwide." },
  { key: "peace-of-westphalia", title: "The Peace of Westphalia", yearBc: -1648, era: "The Reformation",
    description: "Ends the Thirty Years' War and the era of large-scale religious war in Europe, recognizing Calvinism alongside Lutheranism and Catholicism as a legally tolerated faith." },

  // ── Pietism & the Awakenings (1649-1799) ─────────────────────────────────
  { key: "pia-desideria", title: "Spener publishes Pia Desideria", yearBc: -1675, era: "Pietism & the Awakenings",
    description: "Philipp Spener's book calls for a Christianity of the heart, not just correct confession, launching the Pietist movement within Lutheranism." },
  { key: "herrnhut-renewal", title: "The Moravian renewal at Herrnhut", yearBc: -1727, era: "Pietism & the Awakenings",
    description: "A community of refugees on Count Zinzendorf's estate experiences a spiritual renewal and begins a round-the-clock prayer meeting that runs unbroken for over a hundred years, launching the first sustained Protestant missionary movement." },
  { key: "aldersgate", title: "Wesley's heart is 'strangely warmed'", yearBc: -1738, era: "Pietism & the Awakenings",
    description: "At a meeting on Aldersgate Street in London, hearing Luther's preface to Romans read aloud, John Wesley feels his heart 'strangely warmed' and dates his true conversion from that night." },
  { key: "sinners-sermon", title: "Edwards preaches 'Sinners in the Hands of an Angry God'", yearBc: -1741, era: "Pietism & the Awakenings",
    description: "Jonathan Edwards's sermon at Enfield, Connecticut, becomes the most famous single sermon of the First Great Awakening." },
  { key: "christmas-conference", title: "The Christmas Conference", yearBc: -1784, era: "Pietism & the Awakenings",
    description: "Meeting in Baltimore, American Methodist preachers organize the Methodist Episcopal Church as a body separate from the Church of England." },
  { key: "carey-missionary-society", title: "Carey and the Baptist Missionary Society", yearBc: -1792, era: "Pietism & the Awakenings",
    description: "William Carey helps found the Baptist Missionary Society and sails for India the following year, conventionally marking the start of the modern Protestant missionary movement." },

  // ── Missions & Revivals (1800-1899) ──────────────────────────────────────
  { key: "cane-ridge", title: "The Cane Ridge revival", yearBc: -1801, era: "Missions & Revivals",
    description: "A massive camp meeting in Kentucky, drawing perhaps 20,000 people, becomes a defining event of the Second Great Awakening and helps seed the Restoration Movement's vision of Christian unity beyond denominational labels." },
  { key: "morrison-china", title: "Robert Morrison reaches China", yearBc: -1807, era: "Missions & Revivals",
    description: "The first Protestant missionary to China, Morrison translates the Bible into Chinese despite a East India Company ban on missionary activity." },
  { key: "ame-organized", title: "The African Methodist Episcopal Church is organized", yearBc: -1816, era: "Missions & Revivals",
    description: "Richard Allen, a formerly enslaved man, leads the founding of the AME Church after facing discrimination in a white Methodist congregation -- the first fully independent Black denomination in America." },
  { key: "restoration-merger", title: "The Stone and Campbell movements merge", yearBc: -1832, era: "Missions & Revivals",
    description: "Two independent 'no creed but Christ' reform movements, led by Barton Stone and Alexander Campbell, unite into what becomes the American Restoration Movement." },
  { key: "great-disappointment", title: "The Great Disappointment", yearBc: -1844, era: "Missions & Revivals",
    description: "Followers of William Miller, expecting Christ's return on a specific date, are bitterly disappointed when it does not occur. Out of the movement's remnant, Ellen White helps found Seventh-day Adventism." },
  { key: "sda-organized", title: "The Seventh-day Adventist Church is organized", yearBc: -1863, era: "Missions & Revivals",
    description: "Formally organizes out of the Millerite movement's aftermath, distinguished by Saturday Sabbath observance and belief in Christ's imminent return." },
  { key: "salvation-army-founded", title: "The Salvation Army is founded", yearBc: -1865, era: "Missions & Revivals",
    description: "William and Catherine Booth found a mission to London's poor that grows into a worldwide, quasi-military organization combining evangelism with social service." },
  { key: "holiness-association", title: "The National Camp Meeting Association organizes", yearBc: -1867, era: "Missions & Revivals",
    description: "American Methodists committed to John Wesley's teaching on entire sanctification organize the Holiness movement, which will itself later give rise to Pentecostalism." },
  { key: "vatican-1", title: "The First Vatican Council defines papal infallibility", yearBc: -1870, era: "Missions & Revivals",
    description: "Declares that the pope, speaking formally on faith and morals, cannot err -- a doctrine that becomes one of the sharpest points of disagreement between Catholics and other Christian traditions." },
  { key: "cog-anderson", title: "The Church of God (Anderson, Indiana) is founded", yearBc: -1881, era: "Missions & Revivals",
    description: "D. S. Warner leaves the General Eldership of the Churches of God, believing organized denominations are themselves a barrier to Christian unity, and begins what becomes the Church of God reformation movement based in Anderson, Indiana." },
  { key: "cog-cleveland", title: "The Church of God (Cleveland, Tennessee) is founded", yearBc: -1886, era: "Missions & Revivals",
    description: "Founded as the Christian Union in the mountains of Tennessee and North Carolina. Becomes Pentecostal after 1906 and is the oldest Pentecostal denomination in America -- entirely unrelated to the similarly named Church of God in Anderson, Indiana." },

  // ── The Global Church (1900-present) ─────────────────────────────────────
  { key: "topeka-outpouring", title: "The Topeka outpouring", yearBc: -1901, era: "The Global Church",
    description: "Students of Charles Parham's Bible school in Topeka, Kansas, report speaking in tongues, and Parham formulates the doctrine that would become central to Pentecostalism.",
    dateConfidence: "good" },
  { key: "azusa-street", title: "The Azusa Street revival", yearBc: -1906, era: "The Global Church",
    description: "William J. Seymour leads a revival in a former livery stable on Azusa Street in Los Angeles that runs for years and sends Pentecostalism out to the whole world -- now the fastest-growing segment of global Christianity." },
  { key: "edinburgh-1910", title: "The Edinburgh Missionary Conference", yearBc: -1910, era: "The Global Church",
    description: "A landmark gathering of Protestant missionary societies is widely regarded as the start of the modern ecumenical movement." },
  { key: "assemblies-of-god", title: "The Assemblies of God is founded", yearBc: -1914, era: "The Global Church",
    description: "Pentecostal ministers meeting in Hot Springs, Arkansas, organize what becomes the largest Pentecostal denomination in the world." },
  { key: "barmen-declaration", title: "The Barmen Declaration", yearBc: -1934, era: "The Global Church",
    description: "German pastors including Karl Barth and Dietrich Bonhoeffer form the Confessing Church and declare that the church's allegiance to Christ cannot be subordinated to the Nazi state or its ideology." },
  { key: "wcc-formed", title: "The World Council of Churches is formed", yearBc: -1948, era: "The Global Church",
    description: "Meeting in Amsterdam, Protestant and Orthodox churches organize the WCC to pursue Christian unity and cooperation -- the Catholic Church does not join, though relations warm considerably after Vatican II." },
  { key: "graham-la-crusade", title: "Billy Graham's Los Angeles crusade", yearBc: -1949, era: "The Global Church",
    description: "An eight-week tent revival, extended repeatedly by unexpected crowds, launches Billy Graham to national and then international prominence as an evangelist." },
  { key: "vatican-2", title: "The Second Vatican Council opens", yearBc: -1962, era: "The Global Church",
    description: "Running to 1965, Vatican II permits the Mass in local languages rather than only Latin, and adopts a notably warmer posture toward other Christians and other faiths than the Catholic Church had held before." },
  { key: "anathemas-lifted", title: "The anathemas of 1054 are lifted", yearBc: -1965, era: "The Global Church",
    description: "Pope Paul VI and Ecumenical Patriarch Athenagoras I jointly nullify the mutual excommunications of 1054. It does not end the schism -- the underlying doctrinal and authority disagreements remain -- but it formally ends nine centuries of mutual anathema." },
  { key: "catholic-charismatic", title: "Catholic charismatic renewal begins", yearBc: -1967, era: "The Global Church",
    description: "Students and faculty at Duquesne University experience what they describe as baptism in the Holy Spirit, launching a charismatic renewal movement within the Catholic Church itself -- a renewal within, not a split away.",
    dateConfidence: "good" },
  { key: "lausanne-1974", title: "The Lausanne Congress", yearBc: -1974, era: "The Global Church",
    description: "A gathering convened by Billy Graham and John Stott produces the Lausanne Covenant, giving a fractured global evangelical movement a shared statement of mission and identity." },
  { key: "global-south-majority", title: "Most Christians now live in the Global South", yearBc: -1980, era: "The Global Church",
    description: "Sometime in the 1970s or 1980s, the majority of the world's Christians come to live in Africa, Asia and Latin America rather than Europe and North America -- one of the largest shifts in Christianity's geographic center since its first centuries.",
    dateConfidence: "uncertain", dateUncertaintyNote: "The trend itself is not in question, but no single year marks the crossover; estimates place it anywhere from the early 1970s to the mid-1980s depending on the data source and definitions used." },
];

const eventIds: Record<string, string> = {};

async function seedEvents() {
  console.log("Seeding church-history events...");
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

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== LIVE RUN ===");
  await seedMissingPeople();
  await seedTimelineDates();
  await seedEvents();
  console.log("Done.");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
