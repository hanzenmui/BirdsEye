// The twelve apostles, key disciples, and major ministry figures
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

async function loadExisting(key: string, name: string): Promise<boolean> {
  const dbId = await lookupId(name);
  if (!dbId) { console.warn(`  ⚠ ${name} not found in DB`); return false; }
  ids[key] = dbId; names[key] = name;
  return true;
}

// ── People ────────────────────────────────────────────────────────────────────
async function seedPeople() {
  // ── The Twelve Apostles ───────────────────────────────────────────────
  await safeInsertPerson({ key: "peter", name: "Peter", alsoKnownAs: "Simon Peter, Cephas, Simon son of Jonah",
    gender: "male",
    description: "Fisherman from Bethsaida, originally named Simon, son of Jonah. Jesus renamed him Cephas/Peter (Rock). First among the twelve; spoke at Pentecost; performed miracles of healing; raised Tabitha from the dead; received Cornelius's household into the church. Walked on water but sank; confessed 'You are the Christ, the Son of the living God' and was given the keys of the kingdom; denied Jesus three times; wept bitterly; restored with 'Feed my sheep.' Wrote two epistles. According to tradition, crucified upside down in Rome under Nero. The foundation figure of the church.",
    tags: ["apostle", "fisherman"] });

  await safeInsertPerson({ key: "andrew", name: "Andrew", alsoKnownAs: "Andrew the Apostle, brother of Peter",
    gender: "male",
    description: "Brother of Simon Peter, from Bethsaida, a fisherman. Was a disciple of John the Baptist before following Jesus — the first apostle called. Brought Peter to Jesus. Found the boy with five loaves and two fish before the feeding of the five thousand. Brought Greeks who wished to see Jesus to Philip. According to tradition, martyred on an X-shaped cross (the 'St. Andrew's Cross') in Patras, Greece.",
    tags: ["apostle", "fisherman"] });

  await safeInsertPerson({ key: "james_zebedee", name: "James", alsoKnownAs: "James son of Zebedee, James the Greater",
    gender: "male",
    deathYear: "c. 44 AD",
    description: "Son of Zebedee and Salome, older brother of John the Apostle. Fisherman from Galilee. With John, Jesus nicknamed them 'Boanerges' (Sons of Thunder) for their fiery temperament — they asked Jesus to call fire on a Samaritan village. Part of the inner circle with Peter and John who witnessed the Transfiguration, the raising of Jairus's daughter, and Gethsemane. First apostle to be martyred: beheaded by Herod Agrippa I (Acts 12:2), c. 44 AD. Patron saint of Spain (Santiago de Compostela).",
    tags: ["apostle", "fisherman"] });

  await safeInsertPerson({ key: "john_apostle", name: "John", alsoKnownAs: "John son of Zebedee, the Beloved Disciple",
    gender: "male",
    description: "Son of Zebedee and Salome, younger brother of James. Fisherman from Galilee. Traditionally identified as 'the disciple whom Jesus loved' in the Gospel of John. Part of the inner circle (Transfiguration, Gethsemane). Entrusted with care of Mary at the cross. Was the first to believe at the empty tomb. Wrote the Gospel of John, three epistles, and Revelation according to tradition. The only apostle believed to have died of natural causes — at extreme old age in Ephesus.",
    tags: ["apostle", "fisherman", "evangelist"] });

  await safeInsertPerson({ key: "philip_apostle", name: "Philip", alsoKnownAs: "Philip the Apostle",
    gender: "male",
    description: "From Bethsaida, called directly by Jesus ('Follow me'). Immediately found Nathanael/Bartholomew and said 'We have found him of whom Moses in the Law and also the prophets wrote.' When Jesus tested him before the feeding of the five thousand, he calculated the cost of bread. Greeks who came to Jerusalem to worship asked Philip to introduce them to Jesus. At the Last Supper, asked Jesus 'Show us the Father' and received the reply 'Whoever has seen me has seen the Father.' Not to be confused with Philip the Evangelist (one of the seven deacons).",
    tags: ["apostle"] });

  await safeInsertPerson({ key: "bartholomew", name: "Bartholomew", alsoKnownAs: "Bartholomew the Apostle, Nathanael",
    gender: "male",
    description: "Apostle traditionally identified with Nathanael of Cana in Galilee whom Philip brought to Jesus. When Philip said 'We have found him,' Nathanael skeptically asked 'Can anything good come out of Nazareth?' Jesus saw him coming and said 'Here is truly an Israelite in whom there is no deceit.' Nathanael asked how Jesus knew him; Jesus said he saw him under the fig tree before Philip called him. Nathanael immediately confessed 'Rabbi, you are the Son of God! You are the King of Israel!' Was present at the resurrection appearance by the Sea of Tiberias.",
    tags: ["apostle"] });

  await safeInsertPerson({ key: "matthew_apostle", name: "Matthew", alsoKnownAs: "Matthew the Apostle, Levi the tax collector",
    gender: "male",
    description: "Tax collector (publican) sitting at his booth in Capernaum when Jesus called him with 'Follow me' — he immediately rose and followed. Also called Levi son of Alphaeus. Held a great banquet at his house for Jesus and many tax collectors and sinners, provoking the Pharisees' complaint that Jesus ate with such people. Jesus replied 'I came not to call the righteous, but sinners.' Traditionally identified as the author of the Gospel of Matthew. Tax collectors were despised as collaborators with Rome and often dishonest.",
    tags: ["apostle"] });

  await safeInsertPerson({ key: "thomas", name: "Thomas", alsoKnownAs: "Thomas the Apostle, Doubting Thomas, Didymus",
    gender: "male",
    description: "Apostle whose Aramaic name Thomas and Greek name Didymus both mean 'twin.' When Jesus said he would go to Lazarus despite danger, Thomas said 'Let us also go, that we may die with him.' At the Last Supper, objected that the disciples did not know where Jesus was going. After the resurrection, was absent when Jesus first appeared and refused to believe: 'Unless I see the mark of the nails in his hands…I will not believe.' When Jesus appeared a week later, Thomas touched the wounds and confessed 'My Lord and my God!' — the highest confession in John's Gospel. Tradition holds he founded the church in India and was martyred there.",
    tags: ["apostle"] });

  await safeInsertPerson({ key: "james_alphaeus", name: "James", alsoKnownAs: "James son of Alphaeus, James the Less",
    gender: "male",
    description: "Apostle, son of Alphaeus. Distinguished from James son of Zebedee by the epithet 'the Less' or 'the Younger.' Little is recorded about him individually in the Gospels beyond his inclusion in the Twelve. Some traditions identify him with James the brother of the Lord; others distinguish them. May be the same as 'James the younger' mentioned at the crucifixion (Mark 15:40).",
    tags: ["apostle"] });

  await safeInsertPerson({ key: "thaddaeus", name: "Thaddaeus", alsoKnownAs: "Thaddaeus, Judas son of James, Lebbaeus",
    gender: "male",
    description: "Apostle listed as Thaddaeus (Matthew, Mark) or Judas son of James (Luke, Acts). Not to be confused with Judas Iscariot. At the Last Supper, asked Jesus why he would reveal himself to them but not to the world; Jesus replied about the indwelling of Father and Son. Sometimes called Jude the Apostle. Possibly the author of the Epistle of Jude.",
    tags: ["apostle"] });

  await safeInsertPerson({ key: "simon_zealot", name: "Simon", alsoKnownAs: "Simon the Zealot, Simon the Canaanite",
    gender: "male",
    description: "Apostle identified as 'the Zealot' or 'the Canaanite' (both designations refer to the Zealot political movement, not the Canaanite people). The Zealots were those who advocated violent resistance to Rome. Little else is recorded of him individually in the New Testament. His inclusion alongside Matthew the Roman tax collector and the others illustrates the remarkable social breadth of the apostolic group Jesus assembled.",
    tags: ["apostle"] });

  await safeInsertPerson({ key: "judas_iscariot", name: "Judas Iscariot", alsoKnownAs: "Judas Iscariot, son of Simon Iscariot",
    gender: "male",
    deathYear: "c. 30-33 AD",
    description: "One of the twelve, treasurer of the group, son of Simon Iscariot. 'Iscariot' may mean 'man from Kerioth.' Was greedy: objected when Mary of Bethany anointed Jesus's feet with expensive perfume ('this could have been sold for three hundred denarii and given to the poor'). Agreed with the chief priests to betray Jesus for thirty pieces of silver — the price of a slave, fulfilling Zechariah 11:12. Led soldiers to the Garden of Gethsemane and identified Jesus with a kiss. Afterward filled with remorse, returned the silver and hanged himself; the field bought with the money was called the Field of Blood.",
    tags: ["apostle", "antagonist"] });

  // ── Key women ─────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "mary_magdalene", name: "Mary Magdalene", alsoKnownAs: "Mary of Magdala",
    gender: "female",
    description: "From Magdala on the western shore of the Sea of Galilee. Jesus had cast seven demons from her. She followed Jesus from Galilee and supported his ministry. Present at the crucifixion and burial. First witness of the resurrection: went to the tomb early Sunday morning, found it empty, encountered the risen Jesus in the garden. She initially mistook him for the gardener; when Jesus said her name she recognized him and he said 'Do not cling to me, for I have not yet ascended.' Sent by Jesus to tell the disciples he had risen — the first apostle (one sent) of the resurrection, sometimes called 'Apostle to the Apostles.'",
    tags: ["disciple"] });

  await safeInsertPerson({ key: "mary_bethany", name: "Mary of Bethany", alsoKnownAs: "Mary of Bethany, sister of Martha",
    gender: "female",
    description: "Sister of Martha and Lazarus, from Bethany. Chose to sit at Jesus's feet listening while Martha prepared the meal; Jesus defended her choice: 'Mary has chosen the good portion, which will not be taken away from her.' Anointed Jesus's feet with a pound of pure nard worth three hundred denarii and wiped them with her hair — an act of extravagant devotion Jesus said was done 'for my burial.' The fragrance filled the house. Some traditions conflate her with Mary Magdalene but the Gospels present them as distinct.",
    tags: ["disciple"] });

  await safeInsertPerson({ key: "martha", name: "Martha", alsoKnownAs: "Martha of Bethany",
    gender: "female",
    description: "Sister of Mary and Lazarus from Bethany, close friend of Jesus. Received Jesus into her home while Mary sat at his feet; complained she was doing all the work alone. When Lazarus died, was the first to meet Jesus on the road and made the great confession: 'I believe that you are the Christ, the Son of God, who is coming into the world.' Then brought Mary to Jesus. Served at the dinner after Lazarus's resurrection while Mary anointed Jesus's feet.",
    tags: ["disciple"] });

  await safeInsertPerson({ key: "lazarus", name: "Lazarus", alsoKnownAs: "Lazarus of Bethany",
    gender: "male",
    description: "Brother of Mary and Martha of Bethany, whom Jesus raised from the dead after four days in the tomb — the seventh and greatest sign in John's Gospel. Jesus wept at the tomb before commanding 'Lazarus, come out!' He emerged still bound in grave clothes. This miracle directly triggered the Sanhedrin's decision to arrest and kill Jesus. After the resurrection the chief priests also plotted to kill Lazarus again 'because on account of him many of the Jews were going away and believing in Jesus.' He was present at the dinner six days before Passover.",
    tags: ["disciple"] });

  // ── Key ministry figures ───────────────────────────────────────────────
  await safeInsertPerson({ key: "nicodemus", name: "Nicodemus",
    gender: "male",
    description: "Pharisee and member of the Jewish ruling council (Sanhedrin). Came to Jesus by night, acknowledging 'We know that you are a teacher come from God.' Jesus told him 'You must be born again' and explained the famous verse 'For God so loved the world that he gave his only Son' (John 3:16). Later defended Jesus at a Sanhedrin meeting: 'Does our law judge a man without first giving him a hearing?' After the crucifixion, came with Joseph of Arimathea to prepare Jesus's body, bringing 75 pounds of myrrh and aloes.",
    tags: ["pharisee"] });

  await safeInsertPerson({ key: "zacchaeus", name: "Zacchaeus",
    gender: "male",
    description: "Chief tax collector in Jericho, wealthy and short in stature. Climbed a sycamore tree to see Jesus as he passed through. Jesus looked up and said 'Zacchaeus, hurry and come down, for I must stay at your house today.' While the crowd grumbled that Jesus had gone to be guest of a sinner, Zacchaeus stood and said 'Behold, Lord, the half of my goods I give to the poor. And if I have defrauded anyone of anything, I restore it fourfold.' Jesus said 'Today salvation has come to this house, since he also is a son of Abraham. For the Son of Man came to seek and to save the lost.'",
    tags: ["other"] });

  await safeInsertPerson({ key: "jairus", name: "Jairus",
    gender: "male",
    description: "Ruler of the synagogue in Capernaum. Fell at Jesus's feet and pleaded for his twelve-year-old daughter who was dying. While Jesus was on his way, she died and messengers told Jairus not to trouble the teacher. Jesus said 'Do not fear; only believe.' Took Peter, James, and John to the house; silenced the mourners who laughed when he said the child was sleeping; took her hand and said 'Talitha cumi' (Little girl, get up). She rose immediately. Jesus instructed them to give her something to eat and told no one.",
    tags: ["other"] });

  await safeInsertPerson({ key: "zebedee", name: "Zebedee",
    gender: "male",
    description: "Fisherman on the Sea of Galilee, father of the apostles James and John. When Jesus called his sons, Zebedee was left in the boat with the hired servants mending nets. Mentioned only briefly in the Gospels. His wife Salome (identified in Mark 15:40 / Matt 27:56) followed Jesus and was present at the cross.",
    tags: ["other"] });

  await safeInsertPerson({ key: "salome_zebedee", name: "Salome", alsoKnownAs: "Salome wife of Zebedee, mother of James and John",
    gender: "female",
    description: "Wife of Zebedee, mother of James and John the apostles. Came to Jesus with her sons to request they sit at his right and left in his kingdom — Jesus replied 'You do not know what you are asking.' Was present at the crucifixion among the women from Galilee (Matt 27:56), and was among those who went to the tomb on Sunday morning with spices (Mark 16:1). Not to be confused with Salome daughter of Herodias.",
    tags: ["disciple"] });
}

// ── Relationships ─────────────────────────────────────────────────────────────
async function seedRelationships() {
  // ── Inner circle ──────────────────────────────────────────────────────
  await insertRelByName("Jesus", "mentor_of", "Peter",          "Peter: 'You are the Christ'; given keys of kingdom; 'Feed my sheep'");
  await insertRelByName("Jesus", "mentor_of", "Andrew",         "First apostle called; 'Follow me and I will make you fishers of men'");
  await insertRelNameToLocal("Jesus", "mentor_of", "james_zebedee", "Sons of Thunder; inner circle; first apostle martyred");
  await insertRelByName("Jesus", "mentor_of", "John",           "Beloved disciple; entrusted with Mary; Transfiguration; Gethsemane");
  await insertRelByName("Jesus", "mentor_of", "Philip",         "Called directly; 'Follow me'; fed 5,000; 'Show us the Father'");
  await insertRelByName("Jesus", "mentor_of", "Bartholomew",    "'Truly an Israelite in whom there is no deceit'; saw him under fig tree");
  await insertRelByName("Jesus", "mentor_of", "Matthew",        "Called from tax booth; 'Follow me'");
  await insertRelByName("Jesus", "mentor_of", "Thomas",         "Doubted resurrection; touched wounds; 'My Lord and my God'");
  await insertRelByName("Jesus", "mentor_of", "Zacchaeus",      "'Today salvation has come to this house'");
  await insertRel("peter",   "sibling_of", "andrew",           "Brothers, both fishermen from Bethsaida (Matt 4:18)");
  await insertRel("james_zebedee","sibling_of","john_apostle",  "Sons of Zebedee and Salome; both in the inner circle");
  await insertRel("zebedee", "parent_of",  "james_zebedee",    "Zebedee left in the boat when Jesus called his sons (Matt 4:21)");
  await insertRel("zebedee", "parent_of",  "john_apostle",     "Zebedee's son, the Beloved Disciple");
  await insertRel("zebedee", "spouse_of",  "salome_zebedee",   "Salome wife of Zebedee (identified from Matt 27:56 / Mark 15:40)");
  await insertRel("salome_zebedee","parent_of","james_zebedee","Salome at the cross; went to tomb with spices");
  await insertRel("salome_zebedee","parent_of","john_apostle",  "Mother of James and John; asked for their places in the kingdom");

  // ── Bethany family ────────────────────────────────────────────────────
  await insertRel("martha",      "sibling_of", "mary_bethany",  "Sisters who received Jesus at their home");
  await insertRel("martha",      "sibling_of", "lazarus",       "Martha's brother raised from the dead");
  await insertRel("mary_bethany","sibling_of", "lazarus",       "Mary and Lazarus; both wept; Mary anointed Jesus");
  await insertRelByName("Jesus", "ally_of",    "Martha",        "'Martha, Martha, you are anxious about many things' (Luke 10:41)");
  await insertRelByName("Jesus", "ally_of",    "Mary of Bethany","Mary chose the good portion; anointed Jesus for burial");
  await insertRelByName("Jesus", "ally_of",    "Lazarus",       "Jesus wept; called him from the tomb; 'Lazarus, come out'");

  // ── Other ministry ────────────────────────────────────────────────────
  await insertRelByName("Jesus", "ally_of",    "Nicodemus",     "'For God so loved the world…' — night visit; you must be born again");
  await insertRelByName("Jesus", "ally_of",    "Mary Magdalene","Cast seven demons from her; she was first witness of the resurrection");
  await insertRelByName("Jesus", "ally_of",    "Jairus",        "'Talitha cumi' — raised Jairus's twelve-year-old daughter");

  // ── Judas's betrayal ──────────────────────────────────────────────────
  await insertRelByName("Judas Iscariot","enemy_of", "Jesus",   "Betrayed Jesus for 30 pieces of silver; led soldiers to Gethsemane");
}

// ── Scripture references ───────────────────────────────────────────────────────
async function seedRefs() {
  await insertRef("peter",         "Matthew",  4, 18, 26, 75, "Called; walks on water; confession; denial; restoration");
  await insertRef("peter",         "John",     1, 40, 21, 22, "Named Cephas; beloved disciple scenes; 'Feed my sheep'");
  await insertRef("peter",         "Acts",     1, 15, 12, 19, "Pentecost speech; healing; Cornelius; Jerusalem council");
  await insertRef("andrew",        "Matthew",  4, 18,  4, 20, "Called with Peter at the sea");
  await insertRef("andrew",        "John",     1, 40,  1, 42, "First called; brought Peter to Jesus");
  await insertRef("andrew",        "John",     6,  8,  6,  9, "Found the boy with five loaves and two fish");
  await insertRef("james_zebedee", "Matthew",  4, 21, 17,  1, "Called; Transfiguration; Sons of Thunder");
  await insertRef("james_zebedee", "Acts",    12,  2, 12,  2, "Beheaded by Herod Agrippa I, c. 44 AD");
  await insertRef("john_apostle",  "Matthew",  4, 21, 26, 37, "Called; Transfiguration; Gethsemane");
  await insertRef("john_apostle",  "John",    19, 26, 21, 25, "At the cross; empty tomb; 'the disciple whom Jesus loved'");
  await insertRef("john_apostle",  "Acts",     3,  1,  8, 25, "Heals lame man; imprisoned with Peter; Samaria mission");
  await insertRef("philip_apostle","John",     1, 43,  6, 14, "Called; 'Follow me'; feeding of 5,000 test; Greeks to Jesus");
  await insertRef("philip_apostle","John",    14,  8, 14,  9, "'Show us the Father' — 'whoever has seen me has seen the Father'");
  await insertRef("bartholomew",   "John",     1, 45,  1, 51, "Philip finds Nathanael; 'can anything good come from Nazareth?'");
  await insertRef("matthew_apostle","Matthew", 9,  9,  9, 13, "Called from tax booth; great banquet; 'I came to call sinners'");
  await insertRef("thomas",        "John",    11, 16, 11, 16, "'Let us also go, that we may die with him'");
  await insertRef("thomas",        "John",    20, 24, 20, 29, "Absence; doubt; appearance; 'My Lord and my God'");
  await insertRef("judas_iscariot","Matthew", 26, 14, 27, 10, "30 pieces of silver; betrayal kiss; remorse; hangs himself");
  await insertRef("judas_iscariot","John",    12,  4, 12,  6, "Objects to Mary's anointing; 'he was a thief'");
  await insertRef("mary_magdalene","Luke",     8,  2,  8,  3, "Seven demons cast out; followed Jesus from Galilee");
  await insertRef("mary_magdalene","John",    20,  1, 20, 18, "Empty tomb; 'Woman, why are you weeping?'; first resurrection witness");
  await insertRef("mary_bethany",  "Luke",    10, 38, 10, 42, "Sits at Jesus's feet; 'Mary has chosen the good portion'");
  await insertRef("mary_bethany",  "John",    12,  1, 12,  8, "Anoints feet with expensive nard; wiped with hair; Judas objects");
  await insertRef("martha",        "Luke",    10, 38, 10, 42, "Distracted with serving; 'Martha, Martha, you are anxious'");
  await insertRef("martha",        "John",    11, 20, 11, 40, "'I believe you are the Christ'; 'Lazarus come out'");
  await insertRef("lazarus",       "John",    11,  1, 12, 11, "Death; Jesus wept; raised after 4 days; chief priests plot to kill");
  await insertRef("nicodemus",     "John",     3,  1,  3, 21, "Night visit; 'you must be born again'; John 3:16");
  await insertRef("nicodemus",     "John",     7, 50,  7, 52, "Defends Jesus at the Sanhedrin: 'does our law judge a man…?'");
  await insertRef("nicodemus",     "John",    19, 39, 19, 42, "Brings myrrh and aloes; prepares body with Joseph of Arimathea");
  await insertRef("zacchaeus",     "Luke",    19,  1, 19, 10, "Short man in tree; 'I must stay at your house today'; salvation");
  await insertRef("jairus",        "Mark",     5, 22,  5, 43, "Daughter at point of death; 'only believe'; 'Talitha cumi'");
  await insertRef("zebedee",       "Matthew",  4, 21,  4, 22, "Left in the boat when Jesus called James and John");
  await insertRef("salome_zebedee","Matthew", 27, 55, 27, 56, "At the cross among the Galilean women");
  await insertRef("salome_zebedee","Mark",    16,  1, 16,  1, "Went to tomb with spices Sunday morning");
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Seeding NT Ministry people...");
  await seedPeople();
  console.log("Seeding NT Ministry relationships...");
  await seedRelationships();
  console.log("Seeding NT Ministry scripture references...");
  await seedRefs();

  const pc = await db.execute("SELECT COUNT(*) as c FROM people");
  const rc = await db.execute("SELECT COUNT(*) as c FROM relationships");
  const sc = await db.execute("SELECT COUNT(*) as c FROM scripture_refs");
  console.log(`\n✓ NT Ministry seed complete.`);
  console.log(`  Total people now: ${(pc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total relationships now: ${(rc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total scripture refs now: ${(sc.rows[0] as unknown as { c: number }).c}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
