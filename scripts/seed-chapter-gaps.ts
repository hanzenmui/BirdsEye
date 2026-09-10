// Fills the chapters that had nobody tagged to them.
//
// The chapter view in "By Book" derives its chapter list from scripture_refs,
// so a chapter with no references is simply absent — you cannot select it. A
// sweep of the narrative books found six such chapters. Every person and every
// verse span below was checked against the text before being added.
//
// Two of these needed NEW people because a same-named person already existed
// and is a different man. Tagging the existing record would have been a silent
// data error:
//   - Abimelech king of Gerar (Genesis 20) is not Abimelech son of Gideon
//     (Judges 9), who is the Abimelech already in the database.
//   - Uriah the priest (2 Kings 16) is not Uriah the Hittite (2 Samuel 11).
//
// Run with DRY_RUN=1 to preview without writing.
import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });
const DRY_RUN = process.env.DRY_RUN === "1";
const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const NEW_PEOPLE = [
  {
    name: "Abimelech", aka: "Abimelech king of Gerar",
    description: "Philistine king of Gerar who sent for Sarah after Abraham said she was his sister. Warned by God in a dream, he returned her untouched and rebuked Abraham for the deception. Later made a treaty with Abraham at Beersheba.",
    tags: ["king"],
  },
  {
    name: "Adoni-Bezek", aka: "Adoni-Bezek, lord of Bezek",
    description: "Canaanite king defeated by Judah and Simeon at Bezek. His thumbs and big toes were cut off — the same treatment he had given seventy kings — which he acknowledged as repayment. He was brought to Jerusalem, where he died.",
    tags: ["king", "antagonist"],
  },
  {
    name: "Rezin", aka: "Rezin king of Aram",
    description: "Last king of Aram. Allied with Pekah of Israel to attack Ahaz of Judah, besieging Jerusalem without taking it, and recovered Elath for Aram. Tiglath-Pileser of Assyria captured Damascus and put him to death.",
    tags: ["king", "antagonist"],
  },
  {
    name: "Tiglath-Pileser", aka: "Tiglath-Pileser III, Pul, king of Assyria",
    description: "King of Assyria whom Ahaz paid with temple silver and gold to break the alliance of Aram and Israel. He captured Damascus, deported its people and killed Rezin. Called Pul in 2 Kings 15:19.",
    tags: ["king"],
  },
  {
    name: "Uriah", aka: "Uriah the priest, under Ahaz",
    description: "Priest in Jerusalem during the reign of Ahaz. Built a copy of an altar Ahaz had seen in Damascus, working from the king's sketch and plans, and carried out his orders for the temple. Not the same man as Uriah the Hittite.",
    tags: ["priest"],
  },
];

// Each entry names the person by BOTH name and aka. Resolution is exact and
// throws when it is not a single unmistakable match — "Joshua" alone matches
// both the son of Nun and a name in Luke's genealogy.
const REFS: { name: string; aka: string; book: string; cs: number; vs: number; ce: number; ve: number; note: string }[] = [
  // Genesis 20 — Abraham, Sarah and Abimelech at Gerar
  { name: "Abraham", aka: "Abram", book: "Genesis", cs: 20, vs: 1, ce: 20, ve: 18, note: "Said Sarah was his sister while living as a foreigner in Gerar." },
  { name: "Sarah", aka: "Sarai", book: "Genesis", cs: 20, vs: 1, ce: 20, ve: 18, note: "Taken into Abimelech's household at Gerar and returned untouched." },
  { name: "Abimelech", aka: "Abimelech king of Gerar", book: "Genesis", cs: 20, vs: 1, ce: 20, ve: 18, note: "Warned by God in a dream to return Abraham's wife." },
  { name: "Abimelech", aka: "Abimelech king of Gerar", book: "Genesis", cs: 21, vs: 22, ce: 21, ve: 34, note: "Made a treaty with Abraham at Beersheba." },

  // Exodus 16 — manna and quail in the Desert of Sin
  { name: "Moses", aka: "", book: "Exodus", cs: 16, vs: 1, ce: 16, ve: 36, note: "Told the grumbling community the Lord would rain down bread from heaven." },
  { name: "Aaron", aka: "", book: "Exodus", cs: 16, vs: 1, ce: 16, ve: 36, note: "Grumbled against with Moses; stored a jar of manna before the Testimony." },

  // Judges 1 — the campaign after Joshua's death
  { name: "Adoni-Bezek", aka: "Adoni-Bezek, lord of Bezek", book: "Judges", cs: 1, vs: 4, ce: 1, ve: 7, note: "Defeated at Bezek by Judah and Simeon." },
  { name: "Caleb", aka: "", book: "Judges", cs: 1, vs: 11, ce: 1, ve: 15, note: "Offered his daughter Achsah to whoever captured Kiriath Sepher." },
  { name: "Othniel", aka: "", book: "Judges", cs: 1, vs: 11, ce: 1, ve: 15, note: "Captured Kiriath Sepher and married Achsah." },
  { name: "Achsah", aka: "", book: "Judges", cs: 1, vs: 11, ce: 1, ve: 15, note: "Asked her father Caleb for springs of water along with her land in the Negev." },

  // Judges 2 — Joshua's death and the start of the cycle
  { name: "Joshua", aka: "Hoshea", book: "Judges", cs: 2, vs: 6, ce: 2, ve: 9, note: "Died at a hundred and ten and was buried at Timnath Heres." },

  // 2 Samuel 1 — David hears of Saul's death
  { name: "David", aka: "", book: "2 Samuel", cs: 1, vs: 1, ce: 1, ve: 27, note: "Heard of Saul's death at Ziklag and sang his lament for Saul and Jonathan." },
  { name: "Saul", aka: "", book: "2 Samuel", cs: 1, vs: 1, ce: 1, ve: 12, note: "His death on Mount Gilboa reported to David." },
  { name: "Jonathan", aka: "", book: "2 Samuel", cs: 1, vs: 17, ce: 1, ve: 27, note: "Mourned in David's lament: 'your love to me was wonderful.'" },

  // 2 Kings 16 — Ahaz, the Syro-Ephraimite war and the Damascus altar
  { name: "Ahaz", aka: "Ahaz king of Judah, son of Jotham", book: "2 Kings", cs: 16, vs: 1, ce: 16, ve: 20, note: "Bought Assyrian help with temple silver and replaced the bronze altar." },
  { name: "Pekah", aka: "Pekah king of Israel", book: "2 Kings", cs: 16, vs: 1, ce: 16, ve: 9, note: "Marched with Rezin against Jerusalem but could not overpower Ahaz." },
  { name: "Rezin", aka: "Rezin king of Aram", book: "2 Kings", cs: 16, vs: 5, ce: 16, ve: 9, note: "Besieged Jerusalem with Pekah; killed when Assyria took Damascus." },
  { name: "Tiglath-Pileser", aka: "Tiglath-Pileser III, Pul, king of Assyria", book: "2 Kings", cs: 16, vs: 7, ce: 16, ve: 10, note: "Answered Ahaz's appeal by attacking Damascus." },
  { name: "Uriah", aka: "Uriah the priest, under Ahaz", book: "2 Kings", cs: 16, vs: 10, ce: 16, ve: 16, note: "Built the Damascus-pattern altar to the king's plans." },
];

async function resolvePerson(name: string, aka: string): Promise<string> {
  const r = await db.execute({
    sql: "SELECT id FROM people WHERE name = ? AND also_known_as = ?",
    args: [name, aka],
  });
  if (r.rows.length === 1) return (r.rows[0] as unknown as { id: string }).id;
  throw new Error(
    `Refusing to guess: "${name}" (aka "${aka}") matched ${r.rows.length} rows. ` +
    `Tagging the wrong person is worse than failing loudly.`,
  );
}

async function main() {
  console.log(DRY_RUN ? "DRY RUN — nothing will be written\n" : "");

  console.log("People...");
  for (const p of NEW_PEOPLE) {
    const existing = await db.execute({
      sql: "SELECT id FROM people WHERE name = ? AND also_known_as = ?",
      args: [p.name, p.aka],
    });
    if (existing.rows.length) { console.log(`  exists: ${p.name} (${p.aka})`); continue; }
    console.log(`  ${DRY_RUN ? "would add" : "adding"}: ${p.name} (${p.aka})`);
    if (!DRY_RUN) {
      await db.execute({
        sql: `INSERT INTO people (id,name,also_known_as,gender,testament,birth_year,death_year,description,tags,created_at)
              VALUES (?,?,?,'male','OT','','',?,?,datetime('now'))`,
        args: [crypto.randomUUID(), p.name, p.aka, p.description, JSON.stringify(p.tags)],
      });
    }
  }

  console.log("\nScripture references...");
  let added = 0;
  for (const r of REFS) {
    let personId: string;
    try {
      personId = await resolvePerson(r.name, r.aka);
    } catch (e) {
      if (DRY_RUN && NEW_PEOPLE.some(p => p.name === r.name && p.aka === r.aka)) {
        console.log(`  (dry run) would tag ${r.name} -> ${r.book} ${r.cs}:${r.vs} once the person exists`);
        continue;
      }
      throw e;
    }
    const existing = await db.execute({
      sql: `SELECT id FROM scripture_refs WHERE person_id = ? AND book = ? AND chapter_start = ? AND verse_start = ?`,
      args: [personId, r.book, r.cs, r.vs],
    });
    if (existing.rows.length) { console.log(`  exists: ${r.name} -> ${r.book} ${r.cs}:${r.vs}`); continue; }
    console.log(`  ${DRY_RUN ? "would tag" : "tagging"}: ${r.name} -> ${r.book} ${r.cs}:${r.vs}-${r.ve}`);
    if (!DRY_RUN) {
      await db.execute({
        sql: `INSERT INTO scripture_refs
              (id,person_id,event_id,book,chapter_start,verse_start,chapter_end,verse_end,note,created_at)
              VALUES (?,?,'',?,?,?,?,?,?,datetime('now'))`,
        args: [crypto.randomUUID(), personId, r.book, r.cs, r.vs, r.ce, r.ve, r.note],
      });
      added++;
    }
  }
  console.log(`\nDone.${DRY_RUN ? "" : ` ${added} reference(s) added.`}`);
}

main();
