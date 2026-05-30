import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN ?? process.env.TURSO_DATABASE_TURSO_AUTH_TOKEN,
});

// ── helpers ────────────────────────────────────────────────────────────────
const ids: Record<string, string> = {};
const names: Record<string, string> = {};   // key → display name for denormalized cols

function id(key: string) {
  if (!ids[key]) ids[key] = crypto.randomUUID();
  return ids[key];
}

async function insertPerson(p: {
  key: string; name: string; alsoKnownAs?: string; gender: string;
  description: string; tags: string[];
}) {
  names[p.key] = p.name;
  await db.execute({
    sql: `INSERT OR IGNORE INTO people (id,name,also_known_as,gender,testament,birth_year,death_year,description,tags,created_at)
          VALUES (?,?,?,?,'OT','','',?,?,datetime('now'))`,
    args: [id(p.key), p.name, p.alsoKnownAs ?? '', p.gender, p.description, JSON.stringify(p.tags)],
  });
}

async function insertRel(aKey: string, type: string, bKey: string, notes?: string) {
  await db.execute({
    sql: `INSERT OR IGNORE INTO relationships (id,person_a_id,person_a_name,type,person_b_id,person_b_name,notes,created_at)
          VALUES (?,?,?,?,?,?,?,datetime('now'))`,
    // Use resolved display names, falling back to the key if person wasn't seeded
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

// ── people ─────────────────────────────────────────────────────────────────
async function seedPeople() {
  // ── Primeval history ───────────────────────────────────────────────────
  await insertPerson({ key: "adam", name: "Adam", gender: "male",
    description: "The first man, formed by God from the dust of the ground. Placed in the Garden of Eden to tend it. Fell through disobedience and was expelled.",
    tags: ["patriarch", "antediluvian", "first man"] });

  await insertPerson({ key: "eve", name: "Eve", gender: "female",
    description: "The first woman, formed from Adam's rib. Mother of all living. Led astray by the serpent and ate the forbidden fruit.",
    tags: ["matriarch", "antediluvian", "first woman"] });

  await insertPerson({ key: "cain", name: "Cain", gender: "male",
    description: "Firstborn son of Adam and Eve. A farmer who murdered his brother Abel out of jealousy after God accepted Abel's offering over his. Marked by God and sent to wander. Founded a city and named it after his son Enoch.",
    tags: ["antediluvian"] });

  await insertPerson({ key: "abel", name: "Abel", gender: "male",
    description: "Second son of Adam and Eve. A shepherd whose offering God regarded with favor. Murdered by his brother Cain — the first death in Scripture.",
    tags: ["antediluvian"] });

  await insertPerson({ key: "enoch_cain", name: "Enoch", alsoKnownAs: "Enoch son of Cain",
    gender: "male",
    description: "Son of Cain. Cain built a city and named it after him. Not to be confused with Enoch of Seth's line who walked with God.",
    tags: ["antediluvian"] });

  await insertPerson({ key: "seth", name: "Seth", gender: "male",
    description: "Third son of Adam and Eve, given as a replacement for Abel. Ancestor of Noah and the messianic line. His generation began calling on the name of the Lord.",
    tags: ["antediluvian", "patriarch"] });

  await insertPerson({ key: "enosh", name: "Enosh", alsoKnownAs: "Enos", gender: "male",
    description: "Son of Seth. In his time, people began to call on the name of the Lord.",
    tags: ["antediluvian"] });

  await insertPerson({ key: "kenan", name: "Kenan", alsoKnownAs: "Cainan", gender: "male",
    description: "Son of Enosh, father of Mahalalel. Part of the antediluvian line from Seth to Noah in Genesis 5.",
    tags: ["antediluvian"] });

  await insertPerson({ key: "mahalalel", name: "Mahalalel", alsoKnownAs: "Mahalaleel", gender: "male",
    description: "Son of Kenan, father of Jared. Part of the antediluvian genealogy in Genesis 5.",
    tags: ["antediluvian"] });

  await insertPerson({ key: "jared", name: "Jared", gender: "male",
    description: "Son of Mahalalel, father of Enoch who walked with God. Part of the antediluvian genealogy in Genesis 5.",
    tags: ["antediluvian"] });

  await insertPerson({ key: "enoch_seth", name: "Enoch", alsoKnownAs: "Enoch son of Jared",
    gender: "male",
    description: "Son of Jared (of Seth's line), father of Methuselah. Walked faithfully with God and was taken by God without dying — a rare distinction in Scripture.",
    tags: ["antediluvian"] });

  await insertPerson({ key: "methuselah", name: "Methuselah", gender: "male",
    description: "Son of Enoch (of Seth's line), father of Lamech, grandfather of Noah. Lived 969 years — the longest lifespan recorded in Scripture.",
    tags: ["antediluvian"] });

  await insertPerson({ key: "lamech_seth", name: "Lamech", alsoKnownAs: "Lamech son of Methuselah",
    gender: "male",
    description: "Son of Methuselah and father of Noah. Prophesied that Noah would bring relief from the curse on the ground.",
    tags: ["antediluvian"] });

  await insertPerson({ key: "noah", name: "Noah", gender: "male",
    description: "Son of Lamech. Found favor with God while the rest of humanity was corrupt. Built the ark as God commanded, preserving his family and animals through the flood. Made a covenant with God after the flood.",
    tags: ["patriarch", "antediluvian"] });

  // ── Post-flood ─────────────────────────────────────────────────────────
  await insertPerson({ key: "shem", name: "Shem", gender: "male",
    description: "Eldest son of Noah. Ancestor of the Semitic peoples, including Abraham. Noah blessed him after he and Japheth covered their father's nakedness.",
    tags: ["patriarch"] });

  await insertPerson({ key: "ham", name: "Ham", gender: "male",
    description: "Second son of Noah. Saw his father's nakedness and told his brothers. Noah cursed Ham's son Canaan as a result. Ancestor of the Canaanites, Egyptians, and Cushites.",
    tags: ["patriarch"] });

  await insertPerson({ key: "japheth", name: "Japheth", gender: "male",
    description: "Third son of Noah. Ancestor of the Indo-European peoples. Blessed by Noah alongside Shem.",
    tags: ["patriarch"] });

  await insertPerson({ key: "cush", name: "Cush", gender: "male",
    description: "Son of Ham, grandson of Noah. Father of Nimrod and ancestor of the Cushites (Ethiopians). His descendants settled in northeast Africa and Arabia.",
    tags: ["patriarch"] });

  await insertPerson({ key: "nimrod", name: "Nimrod", gender: "male",
    description: "Son of Cush, great-grandson of Noah. A mighty hunter before the Lord. Founded cities including Babel, Erech, and Nineveh. Often associated with the Tower of Babel.",
    tags: ["king"] });

  // ── Shem → Abraham line (Gen 11:10-26) ────────────────────────────────
  await insertPerson({ key: "arpachshad", name: "Arpachshad", alsoKnownAs: "Arphaxad", gender: "male",
    description: "Son of Shem, born two years after the flood. Ancestor of the Hebrew people. Father of Shelah and grandfather of Eber.",
    tags: ["patriarch"] });

  await insertPerson({ key: "shelah", name: "Shelah", gender: "male",
    description: "Son of Arpachshad, father of Eber. Ancestor of the Hebrew line.",
    tags: ["patriarch"] });

  await insertPerson({ key: "eber", name: "Eber", gender: "male",
    description: "Son of Shelah, father of Peleg and Joktan. Some traditions derive the word 'Hebrew' (Ivri) from his name. Ancestor of Abraham.",
    tags: ["patriarch"] });

  await insertPerson({ key: "peleg", name: "Peleg", gender: "male",
    description: "Son of Eber. In his days the earth was divided (Genesis 10:25). Father of Reu.",
    tags: ["patriarch"] });

  await insertPerson({ key: "reu", name: "Reu", gender: "male",
    description: "Son of Peleg, father of Serug. Part of the post-flood genealogy from Shem to Abraham.",
    tags: ["patriarch"] });

  await insertPerson({ key: "serug", name: "Serug", gender: "male",
    description: "Son of Reu, father of Nahor (grandfather of Abraham). Part of the genealogy in Genesis 11.",
    tags: ["patriarch"] });

  await insertPerson({ key: "nahor1", name: "Nahor", alsoKnownAs: "Nahor son of Serug", gender: "male",
    description: "Son of Serug, father of Terah, grandfather of Abraham. Not to be confused with his grandson Nahor (son of Terah, brother of Abraham).",
    tags: ["patriarch"] });

  await insertPerson({ key: "nahor2", name: "Nahor", alsoKnownAs: "Nahor son of Terah", gender: "male",
    description: "Son of Terah, brother of Abraham and Haran. Married Milcah, daughter of Haran. Father of Bethuel and grandfather of Rebekah and Laban.",
    tags: ["patriarch"] });

  // ── Terah's family ─────────────────────────────────────────────────────
  await insertPerson({ key: "terah", name: "Terah", gender: "male",
    description: "Father of Abram, Nahor, Haran, and Sarah (by a different mother). Set out from Ur of the Chaldeans toward Canaan with his family, but stopped and settled in Haran, where he died at 205 years old.",
    tags: ["patriarch"] });

  await insertPerson({ key: "haran", name: "Haran", gender: "male",
    description: "Son of Terah, younger brother of Abram. Father of Lot, Milcah, and Iscah. Died in Ur of the Chaldeans before his father Terah. The city of Haran is likely named after him.",
    tags: ["patriarch"] });

  await insertPerson({ key: "abraham", name: "Abraham", alsoKnownAs: "Abram",
    gender: "male",
    description: "Originally called Abram. Called by God to leave Ur for Canaan. Father of the faith — God made an everlasting covenant with him, promising land, descendants, and blessing to all nations. Father of Ishmael (by Hagar) and Isaac (by Sarah). Tested supremely when commanded to sacrifice Isaac.",
    tags: ["patriarch", "father of faith"] });

  await insertPerson({ key: "sarah", name: "Sarah", alsoKnownAs: "Sarai",
    gender: "female",
    description: "Originally called Sarai. Daughter of Terah by a different mother than Abraham, making her Abraham's half-sister (Gen 20:12). Wife of Abraham. Barren for decades; miraculously conceived and bore Isaac at age 90. The only woman in Scripture whose age at death is recorded (127 years).",
    tags: ["matriarch"] });

  await insertPerson({ key: "lot", name: "Lot", gender: "male",
    description: "Son of Haran, nephew of Abraham. Traveled with Abraham from Ur. Chose the well-watered Jordan Valley and settled near Sodom. Rescued from Sodom's destruction by angels. Father of Moab and Ben-ammi by his daughters.",
    tags: ["patriarch"] });

  await insertPerson({ key: "hagar", name: "Hagar", gender: "female",
    description: "Egyptian servant of Sarah. Given to Abraham as a wife at Sarah's initiative. Bore Ishmael. Twice encountered the angel of the Lord — once while fleeing Sarah's harsh treatment, and once after being expelled with Ishmael. Named God 'El Roi' (the God who sees).",
    tags: ["matriarch"] });

  await insertPerson({ key: "ishmael", name: "Ishmael", gender: "male",
    description: "Son of Abraham and Hagar. God promised to make him a great nation. Circumcised with Abraham at 13. Expelled with Hagar after Isaac's birth. Became an archer and settled in the wilderness of Paran. Ancestor of twelve princes.",
    tags: ["patriarch"] });

  await insertPerson({ key: "melchizedek", name: "Melchizedek", gender: "male",
    description: "King of Salem and priest of God Most High. Blessed Abraham and received a tithe from him after Abraham's defeat of the kings. A mysterious figure — no genealogy given. The author of Hebrews draws a comparison to Christ.",
    tags: ["king", "priest"] });

  await insertPerson({ key: "eliezer", name: "Eliezer", gender: "male",
    description: "Chief servant of Abraham, sent to find a wife for Isaac. Swore an oath on Abraham's behalf and traveled to Mesopotamia. His faithful, prayerful mission in Genesis 24 is among the most detailed narratives in the book.",
    tags: ["servant"] });

  // ── Isaac's generation ─────────────────────────────────────────────────
  await insertPerson({ key: "isaac", name: "Isaac", gender: "male",
    description: "Miracle son of Abraham and Sarah, born when Sarah was 90. The son of the covenant promise. Almost sacrificed by Abraham in the supreme test of faith. Married Rebekah. Father of Esau and Jacob. Lived 180 years — the most peaceful of the patriarchal lives.",
    tags: ["patriarch"] });

  await insertPerson({ key: "rebekah", name: "Rebekah", alsoKnownAs: "Rebecca",
    gender: "female",
    description: "Daughter of Bethuel, granddaughter of Nahor (Abraham's brother). Chosen by Eliezer to be Isaac's wife. Known for her initiative and hospitality. Received a prophetic word about her twin sons before birth. Favored Jacob and helped him deceive Isaac to obtain the birthright blessing.",
    tags: ["matriarch"] });

  await insertPerson({ key: "bethuel", name: "Bethuel", gender: "male",
    description: "Son of Nahor (Abraham's brother) and Milcah. Father of Rebekah and Laban. Lived in Paddan-aram.",
    tags: ["patriarch"] });

  await insertPerson({ key: "laban", name: "Laban", gender: "male",
    description: "Son of Bethuel, brother of Rebekah, father of Leah and Rachel. Jacob fled to him and served him 20 years — 7 for Rachel, 7 more after being deceived into marrying Leah, and 6 for flocks. Known for his deceit and self-interest.",
    tags: ["patriarch"] });

  await insertPerson({ key: "esau", name: "Esau", alsoKnownAs: "Edom",
    gender: "male",
    description: "Firstborn twin son of Isaac and Rebekah. A skilled hunter, his father's favorite. Sold his birthright to Jacob for a bowl of stew. Lost his father's blessing to Jacob's deception. Ancestor of the Edomites. Later reconciled with Jacob.",
    tags: ["patriarch"] });

  await insertPerson({ key: "jacob", name: "Jacob", alsoKnownAs: "Israel",
    gender: "male",
    description: "Second-born twin son of Isaac and Rebekah. Grasped Esau's heel at birth. Obtained Esau's birthright by cunning and his blessing by deception. Fled to Laban and married his two daughters. Wrestled with God at Peniel and was renamed Israel. Father of the twelve tribes.",
    tags: ["patriarch", "israel"] });

  // ── Jacob's wives ──────────────────────────────────────────────────────
  await insertPerson({ key: "leah", name: "Leah", gender: "female",
    description: "Elder daughter of Laban. Given to Jacob in place of Rachel by Laban's deception. Tender-eyed but unloved by Jacob. God opened her womb, and she bore six sons and a daughter: Reuben, Simeon, Levi, Judah, Issachar, Zebulun, and Dinah.",
    tags: ["matriarch"] });

  await insertPerson({ key: "rachel", name: "Rachel", gender: "female",
    description: "Younger daughter of Laban and Jacob's beloved wife. Barren for years while Leah bore children. Finally bore Joseph and then Benjamin, dying in childbirth near Bethlehem.",
    tags: ["matriarch"] });

  await insertPerson({ key: "bilhah", name: "Bilhah", gender: "female",
    description: "Rachel's servant, given to Jacob as a wife. Bore Dan and Naphtali on Rachel's behalf. Daughter of Laban according to some traditions.",
    tags: ["matriarch"] });

  await insertPerson({ key: "zilpah", name: "Zilpah", alsoKnownAs: "Zilpa",
    gender: "female",
    description: "Leah's servant, given to Jacob as a wife. Bore Gad and Asher on Leah's behalf.",
    tags: ["matriarch"] });

  // ── The twelve sons of Jacob ───────────────────────────────────────────
  await insertPerson({ key: "reuben", name: "Reuben", gender: "male",
    description: "Firstborn son of Jacob and Leah. Attempted to rescue Joseph from the pit. Later, sleeping with Bilhah cost him his birthright. He offered his own sons as surety for Benjamin.",
    tags: ["tribe of israel"] });

  await insertPerson({ key: "simeon", name: "Simeon", gender: "male",
    description: "Second son of Jacob and Leah. With Levi, avenged Dinah by killing the men of Shechem. Held hostage by Joseph in Egypt as surety for Benjamin's return.",
    tags: ["tribe of israel"] });

  await insertPerson({ key: "levi", name: "Levi", gender: "male",
    description: "Third son of Jacob and Leah. With Simeon, killed the men of Shechem after Dinah's defilement. Jacob's deathbed words denied Levi a territorial portion — but God later set his tribe apart as priests.",
    tags: ["tribe of israel", "priestly line"] });

  await insertPerson({ key: "judah", name: "Judah", gender: "male",
    description: "Fourth son of Jacob and Leah. Suggested selling Joseph rather than killing him. His story with Tamar (Genesis 38) is one of the most sobering in Genesis. Became the guarantor for Benjamin and offered himself in Benjamin's place. Ancestor of King David and Jesus. Received the scepter promise in Jacob's blessing.",
    tags: ["tribe of israel", "messianic line"] });

  await insertPerson({ key: "dan", name: "Dan", gender: "male",
    description: "Fifth son of Jacob, firstborn of Bilhah (Rachel's servant). His tribe settled in the north and was later associated with idolatry.",
    tags: ["tribe of israel"] });

  await insertPerson({ key: "naphtali", name: "Naphtali", gender: "male",
    description: "Sixth son of Jacob, second son of Bilhah. Jacob described him as 'a doe set free.' His territory in the north was later the region where Jesus began his ministry.",
    tags: ["tribe of israel"] });

  await insertPerson({ key: "gad", name: "Gad", gender: "male",
    description: "Seventh son of Jacob, firstborn of Zilpah (Leah's servant). Jacob described his tribe as one that would be raided but would raid in return.",
    tags: ["tribe of israel"] });

  await insertPerson({ key: "asher", name: "Asher", gender: "male",
    description: "Eighth son of Jacob, second son of Zilpah. Jacob promised his tribe rich food and royal delicacies. His tribe settled in the fertile northwest near the coast.",
    tags: ["tribe of israel"] });

  await insertPerson({ key: "issachar", name: "Issachar", gender: "male",
    description: "Ninth son of Jacob and Leah. Jacob compared him to a rawboned donkey — a hard worker who would bear the yoke of labor.",
    tags: ["tribe of israel"] });

  await insertPerson({ key: "zebulun", name: "Zebulun", gender: "male",
    description: "Tenth son of Jacob and Leah. Jacob prophesied his tribe would dwell by the sea and be a haven for ships.",
    tags: ["tribe of israel"] });

  await insertPerson({ key: "dinah", name: "Dinah", gender: "female",
    description: "Daughter of Jacob and Leah. Violated by Shechem, son of Hamor. Her brothers Simeon and Levi avenged her by killing all the men of Shechem.",
    tags: ["tribe of israel"] });

  await insertPerson({ key: "joseph", name: "Joseph", gender: "male",
    description: "Eleventh son of Jacob, firstborn of Rachel. His father's favorite, given a richly ornamented robe. Sold into Egypt by his jealous brothers. Resisted Potiphar's wife and was imprisoned. Interpreted Pharaoh's dreams and was elevated to second in command over Egypt. Saved Egypt and his family from famine. Forgave his brothers: 'You intended to harm me, but God intended it for good.'",
    tags: ["tribe of israel", "patriarch"] });

  await insertPerson({ key: "benjamin", name: "Benjamin", gender: "male",
    description: "Twelfth and youngest son of Jacob, second son of Rachel. Born as Rachel died near Bethlehem. His mother named him Ben-Oni (son of my sorrow) but Jacob called him Benjamin (son of my right hand). Jacob was fiercely protective of him after Joseph's apparent death.",
    tags: ["tribe of israel"] });

  // ── Judah's family ─────────────────────────────────────────────────────
  await insertPerson({ key: "tamar", name: "Tamar", gender: "female",
    description: "Daughter-in-law of Judah, wife first of Er then of Onan. After both husbands died and Shelah was withheld from her, she disguised herself and slept with Judah. Bore twins Perez and Zerah. Judah declared her more righteous than himself. Ancestor of David and Jesus.",
    tags: ["matriarch", "messianic line"] });

  await insertPerson({ key: "er", name: "Er", gender: "male",
    description: "Firstborn son of Judah. Married Tamar but was wicked in the Lord's sight, so the Lord put him to death.",
    tags: [] });

  await insertPerson({ key: "onan", name: "Onan", gender: "male",
    description: "Second son of Judah. Married Tamar after Er died. Refused to fulfill his duty to raise offspring for his brother. What he did was wicked in the Lord's sight, so the Lord put him to death also.",
    tags: [] });

  await insertPerson({ key: "perez", name: "Perez", gender: "male",
    description: "Son of Judah and Tamar, twin of Zerah. Though Zerah's hand emerged first, Perez broke through ahead of him. His name means 'breach.' Ancestor of David and Jesus.",
    tags: ["messianic line"] });

  // ── Joseph in Egypt ────────────────────────────────────────────────────
  await insertPerson({ key: "potiphar", name: "Potiphar", gender: "male",
    description: "Egyptian official, captain of Pharaoh's guard who bought Joseph from the Ishmaelite traders. Put Joseph in charge of his household. Had Joseph imprisoned after his wife falsely accused him.",
    tags: ["egyptian"] });

  await insertPerson({ key: "asenath", name: "Asenath", gender: "female",
    description: "Daughter of Potiphera, priest of On. Given to Joseph as wife by Pharaoh. Mother of Manasseh and Ephraim.",
    tags: ["egyptian", "matriarch"] });

  await insertPerson({ key: "manasseh", name: "Manasseh", alsoKnownAs: "Manasseh son of Joseph",
    gender: "male",
    description: "Firstborn son of Joseph and Asenath. Adopted by Jacob as his own, receiving a tribal inheritance. Although the firstborn, Jacob crossed his hands and gave Ephraim the greater blessing.",
    tags: ["tribe of israel"] });

  await insertPerson({ key: "ephraim", name: "Ephraim", gender: "male",
    description: "Second son of Joseph and Asenath. Adopted by Jacob and given the greater blessing over his older brother Manasseh. His tribe became the dominant northern tribe and is sometimes used as a name for the northern kingdom itself.",
    tags: ["tribe of israel"] });
}

// ── relationships ──────────────────────────────────────────────────────────
async function seedRelationships() {
  // Adam & Eve
  await insertRel("adam", "spouse_of", "eve");
  await insertRel("adam", "parent_of", "cain");
  await insertRel("adam", "parent_of", "abel");
  await insertRel("adam", "parent_of", "seth");
  await insertRel("eve", "parent_of", "cain");
  await insertRel("eve", "parent_of", "abel");
  await insertRel("eve", "parent_of", "seth");

  // Cain's line
  await insertRel("cain", "parent_of", "enoch_cain");

  // Seth line — complete antediluvian chain Enosh → Noah
  await insertRel("seth", "parent_of", "enosh");
  await insertRel("enosh", "parent_of", "kenan");
  await insertRel("kenan", "parent_of", "mahalalel");
  await insertRel("mahalalel", "parent_of", "jared");
  await insertRel("jared", "parent_of", "enoch_seth");
  await insertRel("enoch_seth", "parent_of", "methuselah");
  await insertRel("methuselah", "parent_of", "lamech_seth");
  await insertRel("lamech_seth", "parent_of", "noah");

  // Noah's family
  await insertRel("noah", "parent_of", "shem");
  await insertRel("noah", "parent_of", "ham");
  await insertRel("noah", "parent_of", "japheth");
  // Ham → Cush → Nimrod
  await insertRel("ham", "parent_of", "cush");
  await insertRel("cush", "parent_of", "nimrod");

  // Shem → Abraham line (Gen 11:10-26)
  await insertRel("shem", "parent_of", "arpachshad");
  await insertRel("arpachshad", "parent_of", "shelah");
  await insertRel("shelah", "parent_of", "eber");
  await insertRel("eber", "parent_of", "peleg");
  await insertRel("peleg", "parent_of", "reu");
  await insertRel("reu", "parent_of", "serug");
  await insertRel("serug", "parent_of", "nahor1");
  await insertRel("nahor1", "parent_of", "terah");

  // Terah's family — Terah's sons: Abram, Nahor, Haran; daughter: Sarai (Gen 20:12)
  await insertRel("terah", "parent_of", "abraham");
  await insertRel("terah", "parent_of", "nahor2");
  await insertRel("terah", "parent_of", "haran");
  await insertRel("terah", "parent_of", "sarah", "Sarah was Terah's daughter by a different mother (Gen 20:12)");
  // Haran's children: Lot, Milcah, Iscah
  await insertRel("haran", "parent_of", "lot");
  // Nahor II → Bethuel (connects Rebekah and Laban to the main tree)
  await insertRel("nahor2", "parent_of", "bethuel");
  // Sarah is Abraham's half-sister (same father, different mother)
  await insertRel("abraham", "sibling_of", "sarah", "Half-siblings — same father Terah, different mothers (Gen 20:12)");

  // Abraham's family
  await insertRel("abraham", "spouse_of", "sarah");
  await insertRel("abraham", "spouse_of", "hagar", "Hagar was a concubine given by Sarah");
  await insertRel("abraham", "parent_of", "ishmael");
  await insertRel("abraham", "parent_of", "isaac");
  await insertRel("sarah", "parent_of", "isaac");
  await insertRel("hagar", "parent_of", "ishmael");
  await insertRel("abraham", "ally_of", "melchizedek", "Melchizedek blessed Abraham; Abraham gave him a tithe");
  await insertRel("eliezer", "servant_of", "abraham");

  // Bethuel's family
  await insertRel("bethuel", "parent_of", "rebekah");
  await insertRel("bethuel", "parent_of", "laban");
  await insertRel("laban", "sibling_of", "rebekah");
  // Bilhah and Zilpah as daughters of Laban (rabbinic tradition, consistent with Gen 29-30)
  await insertRel("laban", "parent_of", "bilhah", "Bilhah given as servant to Rachel");
  await insertRel("laban", "parent_of", "leah");
  await insertRel("laban", "parent_of", "rachel");

  // Isaac's family
  await insertRel("isaac", "spouse_of", "rebekah");
  await insertRel("isaac", "parent_of", "esau");
  await insertRel("isaac", "parent_of", "jacob");
  await insertRel("rebekah", "parent_of", "esau");
  await insertRel("rebekah", "parent_of", "jacob");
  await insertRel("esau", "sibling_of", "jacob");

  // Jacob's family
  await insertRel("jacob", "spouse_of", "leah");
  await insertRel("jacob", "spouse_of", "rachel");
  await insertRel("jacob", "spouse_of", "bilhah");
  await insertRel("jacob", "spouse_of", "zilpah");

  // Leah's children
  for (const s of ["reuben","simeon","levi","judah","issachar","zebulun","dinah"]) {
    await insertRel("jacob", "parent_of", s);
    await insertRel("leah", "parent_of", s);
  }
  // Bilhah's children (for Rachel)
  for (const s of ["dan","naphtali"]) {
    await insertRel("jacob", "parent_of", s);
    await insertRel("bilhah", "parent_of", s);
  }
  // Zilpah's children (for Leah)
  for (const s of ["gad","asher"]) {
    await insertRel("jacob", "parent_of", s);
    await insertRel("zilpah", "parent_of", s);
  }
  await insertRel("jacob", "parent_of", "joseph");
  await insertRel("rachel", "parent_of", "joseph");
  await insertRel("jacob", "parent_of", "benjamin");
  await insertRel("rachel", "parent_of", "benjamin");

  // Joseph's family
  await insertRel("joseph", "spouse_of", "asenath");
  await insertRel("joseph", "parent_of", "manasseh");
  await insertRel("joseph", "parent_of", "ephraim");
  await insertRel("asenath", "parent_of", "manasseh");
  await insertRel("asenath", "parent_of", "ephraim");
  await insertRel("joseph", "servant_of", "potiphar", "Joseph served as head of Potiphar's household");

  // Judah's family
  await insertRel("judah", "parent_of", "er");
  await insertRel("judah", "parent_of", "onan");
  await insertRel("judah", "parent_of", "perez");
  await insertRel("tamar", "parent_of", "perez");
  await insertRel("er", "spouse_of", "tamar");
  await insertRel("onan", "spouse_of", "tamar");
}

// ── scripture references ───────────────────────────────────────────────────
async function seedRefs() {
  await insertRef("adam",    "Genesis", 1, 26, 2, 25, "Creation and life in Eden");
  await insertRef("adam",    "Genesis", 3,  1, 3, 24, "The fall");
  await insertRef("adam",    "Genesis", 4,  1, 4,  2);
  await insertRef("adam",    "Genesis", 5,  1, 5,  5, "Genealogy and death");

  await insertRef("eve",     "Genesis", 2, 18, 2, 25, "Creation of woman");
  await insertRef("eve",     "Genesis", 3,  1, 3, 24, "The fall");
  await insertRef("eve",     "Genesis", 4,  1, 4,  2);

  await insertRef("cain",    "Genesis", 4,  1, 4, 24);
  await insertRef("abel",    "Genesis", 4,  1, 4, 12);
  await insertRef("enoch_cain", "Genesis", 4, 17, 4, 18, "City named after him by Cain");

  await insertRef("seth",    "Genesis", 4, 25, 4, 26);
  await insertRef("seth",    "Genesis", 5,  3, 5,  8);

  await insertRef("enosh",   "Genesis", 4, 26, 4, 26);
  await insertRef("enosh",   "Genesis", 5,  6, 5, 11);

  await insertRef("kenan",     "Genesis", 5,  9, 5, 14);
  await insertRef("mahalalel", "Genesis", 5, 12, 5, 17);
  await insertRef("jared",     "Genesis", 5, 15, 5, 20);

  await insertRef("enoch_seth", "Genesis", 5, 18, 5, 24, "Walked with God and was taken");

  await insertRef("methuselah", "Genesis", 5, 21, 5, 27);
  await insertRef("lamech_seth","Genesis", 5, 25, 5, 31);

  await insertRef("noah",    "Genesis", 5, 29, 5, 32);
  await insertRef("noah",    "Genesis", 6,  5, 9, 29, "The flood and covenant");

  await insertRef("shem",    "Genesis", 5, 32, 5, 32);
  await insertRef("shem",    "Genesis", 9, 18, 10, 31);
  await insertRef("shem",    "Genesis", 11, 10, 11, 26, "Genealogy to Abram");

  await insertRef("ham",     "Genesis", 5, 32, 5, 32);
  await insertRef("ham",     "Genesis", 9, 18, 9, 27, "Noah's curse on Canaan");
  await insertRef("ham",     "Genesis", 10,  6, 10, 20, "Table of nations");

  await insertRef("japheth", "Genesis", 5, 32, 5, 32);
  await insertRef("japheth", "Genesis", 9, 18, 9, 27);
  await insertRef("japheth", "Genesis", 10,  1, 10,  5);

  await insertRef("cush",    "Genesis", 10,  6, 10,  8);
  await insertRef("nimrod",  "Genesis", 10,  8, 10, 12, "Mighty hunter and city founder");

  await insertRef("arpachshad", "Genesis", 11, 10, 11, 13);
  await insertRef("shelah",     "Genesis", 11, 14, 11, 17);
  await insertRef("eber",       "Genesis", 10, 24, 10, 25, "Father of Peleg and Joktan");
  await insertRef("eber",       "Genesis", 11, 16, 11, 17);
  await insertRef("peleg",      "Genesis", 10, 25, 10, 25, "In his days the earth was divided");
  await insertRef("peleg",      "Genesis", 11, 18, 11, 19);
  await insertRef("reu",        "Genesis", 11, 20, 11, 21);
  await insertRef("serug",      "Genesis", 11, 22, 11, 23);
  await insertRef("nahor1",     "Genesis", 11, 24, 11, 25);
  await insertRef("nahor2",     "Genesis", 11, 27, 11, 29, "Son of Terah; married Milcah daughter of Haran");
  await insertRef("nahor2",     "Genesis", 22, 20, 22, 24, "His children listed after Akedah");

  await insertRef("terah",   "Genesis", 11, 24, 11, 32, "Journey from Ur toward Canaan");
  await insertRef("haran",   "Genesis", 11, 26, 11, 29, "Terah's son; died in Ur");

  await insertRef("abraham", "Genesis", 11, 26, 12,  9, "Call and departure from Haran");
  await insertRef("abraham", "Genesis", 14,  1, 14, 24, "Rescues Lot; meets Melchizedek");
  await insertRef("abraham", "Genesis", 15,  1, 15, 21, "Covenant with God");
  await insertRef("abraham", "Genesis", 17,  1, 17, 27, "Covenant of circumcision; renamed Abraham");
  await insertRef("abraham", "Genesis", 18,  1, 19, 29, "Three visitors; intercedes for Sodom");
  await insertRef("abraham", "Genesis", 21,  1, 21, 21, "Isaac born; Hagar expelled");
  await insertRef("abraham", "Genesis", 22,  1, 22, 19, "The binding of Isaac");
  await insertRef("abraham", "Genesis", 25,  1, 25, 11, "Death of Abraham");

  await insertRef("sarah",   "Genesis", 11, 29, 12, 20);
  await insertRef("sarah",   "Genesis", 17, 15, 17, 21, "Renamed Sarah; promised a son");
  await insertRef("sarah",   "Genesis", 18,  9, 18, 15, "Laughs at the promise");
  await insertRef("sarah",   "Genesis", 21,  1, 21, 12, "Birth of Isaac");
  await insertRef("sarah",   "Genesis", 23,  1, 23, 20, "Death of Sarah");

  await insertRef("lot",     "Genesis", 11, 27, 14, 16);
  await insertRef("lot",     "Genesis", 18, 16, 19, 38, "Flees Sodom; daughters' sin");

  await insertRef("hagar",   "Genesis", 16,  1, 16, 16, "Flees Sarah; angel's promise");
  await insertRef("hagar",   "Genesis", 21,  9, 21, 21, "Expelled with Ishmael; God provides");

  await insertRef("ishmael", "Genesis", 16,  1, 16, 16);
  await insertRef("ishmael", "Genesis", 17, 18, 17, 27, "Circumcised with Abraham");
  await insertRef("ishmael", "Genesis", 21,  8, 21, 21, "Expelled; God's provision");
  await insertRef("ishmael", "Genesis", 25, 12, 25, 18, "Genealogy of Ishmael");

  await insertRef("melchizedek", "Genesis", 14, 17, 14, 24, "Blesses Abram; receives tithe");

  await insertRef("eliezer", "Genesis", 15,  2, 15,  2, "Mentioned as heir before Isaac");
  await insertRef("eliezer", "Genesis", 24,  1, 24, 67, "Sent to find Isaac's wife");

  await insertRef("isaac",   "Genesis", 17, 19, 17, 21, "Promised before his birth");
  await insertRef("isaac",   "Genesis", 21,  1, 21,  8, "Birth and weaning");
  await insertRef("isaac",   "Genesis", 22,  1, 22, 19, "The binding");
  await insertRef("isaac",   "Genesis", 24,  1, 24, 67, "Marriage to Rebekah");
  await insertRef("isaac",   "Genesis", 25, 19, 26, 35, "His life and sons");
  await insertRef("isaac",   "Genesis", 27,  1, 28,  5, "Blesses Jacob");
  await insertRef("isaac",   "Genesis", 35, 27, 35, 29, "Death of Isaac");

  await insertRef("rebekah", "Genesis", 22, 20, 24, 67, "Introduced and betrothed");
  await insertRef("rebekah", "Genesis", 25, 19, 28,  9, "Birth of sons; helps Jacob");

  await insertRef("bethuel", "Genesis", 22, 22, 24, 50);

  await insertRef("laban",   "Genesis", 24, 29, 24, 60, "Welcomes Eliezer");
  await insertRef("laban",   "Genesis", 28, 10, 31, 55, "Jacob's 20 years in his household");

  await insertRef("esau",    "Genesis", 25, 24, 28,  9, "Birth, birthright, blessing lost");
  await insertRef("esau",    "Genesis", 32,  3, 33, 20, "Reconciliation with Jacob");
  await insertRef("esau",    "Genesis", 36,  1, 36, 43, "Genealogy of Esau/Edom");

  await insertRef("jacob",   "Genesis", 25, 24, 27, 46, "Birth through stolen blessing");
  await insertRef("jacob",   "Genesis", 28,  1, 32, 32, "Bethel, Laban's house, wrestling at Peniel");
  await insertRef("jacob",   "Genesis", 33,  1, 36, 29, "Returns to Canaan; Dinah");
  await insertRef("jacob",   "Genesis", 37,  1, 50, 14, "Joseph's story intertwined with Jacob");
  await insertRef("jacob",   "Genesis", 49,  1, 49, 33, "Blesses his twelve sons");

  await insertRef("leah",    "Genesis", 29, 16, 30, 21, "Marriage and children");
  await insertRef("leah",    "Genesis", 49, 31, 49, 31, "Buried in Machpelah");

  await insertRef("rachel",  "Genesis", 29, 16, 30, 24, "Marriage; bears Joseph");
  await insertRef("rachel",  "Genesis", 35, 16, 35, 20, "Death bearing Benjamin");

  await insertRef("bilhah",  "Genesis", 29, 29, 30,  8);
  await insertRef("bilhah",  "Genesis", 35, 22, 35, 22, "Slept with by Reuben");

  await insertRef("zilpah",  "Genesis", 29, 24, 30, 13);

  await insertRef("reuben",  "Genesis", 29, 32, 29, 32, "Birth");
  await insertRef("reuben",  "Genesis", 35, 22, 35, 22, "Slept with Bilhah");
  await insertRef("reuben",  "Genesis", 37, 21, 37, 30, "Tried to save Joseph");
  await insertRef("reuben",  "Genesis", 42, 22, 42, 37, "Offers his sons as surety");
  await insertRef("reuben",  "Genesis", 49,  3, 49,  4, "Jacob's blessing: lost preeminence");

  await insertRef("simeon",  "Genesis", 29, 33, 29, 33);
  await insertRef("simeon",  "Genesis", 34,  1, 34, 31, "Attacks Shechem");
  await insertRef("simeon",  "Genesis", 42, 24, 42, 36, "Held hostage in Egypt");
  await insertRef("simeon",  "Genesis", 49,  5, 49,  7);

  await insertRef("levi",    "Genesis", 29, 34, 29, 34);
  await insertRef("levi",    "Genesis", 34,  1, 34, 31, "Attacks Shechem");
  await insertRef("levi",    "Genesis", 49,  5, 49,  7);

  await insertRef("judah",   "Genesis", 29, 35, 29, 35);
  await insertRef("judah",   "Genesis", 37, 26, 37, 27, "Sells Joseph");
  await insertRef("judah",   "Genesis", 38,  1, 38, 30, "Judah and Tamar");
  await insertRef("judah",   "Genesis", 43,  3, 44, 34, "Guarantor for Benjamin");
  await insertRef("judah",   "Genesis", 49,  8, 49, 12, "Scepter blessing");

  await insertRef("dan",     "Genesis", 30,  6, 30,  6);
  await insertRef("dan",     "Genesis", 49, 16, 49, 18);

  await insertRef("naphtali","Genesis", 30,  7, 30,  8);
  await insertRef("naphtali","Genesis", 49, 21, 49, 21);

  await insertRef("gad",     "Genesis", 30, 10, 30, 11);
  await insertRef("gad",     "Genesis", 49, 19, 49, 19);

  await insertRef("asher",   "Genesis", 30, 12, 30, 13);
  await insertRef("asher",   "Genesis", 49, 20, 49, 20);

  await insertRef("issachar","Genesis", 30, 17, 30, 18);
  await insertRef("issachar","Genesis", 49, 14, 49, 15);

  await insertRef("zebulun", "Genesis", 30, 19, 30, 20);
  await insertRef("zebulun", "Genesis", 49, 13, 49, 13);

  await insertRef("dinah",   "Genesis", 30, 21, 30, 21, "Birth");
  await insertRef("dinah",   "Genesis", 34,  1, 34, 31, "Violated by Shechem; brothers' revenge");

  await insertRef("joseph",  "Genesis", 30, 22, 30, 24, "Birth");
  await insertRef("joseph",  "Genesis", 37,  2, 37, 36, "Coat, dreams, sold into Egypt");
  await insertRef("joseph",  "Genesis", 39,  1, 41, 57, "Potiphar's house, prison, Pharaoh");
  await insertRef("joseph",  "Genesis", 42,  1, 45, 28, "Brothers come to Egypt");
  await insertRef("joseph",  "Genesis", 46,  1, 50, 26, "Family comes to Egypt; death");

  await insertRef("benjamin","Genesis", 35, 16, 35, 20, "Born as Rachel died");
  await insertRef("benjamin","Genesis", 42,  4, 42,  4, "Jacob refuses to send him");
  await insertRef("benjamin","Genesis", 43,  1, 45, 22, "Goes to Egypt with brothers");
  await insertRef("benjamin","Genesis", 49, 27, 49, 27, "Jacob's blessing: ravenous wolf");

  await insertRef("tamar",   "Genesis", 38,  1, 38, 30);
  await insertRef("er",      "Genesis", 38,  1, 38, 10);
  await insertRef("onan",    "Genesis", 38,  4, 38, 10);
  await insertRef("perez",   "Genesis", 38, 29, 38, 30);

  await insertRef("potiphar","Genesis", 37, 36, 39, 23);
  await insertRef("asenath", "Genesis", 41, 45, 41, 52);

  await insertRef("manasseh","Genesis", 41, 51, 41, 52);
  await insertRef("manasseh","Genesis", 48,  1, 48, 22, "Jacob's adoption and blessing");

  await insertRef("ephraim", "Genesis", 41, 52, 41, 52);
  await insertRef("ephraim", "Genesis", 48,  1, 48, 22, "Receives greater blessing than Manasseh");
}

// ── schema init ───────────────────────────────────────────────────────────
async function initSchema() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, also_known_as TEXT NOT NULL DEFAULT '',
      gender TEXT NOT NULL DEFAULT 'unknown', testament TEXT NOT NULL DEFAULT 'OT',
      birth_year TEXT NOT NULL DEFAULT '', death_year TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '', tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS relationships (
      id TEXT PRIMARY KEY, person_a_id TEXT NOT NULL, person_a_name TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL, person_b_id TEXT NOT NULL, person_b_name TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS scripture_refs (
      id TEXT PRIMARY KEY, person_id TEXT NOT NULL, book TEXT NOT NULL,
      chapter_start INTEGER NOT NULL DEFAULT 1, verse_start INTEGER NOT NULL DEFAULT 1,
      chapter_end INTEGER NOT NULL DEFAULT 1, verse_end INTEGER NOT NULL DEFAULT 1,
      note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL)`,
  ];
  for (const sql of statements) await db.execute(sql);
}

// ── main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("Initializing schema...");
  await initSchema();
  console.log("Clearing existing data...");
  await db.execute("DELETE FROM scripture_refs");
  await db.execute("DELETE FROM relationships");
  await db.execute("DELETE FROM people");
  console.log("Seeding Genesis people...");
  await seedPeople();
  console.log("Seeding relationships...");
  await seedRelationships();
  console.log("Seeding scripture references...");
  await seedRefs();

  // Quick sanity check
  const pc = await db.execute("SELECT COUNT(*) as c FROM people");
  const rc = await db.execute("SELECT COUNT(*) as c FROM relationships");
  const sc = await db.execute("SELECT COUNT(*) as c FROM scripture_refs");
  console.log(`\n✓ Genesis seed complete.`);
  console.log(`  People: ${(pc.rows[0] as unknown as {c:number}).c}`);
  console.log(`  Relationships: ${(rc.rows[0] as unknown as {c:number}).c}`);
  console.log(`  Scripture refs: ${(sc.rows[0] as unknown as {c:number}).c}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
