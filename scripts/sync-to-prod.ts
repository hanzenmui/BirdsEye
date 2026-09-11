// Copies data from this machine's database up to production.
//
// Why this exists rather than re-running the seeders: seed-genesis.ts opens with
// DELETE FROM people / relationships / scripture_refs. It is a rebuild script,
// fine locally as step one of rebuilding from scratch and fatal against
// production, where it would destroy everything including work pushed from the
// other machine. Most seeders also have no dry-run mode, so they cannot be
// previewed. This tool only ever inserts and updates — it has no delete path at
// all.
//
// The two databases were seeded independently and share NO person ids: all 510
// people common to both have different UUIDs in each. So people are matched on
// (name, also_known_as) and every copied reference and relationship has its ids
// remapped to production's. Never assume an id means the same person in both.
//
// Direction is one-way, local -> production. It never reads production as the
// source of truth and never removes anything production has.
//
// Dry run by default. Pass APPLY=1 to write.
import { createClient, type Client } from "@libsql/client";
import { config } from "dotenv";

const prodEnv = config({ path: ".env.prod" }).parsed;
const localEnv = config({ path: ".env.local" }).parsed;
if (!prodEnv || !localEnv) throw new Error("Need both .env.local and .env.prod");
const clean = (s: string) => s.replace(/^"|"$/g, "");

const APPLY = process.env.APPLY === "1";
const LOCAL = createClient({ url: localEnv.TURSO_DATABASE_URL, authToken: localEnv.TURSO_AUTH_TOKEN });
const PROD = createClient({
  url: clean(prodEnv.TURSO_DATABASE_URL),
  authToken: clean(prodEnv.TURSO_DATABASE_TURSO_AUTH_TOKEN),
});

// Name differences between the two databases are NOT assumed to be local
// corrections. Each was checked against the text, and they did not all go the
// same way:
//
//   Shulamite -> Shulammite is a real fix. Song of Solomon 6:13 reads
//   "Shulammite" in both NIV and ESV; production carries the older spelling.
//
//   Matthias was a local MISTAKE, not a fix. Luke 3:25-26 reads "Mattathias" in
//   NIV and ESV, which is what production already had. Matthias is the apostle
//   chosen in Acts 1:26 — a different man. Copying it up would have pushed an
//   error into production. Local has since been corrected to match, so the two
//   entries are no longer excluded here; the note stays as the reason the
//   direction of a name change is never assumed.
//
//   Ocran vs Ochran is neither. NIV reads "Okran", ESV "Ochran", KJV "Ocran" —
//   all legitimate transliterations, so production is left alone rather than
//   churned for a cosmetic difference.
const RENAME_ON_PROD: { from: [string, string]; to: [string, string] }[] = [
  {
    from: ["Shulamite", "the beloved, the Shulamite woman"],
    to: ["Shulammite", "the beloved, the Shulammite woman (also spelled Shulamite)"],
  },
];

// Present locally, deliberately never copied up. See the note above.
const DO_NOT_COPY = new Set([
  "Pagiel||Pagiel son of Ochran",
]);

type Row = Record<string, unknown>;
const personKey = (r: Row) => `${r.name}||${r.also_known_as}`;
const refKey = (r: Row, pk: string) =>
  `${pk}||${r.book}||${r.chapter_start}||${r.verse_start}||${r.chapter_end}||${r.verse_end}`;

const PERSON_COLS = [
  "id", "name", "also_known_as", "gender", "testament", "birth_year", "death_year",
  "description", "tags", "created_at", "timeline_start_bc", "timeline_end_bc",
  "timeline_track", "date_uncertainty_note", "date_confidence",
];

async function rows(db: Client, sql: string): Promise<Row[]> {
  return (await db.execute(sql)).rows as unknown as Row[];
}

async function main() {
  console.log(APPLY ? "APPLYING to production\n" : "DRY RUN — nothing will be written (pass APPLY=1 to write)\n");

  // Renames run first so everything downstream matches on the corrected name.
  for (const r of RENAME_ON_PROD) {
    const hit = await PROD.execute({
      sql: "SELECT id FROM people WHERE name = ? AND also_known_as = ?",
      args: [r.from[0], r.from[1]],
    });
    if (!hit.rows.length) continue;
    console.log(`Rename on production: "${r.from[0]}" -> "${r.to[0]}"`);
    if (APPLY) {
      await PROD.execute({
        sql: "UPDATE people SET name = ?, also_known_as = ? WHERE id = ?",
        args: [r.to[0], r.to[1], (hit.rows[0] as unknown as { id: string }).id],
      });
    }
  }

  const localPeople = await rows(LOCAL, `SELECT ${PERSON_COLS.join(",")} FROM people`);
  const prodPeople = await rows(PROD, `SELECT ${PERSON_COLS.join(",")} FROM people`);
  // A dry run has not actually renamed anything, so apply the renames to the
  // in-memory copy too. Without this the preview reports people as needing to
  // be added that the real run would match and leave alone — a preview that
  // disagrees with the run it is previewing is worse than no preview.
  if (!APPLY) {
    for (const r of RENAME_ON_PROD) {
      const row = prodPeople.find(x => x.name === r.from[0] && x.also_known_as === r.from[1]);
      if (row) { row.name = r.to[0]; row.also_known_as = r.to[1]; }
    }
  }
  const prodByKey = new Map(prodPeople.map(r => [personKey(r), r]));
  const localById = new Map(localPeople.map(r => [r.id as string, r]));

  // ── 1. People present locally but not on production ─────────────────────
  const missingPeople = localPeople.filter(
    r => !prodByKey.has(personKey(r)) && !DO_NOT_COPY.has(personKey(r)),
  );
  const skipped = localPeople.filter(r => DO_NOT_COPY.has(personKey(r)));
  if (skipped.length) {
    console.log(`Deliberately not copied (${skipped.length}): ${skipped.map(r => r.name).join(", ")}`);
  }
  console.log(`People to add: ${missingPeople.length}`);
  for (const p of missingPeople) console.log(`  + ${p.name}${p.also_known_as ? ` (${p.also_known_as})` : ""}`);
  if (APPLY) {
    for (const p of missingPeople) {
      await PROD.execute({
        sql: `INSERT INTO people (${PERSON_COLS.join(",")}) VALUES (${PERSON_COLS.map(() => "?").join(",")})`,
        args: PERSON_COLS.map(c => (p[c] ?? null) as never),
      });
      // So references and relationships copied below can find it.
      prodByKey.set(personKey(p), p);
    }
  }

  // ── 2. Descriptions corrected locally ───────────────────────────────────
  const changed = localPeople.filter(r => {
    if (DO_NOT_COPY.has(personKey(r))) return false;
    const p = prodByKey.get(personKey(r));
    return p && String(p.description ?? "") !== String(r.description ?? "");
  });
  console.log(`\nDescriptions to update: ${changed.length}`);
  for (const p of changed.slice(0, 10)) console.log(`  ~ ${p.name}`);
  if (changed.length > 10) console.log(`  … and ${changed.length - 10} more`);
  if (APPLY) {
    for (const p of changed) {
      const target = prodByKey.get(personKey(p))!;
      await PROD.execute({
        sql: "UPDATE people SET description = ? WHERE id = ?",
        args: [p.description as never, target.id as never],
      });
    }
  }

  // Rebuild the key->prod-id map now that new people exist.
  const prodIdByKey = new Map(
    (APPLY ? await rows(PROD, `SELECT id,name,also_known_as FROM people`) : prodPeople)
      .map(r => [personKey(r), r.id as string]),
  );
  for (const p of missingPeople) if (!prodIdByKey.has(personKey(p))) prodIdByKey.set(personKey(p), p.id as string);

  // ── 3. Scripture references ─────────────────────────────────────────────
  // Rows with an empty person_id belong to events, not people; production seeds
  // its own, so they are not copied.
  const localRefs = (await rows(LOCAL, `SELECT * FROM scripture_refs`)).filter(r => r.person_id);
  const prodRefs = (await rows(PROD, `SELECT * FROM scripture_refs`)).filter(r => r.person_id);
  const prodPeopleById = new Map(
    (await rows(PROD, `SELECT id,name,also_known_as FROM people`)).map(r => [r.id as string, r]),
  );
  const prodRefKeys = new Set(
    prodRefs.map(r => {
      const owner = prodPeopleById.get(r.person_id as string);
      return owner ? refKey(r, personKey(owner)) : "";
    }),
  );
  const missingRefs = localRefs.filter(r => {
    const owner = localById.get(r.person_id as string);
    if (!owner) return false;
    // Excluded people are never created up there, so their references have
    // nothing to attach to. Filtering here keeps the count honest rather than
    // promising rows the apply step would silently skip.
    if (DO_NOT_COPY.has(personKey(owner))) return false;
    return !prodRefKeys.has(refKey(r, personKey(owner)));
  });
  console.log(`\nScripture references to add: ${missingRefs.length}`);
  if (APPLY) {
    for (const r of missingRefs) {
      const owner = localById.get(r.person_id as string)!;
      const targetId = prodIdByKey.get(personKey(owner));
      if (!targetId) { console.log(`  ! skipped, no match for ${owner.name}`); continue; }
      await PROD.execute({
        sql: `INSERT INTO scripture_refs (id,person_id,event_id,book,chapter_start,verse_start,chapter_end,verse_end,note,created_at)
              VALUES (?,?,'',?,?,?,?,?,?,datetime('now'))`,
        args: [crypto.randomUUID(), targetId, r.book, r.chapter_start, r.verse_start,
               r.chapter_end, r.verse_end, r.note ?? ""] as never[],
      });
    }
  }

  // ── 4. Relationships ────────────────────────────────────────────────────
  const localRels = await rows(LOCAL, `SELECT * FROM relationships`);
  const prodRels = await rows(PROD, `SELECT * FROM relationships`);
  const relKeyProd = new Set(
    prodRels.map(r => {
      const a = prodPeopleById.get(r.person_a_id as string);
      const b = prodPeopleById.get(r.person_b_id as string);
      return a && b ? `${personKey(a)}||${r.type}||${personKey(b)}` : "";
    }),
  );
  const missingRels = localRels.filter(r => {
    const a = localById.get(r.person_a_id as string);
    const b = localById.get(r.person_b_id as string);
    if (!a || !b) return false;
    if (DO_NOT_COPY.has(personKey(a)) || DO_NOT_COPY.has(personKey(b))) return false;
    return !relKeyProd.has(`${personKey(a)}||${r.type}||${personKey(b)}`);
  });
  console.log(`Relationships to add: ${missingRels.length}`);
  if (APPLY) {
    for (const r of missingRels) {
      const a = localById.get(r.person_a_id as string)!;
      const b = localById.get(r.person_b_id as string)!;
      const aId = prodIdByKey.get(personKey(a));
      const bId = prodIdByKey.get(personKey(b));
      if (!aId || !bId) { console.log(`  ! skipped ${a.name} -> ${b.name}, missing on production`); continue; }
      await PROD.execute({
        sql: `INSERT OR IGNORE INTO relationships (id,person_a_id,person_a_name,type,person_b_id,person_b_name,notes,created_at)
              VALUES (?,?,?,?,?,?,?,datetime('now'))`,
        args: [crypto.randomUUID(), aId, a.name, r.type, bId, b.name, r.notes ?? ""] as never[],
      });
    }
  }

  console.log(APPLY ? "\nApplied." : "\nNothing written. Re-run with APPLY=1 to write.");
}

main();
