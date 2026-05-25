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

export const MIGRATIONS: string[] = [];
