import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import { resolve } from "path";
import * as fs from "fs";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const SPARQL = "https://query.wikidata.org/sparql";
const HEADERS = { "User-Agent": "Birdseye-BibleExplorer/1.0 (educational)", "Accept": "application/sparql-results+json" };

// ── Wikidata fetch ────────────────────────────────────────────────────────────

interface WDRow {
  person: { value: string };
  personLabel: { value: string };
  genderLabel?: { value: string };
  fatherLabel?: { value: string };
  motherLabel?: { value: string };
  spouseLabel?: { value: string };
  childLabel?: { value: string };
}

interface PersonData {
  qid: string;
  name: string;
  gender: string;
  fathers: Set<string>;
  mothers: Set<string>;
  spouses: Set<string>;
  children: Set<string>;
}

async function fetchPage(offset: number): Promise<WDRow[]> {
  const query = `
SELECT DISTINCT ?person ?personLabel ?genderLabel ?fatherLabel ?motherLabel ?spouseLabel ?childLabel WHERE {
  ?person wdt:P31 wd:Q20643955 .
  OPTIONAL { ?person wdt:P21 ?gender . }
  OPTIONAL { ?person wdt:P22 ?father . }
  OPTIONAL { ?person wdt:P25 ?mother . }
  OPTIONAL { ?person wdt:P26 ?spouse . }
  OPTIONAL { ?person wdt:P40 ?child . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
ORDER BY ?personLabel
LIMIT 1000 OFFSET ${offset}`;

  const url = `${SPARQL}?query=${encodeURIComponent(query)}&format=json`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json() as { results: { bindings: WDRow[] } };
  return json.results.bindings;
}

async function fetchAllWikidata(): Promise<PersonData[]> {
  const people = new Map<string, PersonData>();
  let offset = 0;
  let total = 0;

  while (true) {
    process.stdout.write(`  Fetching offset ${offset}...`);
    const rows = await fetchPage(offset);
    process.stdout.write(` ${rows.length} rows\n`);
    total += rows.length;

    for (const row of rows) {
      const qid = row.person.value.split("/").pop()!;
      const name = row.personLabel.value;
      if (/^Q\d+$/.test(name)) continue; // skip unlabelled items

      if (!people.has(qid)) {
        people.set(qid, {
          qid, name,
          gender: row.genderLabel?.value ?? "unknown",
          fathers: new Set(), mothers: new Set(),
          spouses: new Set(), children: new Set(),
        });
      }
      const p = people.get(qid)!;
      if (row.fatherLabel?.value && !/^Q\d+$/.test(row.fatherLabel.value)) p.fathers.add(row.fatherLabel.value);
      if (row.motherLabel?.value && !/^Q\d+$/.test(row.motherLabel.value)) p.mothers.add(row.motherLabel.value);
      if (row.spouseLabel?.value && !/^Q\d+$/.test(row.spouseLabel.value)) p.spouses.add(row.spouseLabel.value);
      if (row.childLabel?.value  && !/^Q\d+$/.test(row.childLabel.value))  p.children.add(row.childLabel.value);
    }

    if (rows.length < 1000) break;
    offset += 1000;
    await new Promise(r => setTimeout(r, 1000)); // be polite to Wikidata
  }

  console.log(`  Total rows fetched: ${total}, unique people: ${people.size}\n`);
  return [...people.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// ── Genesis cross-reference ───────────────────────────────────────────────────

const GENESIS_NAMES = [
  "Adam","Eve","Cain","Abel","Seth","Enosh","Enoch","Methuselah","Lamech",
  "Noah","Shem","Ham","Japheth","Nimrod","Terah","Abraham","Sarah","Lot",
  "Hagar","Ishmael","Melchizedek","Eliezer","Isaac","Rebekah","Bethuel",
  "Laban","Esau","Jacob","Leah","Rachel","Bilhah","Zilpah",
  "Reuben","Simeon","Levi","Judah","Dan","Naphtali","Gad","Asher",
  "Issachar","Zebulun","Dinah","Joseph","Benjamin","Tamar","Potiphar",
  "Asenath","Manasseh","Ephraim","Perez","Er","Onan",
];

interface DbRel {
  person_a_name: string;
  type: string;
  person_b_name: string;
}

function normalise(s: string) { return s.toLowerCase().trim(); }

async function crossRef(wiki: Map<string, PersonData>) {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN ?? process.env.TURSO_DATABASE_TURSO_AUTH_TOKEN,
  });

  const relRows = await db.execute(
    "SELECT person_a_name, type, person_b_name FROM relationships"
  );
  const dbRels = relRows.rows as unknown as DbRel[];

  // index: name → rels where they appear
  const relsByName = new Map<string, DbRel[]>();
  for (const r of dbRels) {
    const a = normalise(r.person_a_name), b = normalise(r.person_b_name);
    if (!relsByName.has(a)) relsByName.set(a, []);
    if (!relsByName.has(b)) relsByName.set(b, []);
    relsByName.get(a)!.push(r);
    relsByName.get(b)!.push(r);
  }

  const genesisSet = new Set(GENESIS_NAMES.map(normalise));
  let issueCount = 0;
  const report: string[] = [];

  for (const name of GENESIS_NAMES) {
    const key = normalise(name);
    const wikiEntry = wiki.get(key);
    if (!wikiEntry) {
      report.push(`⚠  ${name}: not found in Wikidata (may use different name)`);
      continue;
    }

    const rels = relsByName.get(key) ?? [];
    const ourParents  = rels.filter(r => r.type === "parent_of" && normalise(r.person_b_name) === key).map(r => normalise(r.person_a_name));
    const ourChildren = rels.filter(r => r.type === "parent_of" && normalise(r.person_a_name) === key).map(r => normalise(r.person_b_name));
    const ourSpouses  = rels.filter(r => r.type === "spouse_of").map(r =>
      normalise(r.person_a_name) === key ? normalise(r.person_b_name) : normalise(r.person_a_name)
    );

    const wikiParents  = [...wikiEntry.fathers, ...wikiEntry.mothers].map(normalise);
    const wikiChildren = [...wikiEntry.children].map(normalise).filter(n => genesisSet.has(n));
    const wikiSpouses  = [...wikiEntry.spouses].map(normalise).filter(n => genesisSet.has(n));

    const issues: string[] = [];

    // Parents: check for mismatches when Wikidata has data
    if (wikiParents.length > 0) {
      for (const wp of wikiParents) {
        if (genesisSet.has(wp) && !ourParents.includes(wp))
          issues.push(`  ✗ MISSING parent in our DB: "${wp}"`);
      }
      for (const op of ourParents) {
        if (!wikiParents.includes(op))
          issues.push(`  ✗ Our DB says parent is "${op}" but Wikidata has: [${wikiParents.join(", ")}]`);
      }
    }

    // Children scoped to Genesis people
    for (const wc of wikiChildren) {
      if (!ourChildren.includes(wc))
        issues.push(`  ✗ MISSING child in our DB: "${wc}"`);
    }
    for (const oc of ourChildren) {
      if (wikiChildren.length > 0 && !wikiChildren.includes(oc) && wikiEntry.children.size > 0)
        issues.push(`  ✗ Our DB says child is "${oc}" but not in Wikidata children: [${wikiChildren.join(", ")}]`);
    }

    // Spouses scoped to Genesis people
    for (const ws of wikiSpouses) {
      if (!ourSpouses.includes(ws))
        issues.push(`  ✗ MISSING spouse in our DB: "${ws}"`);
    }

    if (issues.length > 0) {
      issueCount++;
      report.push(`\n${name}:`);
      report.push(...issues);
    }
  }

  return { report, issueCount };
}

// ── Book grouping heuristics ──────────────────────────────────────────────────

// Rough name-based grouping for non-Genesis figures. We'll lean on parent/child
// connections to known Genesis people as an indicator of Exodus vs later books.
function guessBook(p: PersonData, genesisSet: Set<string>): string {
  const name = p.name;
  // Rough heuristics by name
  if (["Moses","Aaron","Miriam","Jochebed","Amram","Zipporah","Gershom","Eliezer of Moses",
       "Pharaoh","Ramesses","Hobab","Jethro","Hur","Bezalel","Joshua","Caleb"].includes(name))
    return "Exodus";
  if (["Balaam","Korah","Dathan","Abiram","Phinehas","Zelophehad"].includes(name))
    return "Numbers";
  if (["Rahab","Achan","Acsah"].includes(name))
    return "Joshua";
  if (["Gideon","Samson","Deborah","Barak","Jephthah","Othniel","Ehud","Ruth","Naomi","Boaz","Orpah","Elimelech","Mahlon","Chilion"].includes(name))
    return "Judges / Ruth";
  if (["Samuel","Eli","Hannah","Saul","Jonathan","David","Goliath","Abner","Joab","Michal","Bathsheba","Nathan","Abigail"].includes(name))
    return "Samuel / Kings";
  if (["Solomon","Rehoboam","Jeroboam","Elijah","Elisha","Ahab","Jezebel","Jehoshaphat","Hezekiah","Isaiah","Jeremiah"].includes(name))
    return "Kings / Prophets";
  if (["Ezra","Nehemiah","Zerubbabel","Esther","Mordecai","Haman"].includes(name))
    return "Post-exile";
  // If a parent is a Genesis person, likely Exodus / early books
  for (const f of [...p.fathers, ...p.mothers]) {
    if (genesisSet.has(f.toLowerCase())) return "Exodus (child of Genesis figure)";
  }
  return "Other OT";
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Fetching Hebrew Bible people from Wikidata...\n");
  const allPeople = await fetchAllWikidata();

  // Build lookup by lower-case name (take first match)
  const wikiByName = new Map<string, PersonData>();
  for (const p of allPeople) {
    const key = normalise(p.name);
    if (!wikiByName.has(key)) wikiByName.set(key, p);
  }

  // ── 1. Genesis cross-reference ──────────────────────────────────────────
  console.log("=== GENESIS CROSS-REFERENCE ===\n");
  const { report, issueCount } = await crossRef(wikiByName);
  if (issueCount === 0) {
    console.log("✓ All Genesis relationships match Wikidata!\n");
  } else {
    console.log(report.join("\n"));
    console.log(`\n→ ${issueCount} people have relationship discrepancies.\n`);
  }

  // ── 2. Non-Genesis people by book ───────────────────────────────────────
  console.log("\n=== NON-GENESIS PEOPLE BY BOOK ===\n");
  const genesisSet = new Set(GENESIS_NAMES.map(normalise));
  const nonGenesis = allPeople.filter(p => !genesisSet.has(normalise(p.name)));

  const byBook = new Map<string, PersonData[]>();
  for (const p of nonGenesis) {
    const book = guessBook(p, genesisSet);
    if (!byBook.has(book)) byBook.set(book, []);
    byBook.get(book)!.push(p);
  }

  for (const [book, people] of [...byBook.entries()].sort()) {
    console.log(`\n── ${book} (${people.length} people) ──`);
    for (const p of people.slice(0, 20)) {
      const rel: string[] = [];
      if (p.fathers.size)   rel.push(`father: ${[...p.fathers].join(", ")}`);
      if (p.mothers.size)   rel.push(`mother: ${[...p.mothers].join(", ")}`);
      if (p.spouses.size)   rel.push(`spouse: ${[...p.spouses].join(", ")}`);
      if (p.children.size)  rel.push(`children: ${[...p.children].slice(0,3).join(", ")}${p.children.size > 3 ? "…" : ""}`);
      console.log(`  ${p.name} (${p.gender})${rel.length ? " — " + rel.join(" | ") : ""}`);
    }
    if (people.length > 20) console.log(`  ... +${people.length - 20} more`);
  }

  // ── 3. Save full dataset ─────────────────────────────────────────────────
  const outPath = resolve(__dirname, "wikidata-people.json");
  fs.writeFileSync(outPath, JSON.stringify({
    fetchedAt: new Date().toISOString(),
    totalPeople: allPeople.length,
    people: allPeople.map(p => ({
      qid: p.qid, name: p.name, gender: p.gender,
      fathers:  [...p.fathers],
      mothers:  [...p.mothers],
      spouses:  [...p.spouses],
      children: [...p.children],
    })),
  }, null, 2));
  console.log(`\n✓ Full dataset saved to scripts/wikidata-people.json (${allPeople.length} people)`);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
