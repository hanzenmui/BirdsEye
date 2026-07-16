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
  const dathanId = await resolveExisting("dathan", "Dathan");
  const abiramId = await resolveExisting("abiram", "Abiram");
  const pagielId = await resolveExisting("pagiel", "Pagiel", "Pagiel son of Ocran");
  const gershonId = await resolveExisting("gershon", "Gershon", "Gershon son of Levi");
  const merariId = await resolveExisting("merari", "Merari");
  const izharId = await resolveExisting("izhar", "Izhar");
  const mahlahId = await resolveExisting("mahlah", "Mahlah", "Mahlah daughter of Zelophehad");
  const tirzahId = await resolveExisting("tirzah_z", "Tirzah", "Tirzah daughter of Zelophehad");
  const manassehId = await resolveExisting("manasseh", "Manasseh", "Manasseh son of Joseph");
  const zelophehadId = await resolveExisting("zelophehad", "Zelophehad");

  // ───────────────────────────────────────────────────────────────────────
  // Finding 1: Eliab, father of Dathan and Abiram (Num 16:1), has no person
  // record — the only "Eliab" in the DB is eliab_helon, an unrelated prince
  // of Zebulun. Add a new person (key: eliab_reuben) and link him as parent
  // of both Dathan and Abiram.
  // ───────────────────────────────────────────────────────────────────────

  // Finding 1: new person record for Eliab the Reubenite, father of Dathan and Abiram
  await insertPerson(
    "eliab_reuben",
    {
      name: "Eliab",
      alsoKnownAs: "Eliab the Reubenite",
      gender: "male",
      description:
        "A Reubenite, father of Dathan and Abiram (Num 16:1). Not to be confused with Eliab son of Helon, the unrelated prince of the tribe of Zebulun (Num 1:9, 2:7).",
      tags: [],
    },
    "Finding 1"
  );

  // Finding 1: relationship — eliab_reuben parent_of dathan
  await insertRel("eliab_reuben", newId("eliab_reuben"), "parent_of", "dathan", dathanId, "Finding 1", "Dathan and Abiram were sons of Eliab (Num 16:1)");
  // Finding 1: relationship — eliab_reuben parent_of abiram
  await insertRel("eliab_reuben", newId("eliab_reuben"), "parent_of", "abiram", abiramId, "Finding 1", "Dathan and Abiram were sons of Eliab (Num 16:1)");

  // Finding 1: scripture ref for the new Eliab (Reubenite) person record
  await insertRef("eliab_reuben", newId("eliab_reuben"), "Numbers", 16, 1, 16, 1, "Finding 1", "Dathan and Abiram, the sons of Eliab");

  // ───────────────────────────────────────────────────────────────────────
  // Finding 2: On son of Peleth (Num 16:1), named alongside Korah, Dathan,
  // and Abiram as a co-conspirator, has no person record at all. Add a
  // minimal person record (key: on) with the same adversary_of Moses
  // relationship pattern used for the other three named rebels.
  // ───────────────────────────────────────────────────────────────────────

  // Finding 2: new person record for On son of Peleth
  await insertPerson(
    "on",
    {
      name: "On",
      alsoKnownAs: "On son of Peleth",
      gender: "male",
      description:
        "Son of Peleth, a Reubenite. Named alongside Korah, Dathan, and Abiram at the head of the rebellion against Moses (Num 16:1); not mentioned again in the narrative.",
      tags: ["antagonist"],
    },
    "Finding 2"
  );

  // Finding 2: relationship — on adversary_of Moses, paralleling the existing
  // Korah/Dathan/Abiram adversary_of Moses relationships
  {
    const mosesId = await resolveExisting("moses", "Moses");
    await insertRel("on", newId("on"), "adversary_of", "moses", mosesId, "Finding 2", "Named alongside Korah, Dathan, and Abiram at the head of the rebellion (Num 16:1)");
  }

  // Finding 2: scripture ref for the new On person record
  await insertRef("on", newId("on"), "Numbers", 16, 1, 16, 1, "Finding 2", "On the son of Peleth, sons of Reuben");

  // ───────────────────────────────────────────────────────────────────────
  // Finding 3: Pagiel's father is spelled "Ocran" in the database; the ESV
  // consistently spells the name "Ochran" (Num 1:13, 2:27, 7:72, 7:77,
  // 10:26). Fix both the also_known_as and description fields.
  // ───────────────────────────────────────────────────────────────────────

  // Finding 3
  await run("Finding 3", `UPDATE people.also_known_as for pagiel (id: ${pagielId})`, {
    sql: `UPDATE people SET also_known_as = ? WHERE id = ?`,
    args: ["Pagiel son of Ochran", pagielId],
  });

  // Finding 3
  await run("Finding 3", `UPDATE people.description for pagiel (id: ${pagielId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: ["Son of Ochran, prince of the tribe of Asher.", pagielId],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 4: Gershon's sons (Libni, Shimei) and Merari's sons (Mahli,
  // Mushi) — Num 3:18, 3:20 — have no person records, unlike Kohath's line
  // where the corresponding generation (Izhar) is fully represented. Add
  // minimal person records and parent_of relationships for full parity.
  // ───────────────────────────────────────────────────────────────────────

  // Finding 4: new person record for Libni, son of Gershon
  await insertPerson(
    "libni",
    {
      name: "Libni",
      gender: "male",
      description: "Son of Gershon, grandson of Levi. Head of the Libnite clan (Num 3:18). No further narrative role beyond this census listing.",
      tags: ["priestly line"],
    },
    "Finding 4"
  );

  // Finding 4: new person record for Shimei, son of Gershon (disambiguated
  // key from the unrelated Benjaminite Shimei in scripts/seed-2samuel.ts)
  await insertPerson(
    "shimei_gershon",
    {
      name: "Shimei",
      alsoKnownAs: "Shimei son of Gershon",
      gender: "male",
      description: "Son of Gershon, grandson of Levi. Head of the Shimeite clan (Num 3:18). Not to be confused with the unrelated Benjaminite Shimei. No further narrative role beyond this census listing.",
      tags: ["priestly line"],
    },
    "Finding 4"
  );

  // Finding 4: new person record for Mahli, son of Merari
  await insertPerson(
    "mahli",
    {
      name: "Mahli",
      gender: "male",
      description: "Son of Merari, grandson of Levi. Head of the Mahlite clan (Num 3:20). No further narrative role beyond this census listing.",
      tags: ["priestly line"],
    },
    "Finding 4"
  );

  // Finding 4: new person record for Mushi, son of Merari
  await insertPerson(
    "mushi",
    {
      name: "Mushi",
      gender: "male",
      description: "Son of Merari, grandson of Levi. Head of the Mushite clan (Num 3:20). No further narrative role beyond this census listing.",
      tags: ["priestly line"],
    },
    "Finding 4"
  );

  // Finding 4: relationship — gershon parent_of libni
  await insertRel("gershon", gershonId, "parent_of", "libni", newId("libni"), "Finding 4", "The sons of Gershon: Libni and Shimei (Num 3:18)");
  // Finding 4: relationship — gershon parent_of shimei_gershon
  await insertRel("gershon", gershonId, "parent_of", "shimei_gershon", newId("shimei_gershon"), "Finding 4", "The sons of Gershon: Libni and Shimei (Num 3:18)");
  // Finding 4: relationship — merari parent_of mahli
  await insertRel("merari", merariId, "parent_of", "mahli", newId("mahli"), "Finding 4", "The sons of Merari: Mahli and Mushi (Num 3:20)");
  // Finding 4: relationship — merari parent_of mushi
  await insertRel("merari", merariId, "parent_of", "mushi", newId("mushi"), "Finding 4", "The sons of Merari: Mahli and Mushi (Num 3:20)");

  // Finding 4: scripture refs for the four new person records
  await insertRef("libni", newId("libni"), "Numbers", 3, 18, 3, 18, "Finding 4", "The names of the sons of Gershon: Libni and Shimei");
  await insertRef("shimei_gershon", newId("shimei_gershon"), "Numbers", 3, 18, 3, 18, "Finding 4", "The names of the sons of Gershon: Libni and Shimei");
  await insertRef("mahli", newId("mahli"), "Numbers", 3, 20, 3, 20, "Finding 4", "The sons of Merari: Mahli and Mushi");
  await insertRef("mushi", newId("mushi"), "Numbers", 3, 20, 3, 20, "Finding 4", "The sons of Merari: Mahli and Mushi");

  // ───────────────────────────────────────────────────────────────────────
  // Finding 5: Mahlah is described as "Eldest daughter" and Tirzah as
  // "Youngest daughter" of Zelophehad, but no cited passage (Num 26:33,
  // 27:1, 36:11) uses birth-order language, and 36:11's list order isn't
  // even consistent with 26:33/27:1's. Replace with neutral phrasing
  // matching the pattern used for Hoglah and Milcah.
  // ───────────────────────────────────────────────────────────────────────

  // Finding 5
  await run("Finding 5", `UPDATE people.description for mahlah (id: ${mahlahId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Daughter of Zelophehad. She and her four sisters successfully petitioned Moses and Eleazar for their father's inheritance. God confirmed their case as just. Later commanded to marry within their tribe so the land would not pass to another tribe.",
      mahlahId,
    ],
  });

  // Finding 5
  await run("Finding 5", `UPDATE people.description for tirzah_z (id: ${tirzahId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Daughter of Zelophehad. One of five sisters whose petition changed Israelite inheritance law. Her name was later given to a prominent Canaanite city that became the first capital of the northern kingdom.",
      tirzahId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 6: Izhar's description states he is "Father of Korah, Nepheg,
  // and Zichri" (Exod 6:21), but only Korah has a person record. Add
  // minimal person records for Nepheg and Zichri with parent_of
  // relationships from Izhar, for full consistency with the description.
  // ───────────────────────────────────────────────────────────────────────

  // Finding 6: new person record for Nepheg, son of Izhar
  await insertPerson(
    "nepheg",
    {
      name: "Nepheg",
      gender: "male",
      description: "Son of Izhar, grandson of Kohath, a Levite (Exod 6:21). No further narrative role beyond this genealogical mention.",
      tags: ["priestly line"],
    },
    "Finding 6"
  );

  // Finding 6: new person record for Zichri, son of Izhar
  await insertPerson(
    "zichri",
    {
      name: "Zichri",
      gender: "male",
      description: "Son of Izhar, grandson of Kohath, a Levite (Exod 6:21). No further narrative role beyond this genealogical mention.",
      tags: ["priestly line"],
    },
    "Finding 6"
  );

  // Finding 6: relationship — izhar parent_of nepheg
  await insertRel("izhar", izharId, "parent_of", "nepheg", newId("nepheg"), "Finding 6", "The sons of Izhar: Korah, Nepheg, and Zichri (Exod 6:21)");
  // Finding 6: relationship — izhar parent_of zichri
  await insertRel("izhar", izharId, "parent_of", "zichri", newId("zichri"), "Finding 6", "The sons of Izhar: Korah, Nepheg, and Zichri (Exod 6:21)");

  // Finding 6: scripture refs for the two new person records
  await insertRef("nepheg", newId("nepheg"), "Exodus", 6, 21, 6, 21, "Finding 6", "The sons of Izhar: Korah, Nepheg, and Zichri");
  await insertRef("zichri", newId("zichri"), "Exodus", 6, 21, 6, 21, "Finding 6", "The sons of Izhar: Korah, Nepheg, and Zichri");

  // ───────────────────────────────────────────────────────────────────────
  // Finding 7: Zelophehad's own genealogy — Manasseh → Machir → Gilead →
  // Hepher → Zelophehad — has three of its four named intermediate
  // generations missing as person records entirely (Num 27:1, 26:29-33).
  // Add the three missing person records, wire up the direct parent_of
  // chain, and remove the now-redundant coarse manasseh ancestor_of
  // zelophehad relationship.
  // ───────────────────────────────────────────────────────────────────────

  // Finding 7: new person record for Machir, son of Manasseh
  await insertPerson(
    "machir",
    {
      name: "Machir",
      gender: "male",
      description: "Son of Manasseh, grandson of Joseph. Father of Gilead. Clan head of the Machirites (Num 26:29).",
      tags: ["tribe of israel"],
    },
    "Finding 7"
  );

  // Finding 7: new person record for Gilead, son of Machir
  await insertPerson(
    "gilead",
    {
      name: "Gilead",
      gender: "male",
      description:
        "Son of Machir, grandson of Manasseh. Father of Hepher. Clan head of the Gileadites (Num 26:29); the region of Gilead in Transjordan is named after this clan, not to be confused with Jephthah's unrelated father of the same name in scripts/seed-judges.ts.",
      tags: ["tribe of israel"],
    },
    "Finding 7"
  );

  // Finding 7: new person record for Hepher, son of Gilead
  await insertPerson(
    "hepher",
    {
      name: "Hepher",
      gender: "male",
      description: "Son of Gilead, great-grandson of Manasseh. Father of Zelophehad. Clan head of the Hepherites (Num 26:32-33).",
      tags: ["tribe of israel"],
    },
    "Finding 7"
  );

  // Finding 7: relationship — manasseh parent_of machir
  await insertRel("manasseh", manassehId, "parent_of", "machir", newId("machir"), "Finding 7", "The sons of Manasseh: of Machir, the clan of the Machirites (Num 26:29)");
  // Finding 7: relationship — machir parent_of gilead
  await insertRel("machir", newId("machir"), "parent_of", "gilead", newId("gilead"), "Finding 7", "Machir was the father of Gilead (Num 26:29)");
  // Finding 7: relationship — gilead parent_of hepher
  await insertRel("gilead", newId("gilead"), "parent_of", "hepher", newId("hepher"), "Finding 7", "Of Gilead... and of Hepher, the clan of the Hepherites (Num 26:32-33)");
  // Finding 7: relationship — hepher parent_of zelophehad
  await insertRel("hepher", newId("hepher"), "parent_of", "zelophehad", zelophehadId, "Finding 7", "Zelophehad the son of Hepher (Num 26:33, 27:1)");

  // Finding 7: scripture refs for the three new person records
  await insertRef("machir", newId("machir"), "Numbers", 26, 29, 26, 29, "Finding 7", "The sons of Manasseh: of Machir, the clan of the Machirites");
  await insertRef("gilead", newId("gilead"), "Numbers", 26, 29, 26, 29, "Finding 7", "Machir was the father of Gilead; of Gilead, the clan of the Gileadites");
  await insertRef("hepher", newId("hepher"), "Numbers", 26, 32, 26, 33, "Finding 7", "Of Hepher, the clan of the Hepherites. Now Zelophehad the son of Hepher had no sons, but daughters");

  // Finding 7: delete the now-redundant coarse manasseh ancestor_of
  // zelophehad relationship, superseded by the direct four-link parent_of
  // chain added above
  {
    const relId = await resolveRelationship(manassehId, "ancestor_of", zelophehadId);
    // Finding 7
    await run("Finding 7", `DELETE relationship manasseh ancestor_of zelophehad (id: ${relId})`, {
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
