export const schema = [
  `CREATE TABLE IF NOT EXISTS people (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    also_known_as TEXT NOT NULL DEFAULT '',
    gender        TEXT NOT NULL DEFAULT 'unknown',
    testament     TEXT NOT NULL DEFAULT 'OT',
    birth_year    TEXT NOT NULL DEFAULT '',
    death_year    TEXT NOT NULL DEFAULT '',
    description   TEXT NOT NULL DEFAULT '',
    tags          TEXT NOT NULL DEFAULT '[]',
    created_at    TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS relationships (
    id            TEXT PRIMARY KEY,
    person_a_id   TEXT NOT NULL,
    person_a_name TEXT NOT NULL DEFAULT '',
    type          TEXT NOT NULL,
    person_b_id   TEXT NOT NULL,
    person_b_name TEXT NOT NULL DEFAULT '',
    notes         TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS scripture_refs (
    id            TEXT PRIMARY KEY,
    person_id     TEXT NOT NULL,
    book          TEXT NOT NULL,
    chapter_start INTEGER NOT NULL DEFAULT 1,
    verse_start   INTEGER NOT NULL DEFAULT 1,
    chapter_end   INTEGER NOT NULL DEFAULT 1,
    verse_end     INTEGER NOT NULL DEFAULT 1,
    note          TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL
  )`,
];

export const MIGRATIONS: string[] = [
  // Prevents duplicate relationship rows: INSERT OR IGNORE with a fresh
  // UUID id was never actually idempotent for (person_a_id, type,
  // person_b_id) without this index. Run scripts/dedupe-relationships.ts
  // before this migration is applied to a DB with existing duplicates,
  // or this CREATE UNIQUE INDEX will fail and be skipped (see lib/db.ts's
  // try/catch around migrations).
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_relationships_unique
   ON relationships (person_a_id, type, person_b_id)`,

  // Timeline feature — additive, nullable. Existing rows keep NULL spans and
  // are simply absent from the timeline view. lib/db.ts checks table_info
  // before applying these additions, so startup stays quiet after migration.
  `ALTER TABLE people ADD COLUMN timeline_start_bc INTEGER`,
  `ALTER TABLE people ADD COLUMN timeline_end_bc INTEGER`,
  `ALTER TABLE people ADD COLUMN timeline_track TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE people ADD COLUMN date_uncertainty_note TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE people ADD COLUMN date_confidence TEXT NOT NULL DEFAULT 'firm'`,

  `CREATE TABLE IF NOT EXISTS historical_events (
    id                    TEXT PRIMARY KEY,
    title                 TEXT NOT NULL,
    year_bc               INTEGER NOT NULL,
    era                   TEXT NOT NULL DEFAULT '',
    description           TEXT NOT NULL DEFAULT '',
    date_uncertainty_note TEXT NOT NULL DEFAULT '',
    date_confidence       TEXT NOT NULL DEFAULT 'firm',
    created_at            TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS prophecy_links (
    id                     TEXT PRIMARY KEY,
    prophet_person_id      TEXT NOT NULL,
    prophecy_book          TEXT NOT NULL,
    prophecy_chapter_start INTEGER NOT NULL,
    prophecy_verse_start   INTEGER NOT NULL,
    prophecy_chapter_end   INTEGER NOT NULL,
    prophecy_verse_end     INTEGER NOT NULL,
    fulfillment_event_id   TEXT NOT NULL,
    explanation            TEXT NOT NULL DEFAULT '',
    created_at             TEXT NOT NULL
  )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS idx_prophecy_links_unique
   ON prophecy_links (prophet_person_id, prophecy_book, prophecy_chapter_start, prophecy_verse_start, fulfillment_event_id)`,

  // Lets an event carry a book tag, so the UI's book checkboxes can filter
  // events (not just people) by book. Reuses scripture_refs rather than
  // forking a parallel table the filter would also have to know about.
  // NOTE: scripture_refs.person_id is NOT NULL, so event-owned rows store
  // person_id = '' and set event_id instead. Exactly one of the two is
  // populated on any given row.
  `ALTER TABLE scripture_refs ADD COLUMN event_id TEXT`,

  // Lets a prophecy link record scholarly disagreement (e.g. over authorship
  // or dating) without disturbing `explanation`, which stays the app's
  // primary, single-viewpoint framing. Uses the same table_info check as the
  // timeline columns above.
  `ALTER TABLE prophecy_links ADD COLUMN uncertainty_note TEXT NOT NULL DEFAULT ''`,

  // Traditions (denominations, communions, movements) — see
  // docs/superpowers/specs/2026-09-11-church-history-design.md. A tradition is
  // not a person: it can still exist (end_year NULL, "1054-present"), and its
  // "family tree" is a tree of splits, not of births. CREATE TABLE IF NOT
  // EXISTS is the right form for a brand-new table (unlike the ADD COLUMN
  // lines above), and lib/db.ts's table_info check only applies to those.
  `CREATE TABLE IF NOT EXISTS traditions (
    id                    TEXT PRIMARY KEY,
    name                  TEXT NOT NULL,
    also_known_as         TEXT NOT NULL DEFAULT '',
    kind                  TEXT NOT NULL DEFAULT 'denomination',
    tier                  INTEGER NOT NULL DEFAULT 3,
    start_year            INTEGER NOT NULL,
    end_year              INTEGER,
    region                TEXT NOT NULL DEFAULT '',
    description           TEXT NOT NULL DEFAULT '',
    distinctives          TEXT NOT NULL DEFAULT '',
    adherents             TEXT NOT NULL DEFAULT '',
    date_uncertainty_note TEXT NOT NULL DEFAULT '',
    date_confidence       TEXT NOT NULL DEFAULT 'firm',
    created_at            TEXT NOT NULL
  )`,

  // Structural edges (split_from, merged_into) build the descent tree the
  // family-tree renderer walks; decorative edges (influenced_by,
  // renewal_within) are drawn as overlay lines, not tree structure. event_id
  // ties an edge back to the council/schism/founding event that caused it,
  // where one exists in historical_events. Per Hanzen: a kind='cult'
  // tradition (see the traditions table) must NEVER appear as parent_id or
  // child_id here — enforced by scripts/verify-traditions.ts, not by the
  // schema, since SQLite has no cross-table CHECK.
  `CREATE TABLE IF NOT EXISTS tradition_edges (
    id           TEXT PRIMARY KEY,
    parent_id    TEXT NOT NULL,
    child_id     TEXT NOT NULL,
    type         TEXT NOT NULL DEFAULT 'split_from',
    year         INTEGER NOT NULL,
    event_id     TEXT,
    notes        TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL
  )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS idx_tradition_edges_unique
   ON tradition_edges (parent_id, type, child_id)`,

  // Links a tradition to the people who founded it, led it, opposed it, or
  // reformed it — the join that lets a tradition's card list its founders and
  // a person's own profile say which tradition they founded.
  `CREATE TABLE IF NOT EXISTS tradition_people (
    id            TEXT PRIMARY KEY,
    tradition_id  TEXT NOT NULL,
    person_id     TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'key_figure',
    notes         TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL
  )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS idx_tradition_people_unique
   ON tradition_people (tradition_id, person_id, role)`,
];
