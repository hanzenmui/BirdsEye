// Matthew 1-2, Luke 1-2: birth and infancy narratives
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

// ── People ────────────────────────────────────────────────────────────────────
async function seedPeople() {
  // ── John the Baptist's parents ────────────────────────────────────────
  await safeInsertPerson({ key: "zechariah_nt", name: "Zechariah", alsoKnownAs: "Zechariah father of John the Baptist",
    gender: "male",
    description: "Priest of the division of Abijah, husband of Elizabeth. While burning incense in the Temple, the angel Gabriel appeared to him announcing that Elizabeth would bear a son named John who would go before the Lord in the spirit and power of Elijah. Zechariah doubted because of their old age and was struck mute until John's birth. When he confirmed the name 'John' on a writing tablet his speech returned and he immediately broke into the Benedictus (Lk 1:68-79), prophesying his son's role as the forerunner. Not to be confused with the OT prophet Zechariah son of Berechiah or Zechariah son of Jehoiada.",
    tags: ["priest"] });

  await safeInsertPerson({ key: "elizabeth", name: "Elizabeth",
    gender: "female",
    description: "Wife of Zechariah, of the daughters of Aaron (priestly lineage). Both were righteous and blameless but childless in their old age. Gabriel promised her son would be 'great before the Lord.' When Mary came to visit, Elizabeth felt the baby leap in her womb and exclaimed 'Blessed are you among women, and blessed is the fruit of your womb!' — the first person to recognize the incarnate Lord. Her greeting prompted Mary's Magnificat. Gave birth to John and confirmed his name against the objections of family.",
    tags: ["matriarch"] });

  await safeInsertPerson({ key: "john_baptist", name: "John the Baptist", alsoKnownAs: "John son of Zechariah",
    gender: "male",
    birthYear: "c. 5 BC", deathYear: "c. 28-30 AD",
    description: "Son of Zechariah and Elizabeth, born six months before Jesus. Lived as an ascetic in the desert, clothed in camel's hair with a leather belt, eating locusts and wild honey. Called the people to repentance and baptized them in the Jordan — the forerunner prophesied by Isaiah 40:3 and Malachi 4:5 ('Elijah who is to come'). Baptized Jesus, though he protested he was unworthy. Rebuked Herod Antipas for taking his brother's wife; imprisoned and ultimately beheaded at Herodias's request when Salome danced. Jesus declared: 'Among those born of women there has arisen no one greater than John the Baptist.'",
    tags: ["prophet"] });

  // ── Jesus ─────────────────────────────────────────────────────────────
  await safeInsertPerson({ key: "jesus", name: "Jesus", alsoKnownAs: "Jesus of Nazareth, Jesus Christ, the Messiah",
    gender: "male",
    birthYear: "c. 6-4 BC", deathYear: "c. 30-33 AD",
    description: "Central figure of the New Testament and of Christian faith. Born in Bethlehem of the virgin Mary, raised in Nazareth of Galilee. Baptized by John in the Jordan; tempted forty days in the wilderness. Began his public ministry in Galilee, calling twelve apostles and proclaiming the Kingdom of God. Performed miracles — healing the sick, feeding thousands, raising the dead. Delivered the Sermon on the Mount and taught in parables. Entered Jerusalem on a donkey (fulfilling Zech 9:9); drove out Temple merchants; was arrested in Gethsemane. Crucified under Pontius Pilate at Golgotha; rose bodily on the third day; appeared to many witnesses; ascended into heaven. His genealogy in Matthew and Luke traces the Davidic line. Central to every book of the New Testament.",
    tags: ["messiah", "teacher", "healer"] });

  // ── Mary and Joseph ───────────────────────────────────────────────────
  await safeInsertPerson({ key: "mary_mother", name: "Mary", alsoKnownAs: "Mary mother of Jesus, the Virgin Mary",
    gender: "female",
    birthYear: "c. 20-18 BC",
    description: "Young woman from Nazareth of Galilee, betrothed to Joseph son of David. Gabriel appeared to her announcing she would conceive by the Holy Spirit and bear the Son of God — she responded 'I am the servant of the Lord; let it be to me according to your word.' Traveled with Joseph to Bethlehem for the census; gave birth in a manger. Presented Jesus at the Temple; fled to Egypt with Joseph; settled in Nazareth. Present at the wedding at Cana where Jesus performed his first miracle. Stood at the foot of the cross; entrusted to the beloved disciple. Was in the upper room at Pentecost. The most mentioned woman in the New Testament.",
    tags: ["matriarch", "messianic line"] });

  await safeInsertPerson({ key: "joseph_nt", name: "Joseph", alsoKnownAs: "Joseph husband of Mary, Joseph of Nazareth",
    gender: "male",
    description: "Carpenter from Nazareth, descended from the Davidic line through Solomon (Matt 1:16). Betrothed to Mary; found she was pregnant before they came together; decided to divorce her quietly. An angel appeared to him in a dream saying the child was conceived by the Holy Spirit and to name him Jesus. Obeyed without question. Took Mary to Bethlehem; received the magi; fled to Egypt on angelic warning; settled in Nazareth. Presented Jesus at the Temple. Last mentioned when Jesus was twelve; widely believed to have died before Jesus's ministry began. Not to be confused with Joseph son of Jacob.",
    tags: ["tribe of israel", "messianic line"] });

  // ── Temple witnesses ──────────────────────────────────────────────────
  await safeInsertPerson({ key: "simeon_nt", name: "Simeon", alsoKnownAs: "Simeon of Jerusalem",
    gender: "male",
    description: "Righteous and devout man in Jerusalem who had been promised by the Holy Spirit that he would not die before seeing the Messiah. When Mary and Joseph brought the infant Jesus to the Temple, Simeon took him in his arms and prayed the Nunc Dimittis: 'Lord, now you are letting your servant depart in peace, for my eyes have seen your salvation.' He also prophesied to Mary: 'a sword will pierce through your own soul also.' Not to be confused with Simeon son of Jacob.",
    tags: ["other"] });

  await safeInsertPerson({ key: "anna_prophet", name: "Anna", alsoKnownAs: "Anna the prophetess",
    gender: "female",
    description: "Prophetess, daughter of Phanuel of the tribe of Asher. Had been a widow for 84 years (or aged 84) after only seven years of marriage. Never left the Temple, worshipping with fasting and prayer night and day. Appeared immediately after Simeon blessed the infant Jesus, gave thanks to God, and spoke of him to all who were waiting for the redemption of Jerusalem. One of the few women in Luke explicitly called a prophet.",
    tags: ["prophet"] });

  // ── Herod the Great ───────────────────────────────────────────────────
  await safeInsertPerson({ key: "herod_great", name: "Herod", alsoKnownAs: "Herod the Great, Herod king of Judea",
    gender: "male",
    birthYear: "c. 73 BC", deathYear: "c. 4 BC",
    description: "Roman-appointed king of Judea (r. 37–4 BC). A brilliant but brutal ruler: expanded the Temple into one of the wonders of the ancient world, built the Herodium, Masada, and Caesarea Maritima. When the magi arrived seeking 'the king of the Jews,' Herod was troubled, secretly consulted them about the star, and ordered the massacre of all male children under two in Bethlehem ('the Slaughter of the Innocents'). Died shortly after, having executed family members including his wife and sons. His death prompted the return of Jesus's family from Egypt. Father of Herod Antipas, Herod Philip, and Herod Archelaus.",
    tags: ["king", "antagonist"] });
}

// ── Relationships ─────────────────────────────────────────────────────────────
async function seedRelationships() {
  // ── John's family ─────────────────────────────────────────────────────
  await insertRel("zechariah_nt", "spouse_of",   "elizabeth",    "Zechariah and Elizabeth, both righteous (Luke 1:5-7)");
  await insertRel("zechariah_nt", "parent_of",   "john_baptist", "Angel Gabriel announced John's birth (Luke 1:13)");
  await insertRel("elizabeth",    "parent_of",   "john_baptist", "Elizabeth bore John in her old age (Luke 1:57)");
  await insertRel("elizabeth",    "other",       "mary_mother",  "Elizabeth was Mary's kinswoman/relative — not a sibling (Luke 1:36; συγγενής)");

  // ── Jesus's family ────────────────────────────────────────────────────
  await insertRel("mary_mother",  "parent_of",   "jesus",        "Mary conceived Jesus by the Holy Spirit (Luke 1:35)");
  await insertRel("joseph_nt",    "parent_of",   "jesus",        "Joseph, legal father in the Davidic line (Matt 1:16)");
  await insertRel("joseph_nt",    "spouse_of",   "mary_mother",  "Betrothed; did not know her until after Jesus's birth (Matt 1:25)");

  // ── Messianic line from OT ────────────────────────────────────────────
  await insertRelByName("David", "ancestor_of",  "Jesus",        "Jesus son of David — the Davidic Messiah (Matt 1:1)");
  await insertRelByName("Abraham","ancestor_of", "Jesus",        "Jesus son of Abraham (Matt 1:1)");
  await insertRelByName("Zerubbabel","ancestor_of","Jesus",      "Through Zerubbabel in Matthew's genealogy (Matt 1:12-16)");
  await insertRelByName("Boaz","ancestor_of",    "Jesus",        "Boaz in both Matthew and Luke genealogies (Matt 1:5)");

  // ── John the Baptist and Jesus ────────────────────────────────────────
  await insertRel("john_baptist", "ally_of",     "jesus",        "'Behold the Lamb of God' — forerunner who baptized Jesus");
  await insertRel("john_baptist", "other",       "jesus",        "Relatives through Mary and Elizabeth's kinship — cousins by tradition");

  // ── Herod the Great ───────────────────────────────────────────────────
  await insertRel("herod_great",  "enemy_of",    "jesus",        "Ordered massacre of Bethlehem infants to kill the newborn king");
  await insertRel("herod_great",  "enemy_of",    "john_baptist", "His dynasty's later corruption culminated in John's execution");
}

// ── Scripture references ───────────────────────────────────────────────────────
async function seedRefs() {
  await insertRef("zechariah_nt", "Luke",     1,  5,  1, 80, "Temple vision; struck mute; Elizabeth pregnant; Benedictus");
  await insertRef("elizabeth",    "Luke",     1,  5,  1, 60, "Conceives John; Mary's visit; recognition of Christ");
  await insertRef("john_baptist", "Matthew",  3,  1, 14, 12, "Preaching in the desert; baptizes Jesus; beheaded");
  await insertRef("john_baptist", "Luke",     1, 57,  3, 20, "Birth; childhood; ministry and death");
  await insertRef("john_baptist", "John",     1, 19,  3, 36, "Testimony about himself; 'Behold the Lamb of God'");
  await insertRef("jesus",        "Matthew",  1,  1, 28, 20, "Genealogy, birth, ministry, death, resurrection, Great Commission");
  await insertRef("jesus",        "Mark",     1,  1, 16, 20, "Baptism through resurrection");
  await insertRef("jesus",        "Luke",     1, 31, 24, 53, "Birth narrative through resurrection and ascension");
  await insertRef("jesus",        "John",     1,  1, 21, 25, "'In the beginning was the Word' through resurrection appearances");
  await insertRef("mary_mother",  "Luke",     1, 26,  2, 52, "Annunciation; Magnificat; birth; presentation; finding in Temple");
  await insertRef("mary_mother",  "John",     2,  1,  2, 12, "Wedding at Cana; 'do whatever he tells you'");
  await insertRef("mary_mother",  "John",    19, 25, 19, 27, "At the foot of the cross; entrusted to beloved disciple");
  await insertRef("mary_mother",  "Acts",     1, 14,  1, 14, "Present in upper room before Pentecost");
  await insertRef("joseph_nt",    "Matthew",  1, 18,  2, 23, "Dream; goes to Bethlehem; flight to Egypt; settles in Nazareth");
  await insertRef("joseph_nt",    "Luke",     2,  4,  2, 52, "Census journey; presentation at Temple; finding in Temple at 12");
  await insertRef("simeon_nt",    "Luke",     2, 25,  2, 35, "Nunc Dimittis; 'a sword will pierce your soul also'");
  await insertRef("anna_prophet", "Luke",     2, 36,  2, 38, "84 years in the Temple; gives thanks; speaks to all waiting");
  await insertRef("herod_great",  "Matthew",  2,  1,  2, 22, "Magi's visit; massacre of innocents; dies prompting return from Egypt");
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Seeding NT Birth people...");
  await seedPeople();
  console.log("Seeding NT Birth relationships...");
  await seedRelationships();
  console.log("Seeding NT Birth scripture references...");
  await seedRefs();

  const pc = await db.execute("SELECT COUNT(*) as c FROM people");
  const rc = await db.execute("SELECT COUNT(*) as c FROM relationships");
  const sc = await db.execute("SELECT COUNT(*) as c FROM scripture_refs");
  console.log(`\n✓ NT Birth seed complete.`);
  console.log(`  Total people now: ${(pc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total relationships now: ${(rc.rows[0] as unknown as { c: number }).c}`);
  console.log(`  Total scripture refs now: ${(sc.rows[0] as unknown as { c: number }).c}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
