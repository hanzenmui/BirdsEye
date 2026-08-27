# Timeline Data Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the schema, types, API, and fully-sourced dataset that the Kings/Prophets/Exile timeline will render — with zero UI work, so the data can be verified correct before a single pixel is drawn.

**Architecture:** Purely additive. Four new nullable columns on `people`, two new tables (`historical_events`, `prophecy_links`), one new read-only API route, and one idempotent seed script following this repo's existing `scripts/seed-*.ts` conventions. Nothing existing changes behavior. A companion verification script acts as this plan's test suite.

**Tech Stack:** TypeScript, Next.js 16 API routes, @libsql/client (Turso), tsx, dotenv.

## Global Constraints

- **This project has no automated test framework** (no Jest/Vitest in `package.json`). The "tests" in this plan are assertions in `scripts/verify-timeline.ts`, run via `npx tsx`. Do not add a test framework.
- **Schema changes go in `lib/schema.ts`'s `MIGRATIONS` array**, which `lib/db.ts` runs inside a try/catch that logs and skips failures. Migrations must therefore be individually safe to re-run.
- **Never resolve a timeline person by `name` alone.** See the collision table in Task 3 — the DB contains distinct people sharing names (two Ahaziahs, three Zechariahs, a Zimri who is *not* the king). Always match on `(name, also_known_as)`.
- **All BC years are stored as positive integers** (`931` means 931 BC). Larger integer = earlier in time. There are no AD dates in Phase 1.
- **Seed scripts must be idempotent** — safe to run twice with no duplicate rows, per the existing `safeInsertPerson` pattern.
- **Confidence values** are exactly `firm` | `good` | `uncertain`. **Track values** are exactly `judah_king` | `israel_king` | `united_king` | `judge` | `major_prophet` | `minor_prophet`.

---

### Task 1: Schema migration + types

**Files:**
- Modify: `lib/schema.ts`
- Modify: `lib/types.ts`
- Modify: `lib/mappers.ts`
- Create: `scripts/verify-timeline.ts`

**Interfaces:**
- Produces: `TimelineTrack`, `DateConfidence`, `HistoricalEvent`, `ProphecyLink` types; `historicalEventFromDb()`, `prophecyLinkFromDb()` mappers; `Person` gains `timelineStartBc`, `timelineEndBc`, `timelineTrack`, `dateUncertaintyNote`, `dateConfidence`.

- [ ] **Step 1: Write the failing verification script**

Create `scripts/verify-timeline.ts`:

```typescript
// Verification suite for the timeline dataset. This project has no test
// framework; these assertions are the test suite. Run: npx tsx scripts/verify-timeline.ts
import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN ?? process.env.TURSO_DATABASE_TURSO_AUTH_TOKEN,
});

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (ok) { console.log(`  PASS  ${label}`); }
  else { console.log(`  FAIL  ${label}${detail ? " — " + detail : ""}`); failures++; }
}

async function main() {
  console.log("Timeline data verification\n");

  // --- Schema present ---
  const cols = await db.execute("PRAGMA table_info(people)");
  const colNames = cols.rows.map((r: any) => r.name);
  for (const c of ["timeline_start_bc","timeline_end_bc","timeline_track","date_uncertainty_note","date_confidence"]) {
    check(`people.${c} exists`, colNames.includes(c));
  }
  const refCols = await db.execute("PRAGMA table_info(scripture_refs)");
  check("scripture_refs.event_id exists",
    refCols.rows.map((r: any) => r.name).includes("event_id"));

  const tables = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('historical_events','prophecy_links')"
  );
  const tNames = tables.rows.map((r: any) => r.name);
  check("historical_events table exists", tNames.includes("historical_events"));
  check("prophecy_links table exists", tNames.includes("prophecy_links"));

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx tsx scripts/verify-timeline.ts
```

Expected: FAIL on all five `people.*` column checks, the `scripture_refs.event_id` check, and both table checks (8 failures), exit code 1.

- [ ] **Step 3: Add the migrations**

In `lib/schema.ts`, append to the `MIGRATIONS` array (after the existing unique-index entry):

```typescript
  // Timeline feature — additive, nullable. Existing rows keep NULL spans and
  // are simply absent from the timeline view. Each ALTER is idempotent-by-
  // failure: re-running throws "duplicate column name", which lib/db.ts's
  // try/catch around migrations logs and skips.
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
```

- [ ] **Step 4: Add the types**

In `lib/types.ts`, add near the other type exports:

```typescript
export const TIMELINE_TRACKS = [
  "judah_king", "israel_king", "united_king", "judge", "major_prophet", "minor_prophet",
] as const;
export type TimelineTrack = (typeof TIMELINE_TRACKS)[number] | "";

export const DATE_CONFIDENCES = ["firm", "good", "uncertain"] as const;
export type DateConfidence = (typeof DATE_CONFIDENCES)[number];

export interface HistoricalEvent {
  id: string;
  title: string;
  yearBc: number;
  era: string;
  description: string;
  dateUncertaintyNote: string;
  dateConfidence: DateConfidence;
  createdAt: string;
}

export interface ProphecyLink {
  id: string;
  prophetPersonId: string;
  prophecyBook: string;
  prophecyChapterStart: number;
  prophecyVerseStart: number;
  prophecyChapterEnd: number;
  prophecyVerseEnd: number;
  fulfillmentEventId: string;
  explanation: string;
  createdAt: string;
}
```

And extend the existing `Person` interface with five fields:

```typescript
  // Timeline fields — null/empty for people not placed on the timeline.
  timelineStartBc: number | null;   // BC year as positive int; 931 = 931 BC
  timelineEndBc: number | null;
  timelineTrack: TimelineTrack;
  dateUncertaintyNote: string;
  dateConfidence: DateConfidence;
```

- [ ] **Step 5: Add the mappers**

In `lib/mappers.ts`, add to `personFromDb`'s returned object:

```typescript
    timelineStartBc:     r.timeline_start_bc ?? null,
    timelineEndBc:       r.timeline_end_bc ?? null,
    timelineTrack:       r.timeline_track ?? "",
    dateUncertaintyNote: r.date_uncertainty_note ?? "",
    dateConfidence:      r.date_confidence ?? "firm",
```

Also add `eventId: r.event_id ?? null,` to `scriptureRefFromDb`'s returned object, and add `eventId: string | null;` to the `ScriptureRef` interface in `lib/types.ts`.

Leave `personToDb` unchanged — the existing people API does not write timeline fields; only the seed script does. Then add two new mappers:

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function historicalEventFromDb(r: any): HistoricalEvent {
  return {
    id:                  r.id,
    title:               r.title,
    yearBc:              r.year_bc,
    era:                 r.era ?? "",
    description:         r.description ?? "",
    dateUncertaintyNote: r.date_uncertainty_note ?? "",
    dateConfidence:      r.date_confidence ?? "firm",
    createdAt:           r.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function prophecyLinkFromDb(r: any): ProphecyLink {
  return {
    id:                     r.id,
    prophetPersonId:        r.prophet_person_id,
    prophecyBook:           r.prophecy_book,
    prophecyChapterStart:   r.prophecy_chapter_start,
    prophecyVerseStart:     r.prophecy_verse_start,
    prophecyChapterEnd:     r.prophecy_chapter_end,
    prophecyVerseEnd:       r.prophecy_verse_end,
    fulfillmentEventId:     r.fulfillment_event_id,
    explanation:            r.explanation ?? "",
    createdAt:              r.created_at,
  };
}
```

Update the import at the top of `lib/mappers.ts` to include the new types:

```typescript
import type { Person, Relationship, ScriptureRef, RelationshipType, HistoricalEvent, ProphecyLink } from "./types";
```

- [ ] **Step 6: Stop event refs leaking into the person-oriented refs API**

`app/api/refs/route.ts` does a bare `SELECT * FROM scripture_refs`, and
`BooksSection` in `components/Explorer.tsx:589` counts people per book with
`new Set(refs.filter(r => r.book === book).map(r => r.personId)).size`. Once
event-owned rows exist with `person_id = ''`, that empty string lands in the
Set and **inflates every affected book's "N people" count by exactly one**.

Scope this endpoint to person-owned rows only. In `app/api/refs/route.ts`,
change the GET query to:

```typescript
    const rows = await db.query(
      `SELECT * FROM scripture_refs
       WHERE event_id IS NULL OR event_id = ''
       ORDER BY book ASC, chapter_start ASC, verse_start ASC`
    );
```

Leave the POST handler alone — it only ever creates person-owned refs, and
`event_id` defaults to NULL.

- [ ] **Step 7: Apply migrations against the live DB**

The migrations run automatically on first `getDb()` call. Trigger them directly:

```bash
npx tsx -e "import('./lib/db.ts').then(async m => { const db = m.getDb(); await new Promise(r => setTimeout(r, 3000)); process.exit(0); })"
```

If that import path fails under tsx, instead run the dev server once (`npm run dev`), load any page, then stop it — `getDb()` fires on the first API call and runs `init()`.

- [ ] **Step 8: Run verification to confirm it passes**

```bash
npx tsx scripts/verify-timeline.ts
```

Expected: all 8 schema checks PASS, exit code 0.

- [ ] **Step 9: Typecheck and lint**

```bash
npx tsc --noEmit && npx eslint app components hooks lib
```

Expected: no errors. (Pre-existing warnings in `Explorer.tsx`, `FamilyTree.tsx`, `LoginForm.tsx`, `layout.tsx`, `mappers.ts` are expected and unrelated — do not "fix" them here.)

- [ ] **Step 10: Commit**

```bash
git add lib/schema.ts lib/types.ts lib/mappers.ts app/api/refs/route.ts scripts/verify-timeline.ts
git commit -m "feat: add timeline schema, types, and verification harness"
```

---

### Task 2: Timeline read API

**Files:**
- Create: `app/api/timeline/route.ts`
- Modify: `scripts/verify-timeline.ts`

**Interfaces:**
- Consumes: `historicalEventFromDb`, `prophecyLinkFromDb`, `personFromDb` from Task 1.
- Produces: `GET /api/timeline` returning `{ people: Person[]; events: HistoricalEvent[]; prophecyLinks: ProphecyLink[] }`, where `people` contains only rows with a non-null `timeline_start_bc`.

- [ ] **Step 1: Add the failing API assertion**

In `scripts/verify-timeline.ts`, add this function and call it from `main()` after the schema checks:

```typescript
async function checkApiShape() {
  // The route is the only consumer-facing surface; assert the SQL it runs
  // returns the shape the UI plan will depend on.
  const people = await db.execute(
    "SELECT * FROM people WHERE timeline_start_bc IS NOT NULL ORDER BY timeline_start_bc DESC"
  );
  const events = await db.execute("SELECT * FROM historical_events ORDER BY year_bc DESC");
  const links = await db.execute("SELECT * FROM prophecy_links");
  check("timeline people present", people.rows.length > 0, `got ${people.rows.length}`);
  check("historical events present", events.rows.length > 0, `got ${events.rows.length}`);
  check("prophecy links present", links.rows.length > 0, `got ${links.rows.length}`);
}
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx tsx scripts/verify-timeline.ts
```

Expected: the three new checks FAIL (all counts are 0 — no data seeded yet), exit code 1.

- [ ] **Step 3: Create the route**

Create `app/api/timeline/route.ts`, following the exact `apiHandler` + `requireAuth` pattern used by `app/api/people/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth, apiHandler } from "@/lib/auth";
import { personFromDb, historicalEventFromDb, prophecyLinkFromDb } from "@/lib/mappers";

export async function GET() {
  return apiHandler(async () => {
    await requireAuth();
    const db = getDb();
    const [people, events, links] = await Promise.all([
      db.query("SELECT * FROM people WHERE timeline_start_bc IS NOT NULL ORDER BY timeline_start_bc DESC"),
      db.query("SELECT * FROM historical_events ORDER BY year_bc DESC"),
      db.query("SELECT * FROM prophecy_links"),
    ]);
    return NextResponse.json({
      people:        people.map(personFromDb),
      events:        events.map(historicalEventFromDb),
      prophecyLinks: links.map(prophecyLinkFromDb),
    });
  });
}
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors. (The verify script still fails on the three data checks — that is correct; Task 3 seeds the data.)

- [ ] **Step 5: Commit**

```bash
git add app/api/timeline/route.ts scripts/verify-timeline.ts
git commit -m "feat: add GET /api/timeline read route"
```

---

### Task 3: Seed the 16 missing people

**Files:**
- Create: `scripts/seed-timeline.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `resolvePerson(name, aka)` and `safeInsertTimelinePerson(...)` helpers used by Task 4 in the same file.

**Why this task exists:** a live-DB audit found 16 timeline figures absent, and several traps where a name that *looks* present belongs to a different person entirely:

| Name | What's in the DB | Timeline figure needed |
|---|---|---|
| Zimri | `Zimri son of Salu` (Numbers/Peor incident) | Zimri **king of Israel** — ABSENT |
| Nadab | Aaron's son (aka `""`) | Nadab **king of Israel** — ABSENT |
| Jehoahaz | `Jehoahaz king of Judah` | Jehoahaz **king of Israel** — ABSENT |
| Zechariah | 3 rows, none a king | Zechariah **king of Israel** — ABSENT |

Resolving by name alone would silently attach a king's reign dates to a Levite, a priest, or a prophet.

- [ ] **Step 1: Create the script scaffold with helpers**

Create `scripts/seed-timeline.ts`:

```typescript
// Timeline dataset: inserts the timeline figures missing from the DB, then
// stamps timeline_* columns onto every Phase 1 king, judge, and prophet.
// Idempotent — safe to re-run.
import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN ?? process.env.TURSO_DATABASE_TURSO_AUTH_TOKEN,
});

const DRY_RUN = process.argv.includes("--dry-run");

// Resolve an existing person by name + exact also_known_as. Returns null when
// absent. NEVER falls back to name-only matching — see the collision table in
// the plan; name-only would attach reign dates to the wrong person.
async function resolvePerson(name: string, aka: string): Promise<string | null> {
  const r = await db.execute({
    sql: "SELECT id FROM people WHERE name = ? AND also_known_as = ? LIMIT 1",
    args: [name, aka],
  });
  const row = r.rows[0] as unknown as { id: string } | undefined;
  return row ? row.id : null;
}

// Insert a person only if (name, also_known_as) isn't already present.
async function safeInsertTimelinePerson(p: {
  name: string; alsoKnownAs: string; gender: string; description: string; tags: string[];
}): Promise<string> {
  const existing = await resolvePerson(p.name, p.alsoKnownAs);
  if (existing) return existing;
  const id = crypto.randomUUID();
  console.log(`  ${DRY_RUN ? "would insert" : "inserting"}: ${p.name} (${p.alsoKnownAs})`);
  if (!DRY_RUN) {
    await db.execute({
      sql: `INSERT INTO people (id,name,also_known_as,gender,testament,birth_year,death_year,description,tags,created_at)
            VALUES (?,?,?,?,'OT','','',?,?,datetime('now'))`,
      args: [id, p.name, p.alsoKnownAs, p.gender, p.description, JSON.stringify(p.tags)],
    });
  }
  return id;
}
```

- [ ] **Step 2: Add the 16 missing people**

Append to `scripts/seed-timeline.ts`:

```typescript
async function seedMissingPeople() {
  console.log("Inserting missing timeline people...");

  // --- Kings of Israel absent from the DB (11) ---
  await safeInsertTimelinePerson({ name: "Nadab", alsoKnownAs: "Nadab king of Israel",
    gender: "male", tags: ["king"],
    description: "Son of Jeroboam I and second king of the northern kingdom. Reigned two years before Baasha assassinated him while he besieged Gibbethon, wiping out Jeroboam's whole house. Not to be confused with Nadab son of Aaron." });
  await safeInsertTimelinePerson({ name: "Baasha", alsoKnownAs: "Baasha king of Israel",
    gender: "male", tags: ["king"],
    description: "Killed Nadab and seized the throne of Israel, destroying the house of Jeroboam. Reigned 24 years and warred continually with Asa of Judah." });
  await safeInsertTimelinePerson({ name: "Elah", alsoKnownAs: "Elah king of Israel",
    gender: "male", tags: ["king"],
    description: "Son of Baasha. Assassinated by his chariot commander Zimri while drinking himself drunk in Tirzah, ending Baasha's dynasty." });
  await safeInsertTimelinePerson({ name: "Zimri", alsoKnownAs: "Zimri king of Israel",
    gender: "male", tags: ["king"],
    description: "Chariot commander who murdered Elah and reigned just seven days. When the army proclaimed Omri king instead, Zimri burned the palace down over himself. Not to be confused with Zimri son of Salu." });
  await safeInsertTimelinePerson({ name: "Omri", alsoKnownAs: "Omri king of Israel",
    gender: "male", tags: ["king"],
    description: "Army commander made king by his troops. Founded Samaria as Israel's capital and began the Omride dynasty. So significant that Assyrian records called Israel 'the house of Omri' long after his death. Father of Ahab." });
  await safeInsertTimelinePerson({ name: "Jehoahaz", alsoKnownAs: "Jehoahaz king of Israel",
    gender: "male", tags: ["king"],
    description: "Son of Jehu. Reigned during Israel's lowest military ebb under Aramean oppression, left with only fifty horsemen. Not to be confused with Jehoahaz king of Judah." });
  await safeInsertTimelinePerson({ name: "Jehoash", alsoKnownAs: "Jehoash king of Israel",
    gender: "male", tags: ["king"],
    description: "Son of Jehoahaz. Recovered the cities his father lost to Aram, and defeated Amaziah of Judah. Wept at the deathbed of Elisha. Not to be confused with Joash king of Judah." });
  await safeInsertTimelinePerson({ name: "Zechariah", alsoKnownAs: "Zechariah king of Israel",
    gender: "male", tags: ["king"],
    description: "Son of Jeroboam II and the last of Jehu's dynasty. Reigned six months before Shallum assassinated him publicly, fulfilling the promise that Jehu's line would sit on Israel's throne to the fourth generation. Not the prophet." });
  await safeInsertTimelinePerson({ name: "Shallum", alsoKnownAs: "Shallum king of Israel",
    gender: "male", tags: ["king"],
    description: "Assassinated Zechariah and reigned one month before Menahem killed him in turn." });
  await safeInsertTimelinePerson({ name: "Menahem", alsoKnownAs: "Menahem king of Israel",
    gender: "male", tags: ["king"],
    description: "Seized the throne by killing Shallum. Bought off the Assyrian king Tiglath-pileser III with a thousand talents of silver extracted from Israel's wealthy men — the beginning of Israel's vassalage to Assyria." });
  await safeInsertTimelinePerson({ name: "Pekahiah", alsoKnownAs: "Pekahiah king of Israel",
    gender: "male", tags: ["king"],
    description: "Son of Menahem. Reigned two years before his own officer Pekah assassinated him in the citadel of the palace in Samaria." });

  // --- Minor judges absent from the DB (5) ---
  await safeInsertTimelinePerson({ name: "Tola", alsoKnownAs: "Tola son of Puah",
    gender: "male", tags: ["judge"],
    description: "Judge from the tribe of Issachar who led Israel twenty-three years from Shamir in the hill country of Ephraim. One of the 'minor judges' recorded without a narrative of his deeds." });
  await safeInsertTimelinePerson({ name: "Jair", alsoKnownAs: "Jair the Gileadite",
    gender: "male", tags: ["judge"],
    description: "Judge who led Israel twenty-two years. Had thirty sons who rode thirty donkeys and controlled thirty towns in Gilead." });
  await safeInsertTimelinePerson({ name: "Ibzan", alsoKnownAs: "Ibzan of Bethlehem",
    gender: "male", tags: ["judge"],
    description: "Judge for seven years. Had thirty sons and thirty daughters, marrying them all outside his clan." });
  await safeInsertTimelinePerson({ name: "Elon", alsoKnownAs: "Elon the Zebulunite",
    gender: "male", tags: ["judge"],
    description: "Judge from the tribe of Zebulun who led Israel ten years." });
  await safeInsertTimelinePerson({ name: "Abdon", alsoKnownAs: "Abdon son of Hillel",
    gender: "male", tags: ["judge"],
    description: "Judge for eight years. Had forty sons and thirty grandsons who rode seventy donkeys." });
}

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== LIVE RUN ===");
  await seedMissingPeople();
  console.log("Done.");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Add the npm script**

In `package.json`, add after the last `seed:` entry:

```json
    "seed:timeline": "npx tsx scripts/seed-timeline.ts",
    "verify:timeline": "npx tsx scripts/verify-timeline.ts"
```

(Add a comma to the previous line so the JSON stays valid.)

- [ ] **Step 4: Dry-run it**

```bash
npm run seed:timeline -- --dry-run
```

Expected: exactly 16 "would insert" lines. If any figure reports fewer, someone already added them — re-check before proceeding.

- [ ] **Step 5: Run it live, then confirm idempotency**

```bash
npm run seed:timeline
npm run seed:timeline
```

Expected: the first run prints 16 "inserting" lines; the **second run prints none** (all resolve as existing).

- [ ] **Step 6: Commit**

```bash
git add scripts/seed-timeline.ts package.json
git commit -m "feat: seed 16 timeline figures missing from the database"
```

---

### Task 4: Stamp timeline dates onto all Phase 1 people

**Files:**
- Modify: `scripts/seed-timeline.ts`
- Modify: `scripts/verify-timeline.ts`

**Interfaces:**
- Consumes: `resolvePerson` from Task 3.
- Produces: every Phase 1 figure has `timeline_start_bc`, `timeline_end_bc`, `timeline_track`, `date_confidence` populated.

- [ ] **Step 1: Add failing lane-integrity assertions**

In `scripts/verify-timeline.ts`, add this and call it from `main()`:

```typescript
async function checkLaneIntegrity() {
  // Single-row lanes must not have two people whose reigns overlap — that
  // would mean a data error (or a co-regency needing an explicit decision).
  for (const track of ["judah_king", "israel_king", "united_king"]) {
    const r = await db.execute({
      sql: `SELECT a.name AS an, b.name AS bn FROM people a JOIN people b
            ON a.timeline_track = b.timeline_track AND a.id < b.id
            WHERE a.timeline_track = ?
              AND a.timeline_start_bc > b.timeline_end_bc
              AND b.timeline_start_bc > a.timeline_end_bc`,
      args: [track],
    });
    check(`${track}: no overlapping reigns in single-row lane`, r.rows.length === 0,
      r.rows.map((x: any) => `${x.an}/${x.bn}`).join(", "));
  }
  // Every timeline person needs a valid track and a sane span.
  const bad = await db.execute(`
    SELECT name, timeline_track, timeline_start_bc, timeline_end_bc FROM people
    WHERE timeline_start_bc IS NOT NULL
      AND (timeline_track = '' OR timeline_end_bc IS NULL OR timeline_end_bc > timeline_start_bc)`);
  check("every timeline person has a track and start >= end (BC counts down)",
    bad.rows.length === 0, bad.rows.map((x: any) => x.name).join(", "));

  // Uncertain-dated figures must carry an explanatory note — the whole point
  // of the confidence tier is that the UI can be honest about it.
  const noNote = await db.execute(`
    SELECT name FROM people WHERE date_confidence = 'uncertain' AND date_uncertainty_note = ''`);
  check("every uncertain figure has a note", noNote.rows.length === 0,
    noNote.rows.map((x: any) => x.name).join(", "));
}
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npm run verify:timeline
```

Expected: the new checks report 0 timeline people (the `start >= end` check trivially passes on an empty set, but the Task 2 "timeline people present" check still FAILs). Exit code 1.

- [ ] **Step 3: Add the date-stamping function**

Append to `scripts/seed-timeline.ts`. Every entry is `[name, aka, startBc, endBc]`; `aka` must match the DB exactly.

```typescript
type Row = [string, string, number, number];

// Thiele's chronology (The Mysterious Numbers of the Hebrew Kings) — the
// standard reconstruction used by most study Bibles.
const JUDAH_KINGS: Row[] = [
  ["Rehoboam", "", 931, 913],
  ["Abijah", "Abijam king of Judah, Abijah son of Rehoboam", 913, 911],
  ["Asa", "Asa king of Judah, son of Abijam", 911, 870],
  ["Jehoshaphat", "Jehoshaphat king of Judah, son of Asa", 870, 848],
  ["Jehoram", "Jehoram king of Judah, Joram king of Judah", 848, 841],
  ["Ahaziah", "Ahaziah king of Judah", 841, 841],
  ["Athaliah", "", 841, 835],
  ["Joash", "Joash king of Judah", 835, 796],
  ["Amaziah", "Amaziah king of Judah, son of Joash", 796, 767],
  ["Uzziah", "Uzziah king of Judah, Azariah king of Judah", 767, 740],
  ["Jotham", "Jotham king of Judah, son of Uzziah", 740, 732],
  ["Ahaz", "Ahaz king of Judah, son of Jotham", 732, 716],
  ["Hezekiah", "", 716, 687],
  ["Manasseh", "Manasseh king of Judah", 687, 643],
  ["Amon", "Amon king of Judah", 643, 641],
  ["Josiah", "", 641, 609],
  ["Jehoahaz", "Jehoahaz king of Judah, Shallum son of Josiah", 609, 609],
  ["Jehoiakim", "Jehoiakim king of Judah, Eliakim son of Josiah", 609, 598],
  ["Jehoiachin", "Jehoiachin king of Judah, Jeconiah, Coniah", 598, 597],
  ["Zedekiah", "Zedekiah king of Judah, Mattaniah son of Josiah", 597, 586],
];

const ISRAEL_KINGS: Row[] = [
  ["Jeroboam", "Jeroboam son of Nebat", 931, 910],
  ["Nadab", "Nadab king of Israel", 910, 909],
  ["Baasha", "Baasha king of Israel", 909, 886],
  ["Elah", "Elah king of Israel", 886, 885],
  ["Zimri", "Zimri king of Israel", 885, 885],
  ["Omri", "Omri king of Israel", 885, 874],
  ["Ahab", "", 874, 853],
  ["Ahaziah", "Ahaziah king of Israel", 853, 852],
  ["Joram", "Joram king of Israel, Jehoram king of Israel", 852, 841],
  ["Jehu", "Jehu son of Jehoshaphat", 841, 814],
  ["Jehoahaz", "Jehoahaz king of Israel", 814, 798],
  ["Jehoash", "Jehoash king of Israel", 798, 782],
  ["Jeroboam", "Jeroboam II king of Israel", 782, 753],
  ["Zechariah", "Zechariah king of Israel", 753, 752],
  ["Shallum", "Shallum king of Israel", 752, 752],
  ["Menahem", "Menahem king of Israel", 752, 742],
  ["Pekahiah", "Pekahiah king of Israel", 742, 740],
  ["Pekah", "Pekah king of Israel", 740, 732],
  ["Hoshea", "Hoshea king of Israel", 732, 722],
];

const UNITED_KINGS: Row[] = [
  ["Saul", "", 1047, 1010],
  ["David", "", 1010, 970],
  ["Solomon", "Jedidiah", 970, 931],
];

const MAJOR_PROPHETS: Row[] = [
  ["Isaiah", "Isaiah son of Amoz", 740, 680],
  ["Jeremiah", "", 627, 580],
  ["Ezekiel", "", 593, 570],
  ["Daniel", "Belteshazzar", 605, 530],
];

const MINOR_PROPHETS: Row[] = [
  ["Hosea", "Hosea son of Beeri", 760, 710],
  ["Amos", "", 760, 750],
  ["Micah", "Micah of Moresheth", 740, 700],
  ["Zephaniah", "", 630, 627],
  ["Nahum", "Nahum the Elkoshite", 663, 612],
  ["Habakkuk", "", 608, 598],
  ["Haggai", "", 520, 520],
  ["Zechariah", "Zechariah son of Berechiah", 520, 518],
  ["Malachi", "", 450, 430],
  ["Jonah", "Jonah son of Amittai", 780, 750],
  ["Joel", "Joel son of Pethuel", 835, 796],
  ["Obadiah", "Obadiah the prophet", 845, 840],
];

// One reconstruction among several — biblical durations (Judg 3–12) placed
// within the overlapping blocks scholars propose. All marked uncertain.
const JUDGES: Row[] = [
  ["Othniel", "", 1350, 1310],
  ["Ehud", "", 1309, 1229],
  ["Shamgar", "Shamgar son of Anath", 1230, 1220],
  ["Deborah", "Deborah wife of Lappidoth", 1209, 1169],
  ["Gideon", "Jerubbaal", 1191, 1151],
  ["Tola", "Tola son of Puah", 1149, 1126],
  ["Jair", "Jair the Gileadite", 1126, 1104],
  ["Samson", "", 1096, 1076],
  ["Jephthah", "", 1093, 1087],
  ["Ibzan", "Ibzan of Bethlehem", 1087, 1080],
  ["Elon", "Elon the Zebulunite", 1080, 1070],
  ["Abdon", "Abdon son of Hillel", 1070, 1062],
];

const JUDGES_NOTE = "The judges did not rule in a single sequence — several judged concurrently in different regions, and reconstructions differ by up to two centuries. The duration here follows the figure given in Judges; its placement follows one common reconstruction and should be treated as approximate.";

const UNCERTAIN_NOTES: Record<string, string> = {
  "Joel": "The book of Joel is not internally dated. Proposals range from the 9th century BC to the 2nd century BC. Placed here in the early pre-exilic range; a post-exilic date is equally defensible.",
  "Obadiah": "The book of Obadiah is not internally dated. Some place him in the 840s BC, others after Jerusalem's fall in 586 BC. Placed here in the earlier range.",
  "Habakkuk": "Sources split between c. 630 BC (before Babylon rose to power) and c. 608-598 BC (as the invasion loomed). Placed in the later window since the Chaldean threat is his central subject.",
};

async function stampDates(rows: Row[], track: string, confidence: string, noteFor: (name: string) => string) {
  for (const [name, aka, startBc, endBc] of rows) {
    const id = await resolvePerson(name, aka);
    if (!id) {
      console.warn(`  MISSING: ${name} (aka="${aka}") — not found, skipping`);
      continue;
    }
    const note = noteFor(name);
    console.log(`  ${DRY_RUN ? "would stamp" : "stamping"}: ${name} ${startBc}-${endBc} BC [${track}]`);
    if (!DRY_RUN) {
      await db.execute({
        sql: `UPDATE people SET timeline_start_bc = ?, timeline_end_bc = ?, timeline_track = ?,
              date_confidence = ?, date_uncertainty_note = ? WHERE id = ?`,
        args: [startBc, endBc, track, confidence, note, id],
      });
    }
  }
}

async function seedTimelineDates() {
  console.log("Stamping timeline dates...");
  await stampDates(JUDAH_KINGS,  "judah_king",    "firm", () => "");
  await stampDates(ISRAEL_KINGS, "israel_king",   "firm", () => "");
  await stampDates(UNITED_KINGS, "united_king",   "good", () => "");
  await stampDates(MAJOR_PROPHETS, "major_prophet", "good", () => "");
  await stampDates(MINOR_PROPHETS, "minor_prophet", "good",
    (name) => UNCERTAIN_NOTES[name] ?? "");
  await stampDates(JUDGES, "judge", "uncertain", () => JUDGES_NOTE);

  // The three genuinely-disputed prophets are downgraded after the fact so
  // the bulk minor-prophet pass stays simple.
  if (!DRY_RUN) {
    for (const name of Object.keys(UNCERTAIN_NOTES)) {
      await db.execute({
        sql: `UPDATE people SET date_confidence = 'uncertain'
              WHERE name = ? AND timeline_track = 'minor_prophet'`,
        args: [name],
      });
    }
  }
}
```

Then update `main()` to call it:

```typescript
async function main() {
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== LIVE RUN ===");
  await seedMissingPeople();
  await seedTimelineDates();
  console.log("Done.");
  process.exit(0);
}
```

- [ ] **Step 4: Dry-run and check for MISSING warnings**

```bash
npm run seed:timeline -- --dry-run 2>&1 | grep MISSING
```

Expected: **no output.** Any `MISSING:` line means an `aka` string doesn't match the DB — fix the string before running live, or that person silently won't appear on the timeline.

- [ ] **Step 5: Run live and verify**

```bash
npm run seed:timeline && npm run verify:timeline
```

Expected: verify reports 70 timeline people and all lane-integrity checks PASS. The events/prophecy-link checks still FAIL (Task 5 seeds those).

- [ ] **Step 6: Commit**

```bash
git add scripts/seed-timeline.ts scripts/verify-timeline.ts
git commit -m "feat: stamp timeline dates onto Phase 1 kings, judges, and prophets"
```

---

### Task 5: Seed historical events and prophecy links

**Files:**
- Modify: `scripts/seed-timeline.ts`
- Modify: `scripts/verify-timeline.ts`

**Interfaces:**
- Consumes: `resolvePerson` (Task 3), populated `people` rows (Task 4).
- Produces: `historical_events` and `prophecy_links` rows; every link's `fulfillment_event_id` references a real event and `prophet_person_id` a real person.

- [ ] **Step 1: Add failing referential-integrity assertions**

In `scripts/verify-timeline.ts`, add and call from `main()`:

```typescript
async function checkProphecyIntegrity() {
  const orphanEvent = await db.execute(`
    SELECT pl.id FROM prophecy_links pl
    LEFT JOIN historical_events e ON e.id = pl.fulfillment_event_id
    WHERE e.id IS NULL`);
  check("every prophecy link points at a real event", orphanEvent.rows.length === 0,
    `${orphanEvent.rows.length} orphaned`);

  const orphanProphet = await db.execute(`
    SELECT pl.id FROM prophecy_links pl
    LEFT JOIN people p ON p.id = pl.prophet_person_id
    WHERE p.id IS NULL`);
  check("every prophecy link points at a real person", orphanProphet.rows.length === 0,
    `${orphanProphet.rows.length} orphaned`);

  // A prophecy must be spoken before it is fulfilled. Catches transposed dates.
  const backwards = await db.execute(`
    SELECT p.name, e.title FROM prophecy_links pl
    JOIN people p ON p.id = pl.prophet_person_id
    JOIN historical_events e ON e.id = pl.fulfillment_event_id
    WHERE p.timeline_start_bc < e.year_bc`);
  check("no prophecy is fulfilled before its prophet began", backwards.rows.length === 0,
    backwards.rows.map((x: any) => `${x.name}->${x.title}`).join(", "));

  const noExplain = await db.execute(`SELECT id FROM prophecy_links WHERE explanation = ''`);
  check("every prophecy link has a plain-language explanation", noExplain.rows.length === 0);

  // Without a book tag an event can never appear under any book checkbox.
  const untagged = await db.execute(`
    SELECT e.title FROM historical_events e
    LEFT JOIN scripture_refs sr ON sr.event_id = e.id
    WHERE sr.id IS NULL`);
  check("every event is tagged to a book", untagged.rows.length === 0,
    untagged.rows.map((x: any) => x.title).join(", "));

  // An event-owned ref must not also claim a person, and vice versa.
  const bothOwners = await db.execute(`
    SELECT id FROM scripture_refs WHERE event_id IS NOT NULL AND event_id != '' AND person_id != ''`);
  check("no scripture_ref claims both a person and an event", bothOwners.rows.length === 0);

  // Regression guard for the By Book counts: no person-owned ref may have an
  // empty person_id, or Explorer's countByBook Set gets a phantom member.
  const emptyPerson = await db.execute(`
    SELECT id FROM scripture_refs WHERE person_id = '' AND (event_id IS NULL OR event_id = '')`);
  check("no orphaned scripture_ref with neither owner", emptyPerson.rows.length === 0);
}
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npm run verify:timeline
```

Expected: "historical events present" and "prophecy links present" FAIL (0 rows). Exit code 1.

- [ ] **Step 3: Add events and links**

Append to `scripts/seed-timeline.ts`:

```typescript
const EVENTS: { key: string; title: string; yearBc: number; era: string; description: string }[] = [
  { key: "split", title: "The kingdom splits", yearBc: 931, era: "Divided Kingdom",
    description: "After Rehoboam refuses to lighten Solomon's heavy labor demands, ten northern tribes break away under Jeroboam. Israel and Judah are never reunited." },
  { key: "samaria", title: "Fall of Samaria", yearBc: 722, era: "Divided Kingdom",
    description: "Assyria captures Samaria after a siege and deports the northern population, resettling foreign peoples in their place. The northern kingdom of Israel ends permanently." },
  { key: "sennacherib", title: "Sennacherib's siege of Jerusalem fails", yearBc: 701, era: "Divided Kingdom",
    description: "Assyria overruns Judah's fortified cities and surrounds Jerusalem, but the city is delivered and Sennacherib withdraws — an outcome recorded in both Scripture and Assyrian annals, which conspicuously never claim the city was taken." },
  { key: "carchemish", title: "Babylon defeats Egypt at Carchemish", yearBc: 605, era: "Exile",
    description: "Nebuchadnezzar's victory makes Babylon the dominant power and brings Judah under its control. The first group of exiles, including Daniel, is taken to Babylon." },
  { key: "jerusalem", title: "Fall of Jerusalem and the Temple", yearBc: 586, era: "Exile",
    description: "After a long siege, Babylon breaches Jerusalem, burns the Temple, and carries Judah into exile. Zedekiah is blinded and taken in chains." },
  { key: "babylon", title: "Babylon falls to Cyrus", yearBc: 539, era: "Return",
    description: "Persian forces under Cyrus take Babylon in a single night, diverting the Euphrates to enter under the river-gates. Belshazzar is killed and the Babylonian empire ends." },
  { key: "decree", title: "Cyrus decrees the return", yearBc: 538, era: "Return",
    description: "Cyrus issues a decree permitting the exiles to return to Jerusalem and rebuild the Temple, and restores the Temple vessels Nebuchadnezzar had carried off." },
  { key: "temple", title: "The second Temple is completed", yearBc: 516, era: "Return",
    description: "Spurred on by Haggai and Zechariah, the returned exiles finish rebuilding the Temple, roughly seventy years after its destruction." },
  { key: "wall", title: "Nehemiah rebuilds Jerusalem's wall", yearBc: 445, era: "Return",
    description: "Nehemiah leads the rebuilding of Jerusalem's wall in fifty-two days despite sustained opposition, restoring the city's security and identity." },
];

const eventIds: Record<string, string> = {};

async function seedEvents() {
  console.log("Seeding historical events...");
  for (const e of EVENTS) {
    const existing = await db.execute({
      sql: "SELECT id FROM historical_events WHERE title = ? LIMIT 1", args: [e.title],
    });
    const row = existing.rows[0] as unknown as { id: string } | undefined;
    if (row) { eventIds[e.key] = row.id; continue; }
    const id = crypto.randomUUID();
    eventIds[e.key] = id;
    console.log(`  ${DRY_RUN ? "would insert" : "inserting"} event: ${e.title} (${e.yearBc} BC)`);
    if (!DRY_RUN) {
      await db.execute({
        sql: `INSERT INTO historical_events (id,title,year_bc,era,description,date_uncertainty_note,date_confidence,created_at)
              VALUES (?,?,?,?,?,'','firm',datetime('now'))`,
        args: [id, e.title, e.yearBc, e.era, e.description],
      });
    }
  }
}

const LINKS: { prophet: string; aka: string; book: string; cs: number; vs: number; ce: number; ve: number; eventKey: string; explanation: string }[] = [
  { prophet: "Isaiah", aka: "Isaiah son of Amoz", book: "Isaiah", cs: 37, vs: 33, ce: 37, ve: 35, eventKey: "sennacherib",
    explanation: "Isaiah told Hezekiah the Assyrian king would not shoot an arrow into Jerusalem or even reach it. Sennacherib withdrew without taking the city." },
  { prophet: "Isaiah", aka: "Isaiah son of Amoz", book: "Isaiah", cs: 39, vs: 5, ce: 39, ve: 7, eventKey: "jerusalem",
    explanation: "Isaiah warned Hezekiah that everything in his palace would one day be carried off to Babylon, and his own descendants taken. It happened roughly a century later." },
  { prophet: "Isaiah", aka: "Isaiah son of Amoz", book: "Isaiah", cs: 44, vs: 28, ce: 45, ve: 1, eventKey: "decree",
    explanation: "Isaiah named Cyrus as the ruler who would order Jerusalem rebuilt — written long before Cyrus came to power." },
  { prophet: "Jeremiah", aka: "", book: "Jeremiah", cs: 25, vs: 11, ce: 25, ve: 12, eventKey: "jerusalem",
    explanation: "Jeremiah foretold that Judah would serve Babylon and the land would lie desolate. Jerusalem fell in 586 BC." },
  { prophet: "Jeremiah", aka: "", book: "Jeremiah", cs: 29, vs: 10, ce: 29, ve: 10, eventKey: "decree",
    explanation: "Jeremiah promised God would bring the exiles back after seventy years in Babylon. Cyrus's decree in 538 BC began that return." },
  { prophet: "Hosea", aka: "Hosea son of Beeri", book: "Hosea", cs: 13, vs: 16, ce: 13, ve: 16, eventKey: "samaria",
    explanation: "Hosea warned that Samaria would bear its guilt for rebelling against God. Assyria destroyed the city in 722 BC." },
  { prophet: "Micah", aka: "Micah of Moresheth", book: "Micah", cs: 3, vs: 12, ce: 3, ve: 12, eventKey: "jerusalem",
    explanation: "Micah declared Jerusalem would become a heap of rubble. Jeremiah's hearers still remembered this prophecy a century later (Jer 26:18)." },
  { prophet: "Nahum", aka: "Nahum the Elkoshite", book: "Nahum", cs: 3, vs: 18, ce: 3, ve: 19, eventKey: "carchemish",
    explanation: "Nahum announced the end of Assyria's power. Nineveh fell in 612 BC, and Babylon's victory at Carchemish in 605 BC finished Assyria as a force entirely." },
  { prophet: "Daniel", aka: "Belteshazzar", book: "Daniel", cs: 5, vs: 25, ce: 5, ve: 28, eventKey: "babylon",
    explanation: "Reading the writing on the wall, Daniel told Belshazzar his kingdom was finished and given to the Medes and Persians. Babylon fell that same night." },
  { prophet: "Haggai", aka: "", book: "Haggai", cs: 1, vs: 7, ce: 1, ve: 8, eventKey: "temple",
    explanation: "Haggai rebuked the returned exiles for leaving the Temple in ruins while living in paneled houses, and urged them to rebuild. The Temple was finished in 516 BC." },
];

async function seedProphecyLinks() {
  console.log("Seeding prophecy links...");
  for (const l of LINKS) {
    const prophetId = await resolvePerson(l.prophet, l.aka);
    if (!prophetId) { console.warn(`  MISSING prophet: ${l.prophet} (aka="${l.aka}")`); continue; }
    const eventId = eventIds[l.eventKey];
    if (!eventId) { console.warn(`  MISSING event key: ${l.eventKey}`); continue; }
    console.log(`  ${DRY_RUN ? "would link" : "linking"}: ${l.prophet} ${l.book} ${l.cs}:${l.vs} -> ${l.eventKey}`);
    if (!DRY_RUN) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO prophecy_links
              (id,prophet_person_id,prophecy_book,prophecy_chapter_start,prophecy_verse_start,
               prophecy_chapter_end,prophecy_verse_end,fulfillment_event_id,explanation,created_at)
              VALUES (?,?,?,?,?,?,?,?,?,datetime('now'))`,
        args: [crypto.randomUUID(), prophetId, l.book, l.cs, l.vs, l.ce, l.ve, eventId, l.explanation],
      });
    }
  }
}
```

Then add the event book-tags, which is what lets the UI's book checkboxes
filter events and not just people:

```typescript
// Which book narrates each event. Stored in scripture_refs with person_id=''
// and event_id set, so the existing book-tag machinery covers events too.
const EVENT_REFS: { key: string; book: string; cs: number; vs: number; ce: number; ve: number; note: string }[] = [
  { key: "split",       book: "1 Kings",   cs: 12, vs: 1,  ce: 12, ve: 24, note: "The northern tribes reject Rehoboam" },
  { key: "samaria",     book: "2 Kings",   cs: 17, vs: 1,  ce: 17, ve: 23, note: "Assyria captures Samaria and deports Israel" },
  { key: "sennacherib", book: "2 Kings",   cs: 19, vs: 32, ce: 19, ve: 36, note: "Sennacherib withdraws from Jerusalem" },
  { key: "carchemish",  book: "Daniel",    cs: 1,  vs: 1,  ce: 1,  ve: 2,  note: "Nebuchadnezzar besieges Jerusalem; first exiles taken" },
  { key: "jerusalem",   book: "2 Kings",   cs: 25, vs: 1,  ce: 25, ve: 21, note: "Jerusalem falls and the Temple is burned" },
  { key: "babylon",     book: "Daniel",    cs: 5,  vs: 30, ce: 5,  ve: 31, note: "Belshazzar is killed and Babylon falls" },
  { key: "decree",      book: "Ezra",      cs: 1,  vs: 1,  ce: 1,  ve: 4,  note: "Cyrus decrees the return and rebuilding" },
  { key: "temple",      book: "Ezra",      cs: 6,  vs: 14, ce: 6,  ve: 15, note: "The second Temple is completed" },
  { key: "wall",        book: "Nehemiah",  cs: 6,  vs: 15, ce: 6,  ve: 15, note: "The wall is finished in fifty-two days" },
];

async function seedEventRefs() {
  console.log("Tagging events with their narrating book...");
  for (const r of EVENT_REFS) {
    const eventId = eventIds[r.key];
    if (!eventId) { console.warn(`  MISSING event key: ${r.key}`); continue; }
    const existing = await db.execute({
      sql: "SELECT id FROM scripture_refs WHERE event_id = ? AND book = ? AND chapter_start = ? LIMIT 1",
      args: [eventId, r.book, r.cs],
    });
    if (existing.rows.length) continue;
    console.log(`  ${DRY_RUN ? "would tag" : "tagging"}: ${r.key} -> ${r.book} ${r.cs}:${r.vs}`);
    if (!DRY_RUN) {
      await db.execute({
        sql: `INSERT INTO scripture_refs
              (id,person_id,event_id,book,chapter_start,verse_start,chapter_end,verse_end,note,created_at)
              VALUES (?,'',?,?,?,?,?,?,?,datetime('now'))`,
        args: [crypto.randomUUID(), eventId, r.book, r.cs, r.vs, r.ce, r.ve, r.note],
      });
    }
  }
}
```

Update `main()`:

```typescript
async function main() {
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== LIVE RUN ===");
  await seedMissingPeople();
  await seedTimelineDates();
  await seedEvents();
  await seedEventRefs();
  await seedProphecyLinks();
  console.log("Done.");
  process.exit(0);
}
```

- [ ] **Step 4: Dry-run and check for MISSING warnings**

```bash
npm run seed:timeline -- --dry-run 2>&1 | grep MISSING
```

Expected: no output.

- [ ] **Step 5: Run live and verify everything passes**

```bash
npm run seed:timeline && npm run verify:timeline
```

Expected: **ALL CHECKS PASSED**, exit code 0 — 9 events, 10 prophecy links, no orphans, no backwards prophecies.

- [ ] **Step 6: Confirm idempotency**

```bash
npm run seed:timeline && npm run verify:timeline
```

Expected: no new inserts, still ALL CHECKS PASSED.

- [ ] **Step 7: Commit**

```bash
git add scripts/seed-timeline.ts scripts/verify-timeline.ts
git commit -m "feat: seed historical events and prophecy fulfillment links"
```

---

### Task 6: End-to-end API check

**Files:**
- None modified. This task is a verification gate — it proves the route works
  against real seeded data and produces no commit of its own.

**Interfaces:**
- Consumes: `GET /api/timeline` (Task 2), seeded data (Tasks 3-5).

**Note on running the dev server:** it must be backgrounded and then killed.
Running `npm run dev` in the foreground blocks forever and will hang you.

- [ ] **Step 1: Start the dev server in the background**

```bash
npm run dev > /tmp/tl-dev.log 2>&1 &
echo $! > /tmp/tl-dev.pid
for i in $(seq 1 40); do
  PORT=$(grep -oE 'localhost:[0-9]+' /tmp/tl-dev.log | head -1 | cut -d: -f2)
  [ -n "$PORT" ] && break
  sleep 1
done
echo "PORT=$PORT"
```

Expected: a port is printed (Next may pick something other than 3000 if it is
busy). If `PORT` is empty after 40s, `cat /tmp/tl-dev.log` and report BLOCKED.

- [ ] **Step 2: Confirm the route requires auth**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:$PORT/api/timeline"
```

Expected: `401` — the route sits behind `requireAuth`, like every other data route.

- [ ] **Step 3: Confirm the route returns the seeded data when authenticated**

```bash
curl -s -c /tmp/tl-cookie.txt -X POST "http://localhost:$PORT/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"passcode\":\"$(grep ADMIN_PASSCODE .env.local | cut -d= -f2)\"}" > /dev/null
curl -s -b /tmp/tl-cookie.txt "http://localhost:$PORT/api/timeline" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('people',len(d['people']),'events',len(d['events']),'links',len(d['prophecyLinks']))"
```

Expected exactly: `people 70 events 9 links 10`

- [ ] **Step 4: Confirm a sample record carries its timeline fields**

```bash
curl -s -b /tmp/tl-cookie.txt "http://localhost:$PORT/api/timeline" \
  | python3 -c "
import sys,json
d=json.load(sys.stdin)
hz=[p for p in d['people'] if p['name']=='Hezekiah'][0]
print('Hezekiah', hz['timelineStartBc'], hz['timelineEndBc'], hz['timelineTrack'], hz['dateConfidence'])
ju=[p for p in d['people'] if p['timelineTrack']=='judge'][0]
print('a judge:', ju['name'], ju['dateConfidence'], 'note?', bool(ju['dateUncertaintyNote']))
"
```

Expected: `Hezekiah 716 687 judah_king firm`, and the judge line shows
`uncertain` with `note? True`.

- [ ] **Step 5: Stop the dev server and clean up**

```bash
kill "$(cat /tmp/tl-dev.pid)" 2>/dev/null
rm -f /tmp/tl-dev.pid /tmp/tl-cookie.txt /tmp/tl-dev.log
```

- [ ] **Step 6: Report**

No commit — this task changes no files. Report the three observed outputs
(the 401, the counts line, the sample-record line) in your report file.

---

## What this plan deliberately does NOT do

No UI. No `Timeline.tsx`, no nav entry, no rendering. That is Plan 2, written only after this dataset verifies clean — the whole point of splitting is that the facts get checked before any pixels depend on them.
