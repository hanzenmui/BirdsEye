import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN ?? process.env.TURSO_DATABASE_TURSO_AUTH_TOKEN,
});

const DRY_RUN = process.argv.includes("--dry-run");

// ── helpers ────────────────────────────────────────────────────────────────
// New-person keys → freshly minted UUIDs for this correction run.
const newIds: Record<string, string> = {};
// Existing-person keys → their real DB id, resolved by looking up name (and,
// where ambiguous, also_known_as) at runtime. Populated by resolveExisting().
const existingIds: Record<string, string> = {};
const names: Record<string, string> = {}; // key → display name for denormalized cols

function newId(key: string) {
  if (!newIds[key]) newIds[key] = crypto.randomUUID();
  return newIds[key];
}

// Resolve the DB id for a person already in the seed data, by exact name
// (and, when given, also_known_as) match. Throws if not found — this script
// must never silently proceed against a live DB with an unresolved id.
async function resolveExisting(key: string, name: string, alsoKnownAs?: string): Promise<string> {
  if (existingIds[key]) return existingIds[key];
  const row = alsoKnownAs
    ? await db.execute({
        sql: "SELECT id, name FROM people WHERE name = ? AND also_known_as = ? LIMIT 1",
        args: [name, alsoKnownAs],
      })
    : await db.execute({
        sql: "SELECT id, name FROM people WHERE name = ? LIMIT 1",
        args: [name],
      });
  const r = row.rows[0] as unknown as { id: string; name: string } | undefined;
  if (!r) {
    throw new Error(
      `resolveExisting: could not find existing person for key="${key}" name="${name}" akas="${alsoKnownAs ?? ""}" — aborting, refusing to guess against live DB`
    );
  }
  existingIds[key] = r.id;
  names[key] = r.name;
  return r.id;
}

// Resolve the id of an existing relationship row by its (a, type, b) triple,
// matched via the people ids. Throws if zero or more than one match is found
// — this script must never mutate an ambiguous row on a live DB.
async function resolveRelationship(aId: string, type: string, bId: string): Promise<string> {
  const row = await db.execute({
    sql: "SELECT id FROM relationships WHERE person_a_id = ? AND type = ? AND person_b_id = ?",
    args: [aId, type, bId],
  });
  if (row.rows.length === 0) {
    throw new Error(`resolveRelationship: no relationship found for (${aId}, ${type}, ${bId})`);
  }
  if (row.rows.length > 1) {
    throw new Error(`resolveRelationship: ${row.rows.length} relationships found for (${aId}, ${type}, ${bId}) — ambiguous`);
  }
  return (row.rows[0] as unknown as { id: string }).id;
}

type Stmt = { sql: string; args: unknown[] };

const plannedStatements: { citation: string; description: string; stmt: Stmt }[] = [];

async function run(citation: string, description: string, stmt: Stmt) {
  plannedStatements.push({ citation, description, stmt });
  if (DRY_RUN) {
    console.log(`\n[${citation}] ${description}`);
    console.log(`  SQL:  ${stmt.sql.replace(/\s+/g, " ").trim()}`);
    console.log(`  ARGS: ${JSON.stringify(stmt.args)}`);
    return;
  }
  await db.execute({ sql: stmt.sql, args: stmt.args as (string | number | null)[] });
}

async function insertPerson(
  key: string,
  p: { name: string; alsoKnownAs?: string; gender: string; description: string; tags: string[] },
  citation: string
) {
  names[key] = p.name;
  await run(citation, `INSERT person "${p.name}" (key: ${key})`, {
    sql: `INSERT OR IGNORE INTO people (id,name,also_known_as,gender,testament,birth_year,death_year,description,tags,created_at)
          VALUES (?,?,?,?,'OT','','',?,?,datetime('now'))`,
    args: [newId(key), p.name, p.alsoKnownAs ?? "", p.gender, p.description, JSON.stringify(p.tags)],
  });
}

async function insertRel(aKey: string, aId: string, type: string, bKey: string, bId: string, citation: string, notes?: string) {
  await run(citation, `INSERT relationship ${aKey} --${type}--> ${bKey}`, {
    sql: `INSERT OR IGNORE INTO relationships (id,person_a_id,person_a_name,type,person_b_id,person_b_name,notes,created_at)
          VALUES (?,?,?,?,?,?,?,datetime('now'))`,
    args: [crypto.randomUUID(), aId, names[aKey] ?? aKey, type, bId, names[bKey] ?? bKey, notes ?? ""],
  });
}

async function insertRef(
  key: string,
  personId: string,
  book: string,
  cs: number,
  vs: number,
  ce?: number,
  ve?: number,
  citation?: string,
  note?: string
) {
  await run(citation ?? "", `INSERT scripture_ref for ${key}: ${book} ${cs}:${vs}-${ce ?? cs}:${ve ?? vs}`, {
    sql: `INSERT OR IGNORE INTO scripture_refs (id,person_id,book,chapter_start,verse_start,chapter_end,verse_end,note,created_at)
          VALUES (?,?,?,?,?,?,?,?,datetime('now'))`,
    args: [crypto.randomUUID(), personId, book, cs, vs, ce ?? cs, ve ?? vs, note ?? ""],
  });
}

// ── main correction routine ─────────────────────────────────────────────────
async function main() {
  console.log(DRY_RUN ? "=== DRY RUN — no statements will be executed ===" : "=== LIVE RUN — mutating database ===");

  // Resolve all existing people this script needs to reference, up front.
  const cainId = await resolveExisting("cain", "Cain");
  const enochCainId = await resolveExisting("enoch_cain", "Enoch", "Enoch son of Cain");
  const sethId = await resolveExisting("seth", "Seth");
  const enoshId = await resolveExisting("enosh", "Enosh", "Enos");
  const haranId = await resolveExisting("haran", "Haran");
  const nahor2Id = await resolveExisting("nahor2", "Nahor", "Nahor son of Terah");
  const bethuelId = await resolveExisting("bethuel", "Bethuel");
  const abrahamId = await resolveExisting("abraham", "Abraham", "Abram");
  const hagarId = await resolveExisting("hagar", "Hagar");
  const eliezerId = await resolveExisting("eliezer", "Eliezer");
  const labanId = await resolveExisting("laban", "Laban");
  const bilhahId = await resolveExisting("bilhah", "Bilhah");
  const judahId = await resolveExisting("judah", "Judah");
  const tamarId = await resolveExisting("tamar", "Tamar");
  const potiphar_ = await resolveExisting("potiphar", "Potiphar"); // referenced for disambiguation note context only
  const asenathId = await resolveExisting("asenath", "Asenath");
  const jacobId = await resolveExisting("jacob", "Jacob", "Israel");
  const manassehId = await resolveExisting("manasseh", "Manasseh", "Manasseh son of Joseph");
  const ephraimId = await resolveExisting("ephraim", "Ephraim");
  void potiphar_;

  // ───────────────────────────────────────────────────────────────────────
  // Finding S1: Cain's genealogical line (Gen 4:17-22) — nine descendants +
  // wives missing. Corrected list per controller note: use the full 10-name
  // list from the finding's own detailed text (Irad, Mehujael, Methushael,
  // lamech_cain, Adah, Zillah, Jabal, Jubal, Tubal-cain, Naamah) — NOT the
  // "7" figure in the finding's prose summary, which is an internal miscount.
  // ───────────────────────────────────────────────────────────────────────

  // Finding S1
  await insertPerson(
    "irad",
    {
      name: "Irad",
      gender: "male",
      description: "Son of Enoch (Cain's line), father of Mehujael. Part of Cain's genealogy in Genesis 4:17-18.",
      tags: ["antediluvian"],
    },
    "Finding S1"
  );

  // Finding S1
  await insertPerson(
    "mehujael",
    {
      name: "Mehujael",
      gender: "male",
      description: "Son of Irad, father of Methushael. Part of Cain's genealogy in Genesis 4:18.",
      tags: ["antediluvian"],
    },
    "Finding S1"
  );

  // Finding S1
  await insertPerson(
    "methushael",
    {
      name: "Methushael",
      gender: "male",
      description: "Son of Mehujael, father of Lamech (Cain's line). Part of Cain's genealogy in Genesis 4:18.",
      tags: ["antediluvian"],
    },
    "Finding S1"
  );

  // Finding S1 — distinct key from lamech_seth, parallel to enoch_cain/enoch_seth naming pattern
  await insertPerson(
    "lamech_cain",
    {
      name: "Lamech",
      alsoKnownAs: "Lamech son of Methushael",
      gender: "male",
      description:
        "Son of Methushael, of Cain's line. Took two wives, Adah and Zillah. Boasted to them of killing a man in vengeance. Not to be confused with Lamech son of Methuselah, father of Noah.",
      tags: ["antediluvian"],
    },
    "Finding S1"
  );

  // Finding S1
  await insertPerson(
    "adah",
    {
      name: "Adah",
      gender: "female",
      description: "First wife of Lamech (Cain's line). Mother of Jabal and Jubal. Genesis 4:19-20.",
      tags: ["antediluvian"],
    },
    "Finding S1"
  );

  // Finding S1
  await insertPerson(
    "zillah",
    {
      name: "Zillah",
      gender: "female",
      description: "Second wife of Lamech (Cain's line). Mother of Tubal-cain and Naamah. Genesis 4:19, 4:22.",
      tags: ["antediluvian"],
    },
    "Finding S1"
  );

  // Finding S1
  await insertPerson(
    "jabal",
    {
      name: "Jabal",
      gender: "male",
      description: "Son of Lamech and Adah. Father of those who dwell in tents and have livestock. Genesis 4:20.",
      tags: ["antediluvian"],
    },
    "Finding S1"
  );

  // Finding S1
  await insertPerson(
    "jubal",
    {
      name: "Jubal",
      gender: "male",
      description: "Son of Lamech and Adah. Father of all who play the lyre and pipe. Genesis 4:21.",
      tags: ["antediluvian"],
    },
    "Finding S1"
  );

  // Finding S1
  await insertPerson(
    "tubal_cain",
    {
      name: "Tubal-cain",
      gender: "male",
      description: "Son of Lamech and Zillah. Forged all instruments of bronze and iron. Genesis 4:22.",
      tags: ["antediluvian"],
    },
    "Finding S1"
  );

  // Finding S1
  await insertPerson(
    "naamah",
    {
      name: "Naamah",
      gender: "female",
      description: "Daughter of Lamech and Zillah, sister of Tubal-cain. Genesis 4:22.",
      tags: ["antediluvian"],
    },
    "Finding S1"
  );

  // Finding S1: relationship chain Enoch -> Irad -> Mehujael -> Methushael -> Lamech
  await insertRel("enoch_cain", enochCainId, "parent_of", "irad", newId("irad"), "Finding S1");
  // Finding S1
  await insertRel("irad", newId("irad"), "parent_of", "mehujael", newId("mehujael"), "Finding S1");
  // Finding S1
  await insertRel("mehujael", newId("mehujael"), "parent_of", "methushael", newId("methushael"), "Finding S1");
  // Finding S1
  await insertRel("methushael", newId("methushael"), "parent_of", "lamech_cain", newId("lamech_cain"), "Finding S1");
  // Finding S1: Lamech's two wives
  await insertRel("lamech_cain", newId("lamech_cain"), "spouse_of", "adah", newId("adah"), "Finding S1");
  // Finding S1
  await insertRel("lamech_cain", newId("lamech_cain"), "spouse_of", "zillah", newId("zillah"), "Finding S1");
  // Finding S1: Adah's children (parent_of from Adah; Lamech's patrilineal parent_of also added per the finding's framing)
  await insertRel("adah", newId("adah"), "parent_of", "jabal", newId("jabal"), "Finding S1");
  // Finding S1
  await insertRel("lamech_cain", newId("lamech_cain"), "parent_of", "jabal", newId("jabal"), "Finding S1");
  // Finding S1
  await insertRel("adah", newId("adah"), "parent_of", "jubal", newId("jubal"), "Finding S1");
  // Finding S1
  await insertRel("lamech_cain", newId("lamech_cain"), "parent_of", "jubal", newId("jubal"), "Finding S1");
  // Finding S1: Zillah's children (parent_of from Zillah; Lamech's patrilineal parent_of also added per the finding's framing)
  await insertRel("zillah", newId("zillah"), "parent_of", "tubal_cain", newId("tubal_cain"), "Finding S1");
  // Finding S1
  await insertRel("lamech_cain", newId("lamech_cain"), "parent_of", "tubal_cain", newId("tubal_cain"), "Finding S1");
  // Finding S1
  await insertRel("zillah", newId("zillah"), "parent_of", "naamah", newId("naamah"), "Finding S1");
  // Finding S1
  await insertRel("lamech_cain", newId("lamech_cain"), "parent_of", "naamah", newId("naamah"), "Finding S1");

  // Finding S1: scripture refs for the new people
  await insertRef("irad", newId("irad"), "Genesis", 4, 18, 4, 18, "Finding S1");
  // Finding S1
  await insertRef("mehujael", newId("mehujael"), "Genesis", 4, 18, 4, 18, "Finding S1");
  // Finding S1
  await insertRef("methushael", newId("methushael"), "Genesis", 4, 18, 4, 18, "Finding S1");
  // Finding S1
  await insertRef("lamech_cain", newId("lamech_cain"), "Genesis", 4, 18, 4, 24, "Finding S1", "Lamech's genealogy and his boast of vengeance");
  // Finding S1
  await insertRef("adah", newId("adah"), "Genesis", 4, 19, 4, 20, "Finding S1");
  // Finding S1
  await insertRef("zillah", newId("zillah"), "Genesis", 4, 19, 4, 22, "Finding S1");
  // Finding S1
  await insertRef("jabal", newId("jabal"), "Genesis", 4, 20, 4, 20, "Finding S1");
  // Finding S1
  await insertRef("jubal", newId("jubal"), "Genesis", 4, 21, 4, 21, "Finding S1");
  // Finding S1
  await insertRef("tubal_cain", newId("tubal_cain"), "Genesis", 4, 22, 4, 22, "Finding S1");
  // Finding S1
  await insertRef("naamah", newId("naamah"), "Genesis", 4, 22, 4, 22, "Finding S1");

  // ───────────────────────────────────────────────────────────────────────
  // Finding S2: Milcah and Iscah, daughters of Haran (Gen 11:29) — missing.
  // Controller decision: implement ONLY the required correction (Milcah,
  // Iscah, and the four listed relationships). Do NOT add the optional 11
  // siblings of Bethuel (Uz, Buz, Kemuel, Chesed, Hazo, Pildash, Jidlaph,
  // Tebah, Gaham, Tahash, Maacah).
  // ───────────────────────────────────────────────────────────────────────

  // Finding S2
  await insertPerson(
    "milcah",
    {
      name: "Milcah",
      gender: "female",
      description:
        "Daughter of Haran, wife of her uncle Nahor (son of Terah). Mother of Bethuel and seven other children (Gen 22:20-23). Grandmother of Rebekah.",
      tags: ["matriarch"],
    },
    "Finding S2"
  );

  // Finding S2
  await insertPerson(
    "iscah",
    {
      name: "Iscah",
      gender: "female",
      description: "Daughter of Haran, sister of Lot and Milcah. No further narrative role recorded in Genesis.",
      tags: [],
    },
    "Finding S2"
  );

  // Finding S2
  await insertRel("haran", haranId, "parent_of", "milcah", newId("milcah"), "Finding S2");
  // Finding S2
  await insertRel("haran", haranId, "parent_of", "iscah", newId("iscah"), "Finding S2");
  // Finding S2
  await insertRel("nahor2", nahor2Id, "spouse_of", "milcah", newId("milcah"), "Finding S2");
  // Finding S2: alongside the existing nahor2 parent_of bethuel relationship
  await insertRel("milcah", newId("milcah"), "parent_of", "bethuel", bethuelId, "Finding S2");

  // Finding S2: scripture refs
  await insertRef("milcah", newId("milcah"), "Genesis", 11, 29, 11, 29, "Finding S2", "Named as Haran's daughter and Nahor's wife");
  // Finding S2
  await insertRef("milcah", newId("milcah"), "Genesis", 22, 20, 22, 23, "Finding S2", "Mother of Bethuel and seven others");
  // Finding S2
  await insertRef("iscah", newId("iscah"), "Genesis", 11, 29, 11, 29, "Finding S2", "Named as Haran's daughter");

  // ───────────────────────────────────────────────────────────────────────
  // Finding S3: Zerah, Tamar's twin son (Gen 38:27-30) — missing.
  // ───────────────────────────────────────────────────────────────────────

  // Finding S3
  await insertPerson(
    "zerah_judah",
    {
      name: "Zerah",
      alsoKnownAs: "Zerah son of Judah",
      gender: "male",
      description:
        "Son of Judah and Tamar, twin brother of Perez. Though his hand emerged first and was marked with a scarlet thread, his brother Perez broke through and was born first. Ancestor of Achan. Not to be confused with Zerah, grandson of Esau via Reuel (Gen 36:13, 36:17).",
      tags: ["tribe of israel"],
    },
    "Finding S3"
  );

  // Finding S3: parallels the existing judah parent_of perez / tamar parent_of perez relationships
  await insertRel("judah", judahId, "parent_of", "zerah_judah", newId("zerah_judah"), "Finding S3");
  // Finding S3
  await insertRel("tamar", tamarId, "parent_of", "zerah_judah", newId("zerah_judah"), "Finding S3");

  // Finding S3
  await insertRef("zerah_judah", newId("zerah_judah"), "Genesis", 38, 27, 38, 30, "Finding S3");

  // ───────────────────────────────────────────────────────────────────────
  // Finding S4: Potiphera, priest of On, Asenath's father (Gen 41:45/41:50/
  // 46:20) — missing. Kept explicitly distinct from potiphar.
  // ───────────────────────────────────────────────────────────────────────

  // Finding S4
  await insertPerson(
    "potiphera",
    {
      name: "Potiphera",
      gender: "male",
      description:
        "Priest of On. Father of Asenath, whom Pharaoh gave to Joseph as wife. Not to be confused with Potiphar, captain of Pharaoh's guard, in whose house Joseph served.",
      tags: ["priest"],
    },
    "Finding S4"
  );

  // Finding S4
  await insertRel("potiphera", newId("potiphera"), "parent_of", "asenath", asenathId, "Finding S4");

  // Finding S4
  await insertRef("potiphera", newId("potiphera"), "Genesis", 41, 45, 41, 50, "Finding S4", "Identified as Asenath's father, priest of On");

  // ───────────────────────────────────────────────────────────────────────
  // Finding S5: Jacob's adoption of Manasseh and Ephraim (Gen 48:5) — no
  // jacob parent_of relationship existed, only Joseph/Asenath biological
  // links. Add alongside (not replacing) the existing relationships, per
  // the DB's own established Bilhah/Zilpah surrogate-motherhood convention.
  // ───────────────────────────────────────────────────────────────────────

  // Finding S5
  await insertRel("jacob", jacobId, "parent_of", "manasseh", manassehId, "Finding S5", "Adopted by Jacob per Gen 48:5 — 'they are mine, as Reuben and Simeon are'");
  // Finding S5
  await insertRel("jacob", jacobId, "parent_of", "ephraim", ephraimId, "Finding S5", "Adopted by Jacob per Gen 48:5 — 'they are mine, as Reuben and Simeon are'");

  // ───────────────────────────────────────────────────────────────────────
  // Finding I1: seth.description misattributes the "began to call on the
  // name of the Lord" event (Gen 4:26) to Seth's own generation rather than
  // Enosh's — remove the duplicated/misattributed clause from seth.description.
  // enosh.description already correctly attributes this and is unchanged.
  // ───────────────────────────────────────────────────────────────────────

  // Finding I1
  await run("Finding I1", `UPDATE people.description for seth (id: ${sethId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Third son of Adam and Eve, given as a replacement for Abel. Ancestor of Noah and the messianic line.",
      sethId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding I2: hagar's relationship annotation ("concubine") contradicts
  // hagar.description ("wife") and Gen 16:3's own wording. Align the
  // relationship annotation to the person description / textual wording.
  // ───────────────────────────────────────────────────────────────────────

  // Finding I2
  {
    const relId = await resolveRelationship(abrahamId, "spouse_of", hagarId);
    // Finding I2
    await run("Finding I2", `UPDATE relationships.notes for abraham spouse_of hagar (id: ${relId})`, {
      sql: `UPDATE relationships SET notes = ? WHERE id = ?`,
      args: ["Hagar was given to Abraham as a wife at Sarah's initiative (Gen 16:3)", relId],
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // Finding U1: seth's scripture ref for Gen 5:3-8 overlaps Adam's own
  // record (Gen 5:3-5 is about Adam). Narrow to Gen 5:6-8, which is
  // actually about Seth.
  // ───────────────────────────────────────────────────────────────────────

  // Finding U1
  {
    const row = await db.execute({
      sql: `SELECT id FROM scripture_refs WHERE person_id = ? AND book = ? AND chapter_start = ? AND verse_start = ? AND chapter_end = ? AND verse_end = ?`,
      args: [sethId, "Genesis", 5, 3, 5, 8],
    });
    const refRow = row.rows[0] as unknown as { id: string } | undefined;
    if (!refRow) {
      throw new Error("Finding U1: could not find seth's Genesis 5:3-8 scripture_ref row to correct");
    }
    // Finding U1
    await run("Finding U1", `UPDATE scripture_refs verse range for seth (id: ${refRow.id}) from Gen 5:3-8 to Gen 5:6-8`, {
      sql: `UPDATE scripture_refs SET chapter_start = ?, verse_start = ?, chapter_end = ?, verse_end = ? WHERE id = ?`,
      args: [5, 6, 5, 8, refRow.id],
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // Finding U2: eliezer.description asserts flatly that he is the unnamed
  // servant of Gen 24, but Gen 24 never names the servant — soften to
  // acknowledge this is a traditional identification, not stated in the text.
  // ───────────────────────────────────────────────────────────────────────

  // Finding U2 — minimal append of the finding's own suggested clause to the
  // existing description, rather than a full rewrite (keeps the original
  // wording intact and adds only the softening qualifier).
  await run("Finding U2", `UPDATE people.description for eliezer (id: ${eliezerId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Chief servant of Abraham, sent to find a wife for Isaac. Swore an oath on Abraham's behalf and traveled to Mesopotamia. His faithful, prayerful mission in Genesis 24 is among the most detailed narratives in the book (traditionally identified with the unnamed servant of Genesis 24, though he is not named there).",
      eliezerId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding U3: laban parent_of bilhah asserts an unsupported biological-
  // child relationship (Gen 29:29 explicitly distinguishes Bilhah, "his
  // female servant," from "his daughter Rachel" in the same clause; the
  // DB's own bilhah.description hedges this as "according to some
  // traditions"). Controller decision: option (a) — remove the relationship
  // entirely. Do NOT add a symmetric laban parent_of zilpah (that was
  // option (b), not chosen). Bilhah's spouse_of Jacob and parent_of her
  // sons relationships are untouched.
  // ───────────────────────────────────────────────────────────────────────

  // Finding U3
  {
    const relId = await resolveRelationship(labanId, "parent_of", bilhahId);
    // Finding U3
    await run("Finding U3", `DELETE relationship laban parent_of bilhah (id: ${relId})`, {
      sql: `DELETE FROM relationships WHERE id = ?`,
      args: [relId],
    });
  }

  // ───────────────────────────────────────────────────────────────────────

  console.log(`\n${DRY_RUN ? "[DRY RUN] Would execute" : "Executed"} ${plannedStatements.length} statements.`);
  const counts = { insert: 0, update: 0, delete: 0, other: 0 };
  for (const p of plannedStatements) {
    const sql = p.stmt.sql.trim().toUpperCase();
    if (sql.startsWith("INSERT")) counts.insert++;
    else if (sql.startsWith("UPDATE")) counts.update++;
    else if (sql.startsWith("DELETE")) counts.delete++;
    else counts.other++;
  }
  console.log(`  INSERTs: ${counts.insert}`);
  console.log(`  UPDATEs: ${counts.update}`);
  console.log(`  DELETEs: ${counts.delete}`);
  if (counts.other) console.log(`  Other:   ${counts.other}`);

  if (!DRY_RUN) {
    process.exit(0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
