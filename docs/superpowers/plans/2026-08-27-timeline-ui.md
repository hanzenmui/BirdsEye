# Timeline UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the interactive Timeline view on top of the already-seeded and verified dataset — proportional lanes for judges, kings, prophets, events and books, a grouped multi-select book filter, and the click-a-prophet-to-see-what-it-fulfilled interaction.

**Architecture:** Layout math lives in a pure, dependency-free module (`lib/timeline-layout.ts`) that a runnable assertion script tests without a browser. The React layer is split across three focused components rather than one large file — deliberately, because `components/FamilyTree.tsx` grew to 1331 lines and became hard to work in. Data arrives through one hook mirroring the existing `usePeople`/`useRefs` pattern.

**Tech Stack:** TypeScript, React 19, Next.js 16 (App Router, client components), plain CSS in `app/globals.css`. No charting library — the mockup proved hand-rolled absolute positioning is enough.

## Global Constraints

- **No test framework** (no Jest/Vitest in `package.json`). Do NOT add one. Pure layout functions are tested by `scripts/verify-timeline-layout.ts`, run with `npx tsx`. React components are verified in a browser.
- **BC years are positive integers and count DOWN**: 931 is earlier than 586. A span always satisfies `startBc >= endBc`. There are no AD dates in this phase.
- **Reuse the app's real palette** from `app/globals.css` (`--bg`, `--bg2`, `--bg3`, `--text`, `--text2`, `--text3`, `--border`, `--accent` `#2E7167`, `--gold` `#CF6B4F`, `--font` Fraunces, `--ui-font` Red Hat Text). Do NOT introduce a new theme.
- **Never break the mobile touch guard.** `components/FamilyTree.tsx` had a bug where raw non-passive touch listeners on the pan container swallowed every tap on overlay UI. The fix was an `isOverlayTouch` check plus `touch-action: manipulation` on overlay classes. The Timeline has the same architecture and MUST carry the same guard from the start — see Task 6.
- **Segment labels must never render clipped mid-word.** Measure the rendered label; if it doesn't fit its segment, hide it and rely on the hover tooltip. This was explicitly validated with the user.
- **Nothing in this plan writes to the database.** The Timeline is read-only. No seed scripts, no migrations, no mutations.

---

### Task 1: Pure layout module

**Files:**
- Create: `lib/timeline-layout.ts`
- Create: `scripts/verify-timeline-layout.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `TimelineRange`, `Span`, `yearToPct()`, `spanToBox()`, `spansOverlap()`, `packRows()`, `computeRange()` — every later task consumes these.

- [ ] **Step 1: Write the failing assertion script**

Create `scripts/verify-timeline-layout.ts`:

```typescript
// Assertion suite for the pure timeline layout math. This project has no test
// framework; this script is the test suite. Run: npx tsx scripts/verify-timeline-layout.ts
import {
  yearToPct, spanToBox, spansOverlap, packRows, computeRange,
  type TimelineRange, type Span,
} from "../lib/timeline-layout";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (ok) console.log(`  PASS  ${label}`);
  else { console.log(`  FAIL  ${label}${detail ? " — " + detail : ""}`); failures++; }
}
function near(a: number, b: number, tol = 0.001) { return Math.abs(a - b) < tol; }

const RANGE: TimelineRange = { startBc: 1000, endBc: 500 }; // 500-year span

console.log("Timeline layout verification\n");

// yearToPct: BC counts down, so the range start is the LEFT edge (0%).
check("yearToPct maps range start to 0%", near(yearToPct(1000, RANGE), 0));
check("yearToPct maps range end to 100%", near(yearToPct(500, RANGE), 100));
check("yearToPct maps midpoint to 50%", near(yearToPct(750, RANGE), 50));
check("yearToPct is monotonic left-to-right", yearToPct(900, RANGE) < yearToPct(600, RANGE));

// spanToBox
const box = spanToBox({ id: "a", startBc: 900, endBc: 800 }, RANGE);
check("spanToBox left edge uses startBc", near(box.leftPct, 20));
check("spanToBox width covers the span", near(box.widthPct, 20));
const zero = spanToBox({ id: "z", startBc: 700, endBc: 700 }, RANGE);
check("zero-length span still gets a visible minimum width", zero.widthPct > 0);

// spansOverlap — BC semantics: [startBc..endBc] with startBc >= endBc
check("overlapping spans detected",
  spansOverlap({ id: "a", startBc: 900, endBc: 800 }, { id: "b", startBc: 850, endBc: 750 }));
check("disjoint spans not flagged",
  !spansOverlap({ id: "a", startBc: 900, endBc: 800 }, { id: "b", startBc: 790, endBc: 700 }));
check("spans sharing only a boundary year do NOT overlap (accession-year convention)",
  !spansOverlap({ id: "a", startBc: 931, endBc: 913 }, { id: "b", startBc: 913, endBc: 911 }));
check("a span fully inside another overlaps",
  spansOverlap({ id: "a", startBc: 900, endBc: 700 }, { id: "b", startBc: 850, endBc: 800 }));

// packRows
const sequential: Span[] = [
  { id: "1", startBc: 931, endBc: 913 },
  { id: "2", startBc: 913, endBc: 911 },
  { id: "3", startBc: 911, endBc: 870 },
];
check("non-overlapping spans pack into a single row", packRows(sequential).length === 1);

const overlapping: Span[] = [
  { id: "a", startBc: 1350, endBc: 1310 },
  { id: "b", startBc: 1340, endBc: 1300 }, // overlaps a
  { id: "c", startBc: 1290, endBc: 1200 }, // clear of both
];
const packed = packRows(overlapping);
check("overlapping spans get separate rows", packed.length === 2);
check("a later non-overlapping span reuses the first row",
  packed[0].some(s => s.id === "c"), "expected c back on row 0");
check("every input span appears exactly once",
  packed.flat().length === 3 && new Set(packed.flat().map(s => s.id)).size === 3);
check("empty input yields no rows", packRows([]).length === 0);

// computeRange
const r = computeRange(
  [{ id: "p", startBc: 900, endBc: 800 }, { id: "q", startBc: 700, endBc: 600 }],
  [750],
  10,
);
check("computeRange starts at the earliest year plus padding", r.startBc === 910);
check("computeRange ends at the latest year minus padding", r.endBc === 590);
check("computeRange includes bare point years",
  computeRange([], [800, 600], 0).startBc === 800);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx tsx scripts/verify-timeline-layout.ts
```

Expected: FAIL — the module does not exist yet, so this errors on the import. That is the RED state.

- [ ] **Step 3: Write the layout module**

Create `lib/timeline-layout.ts`:

```typescript
// Pure layout math for the Timeline view. No React, no DOM — so it can be
// verified by scripts/verify-timeline-layout.ts without a browser.
//
// Convention throughout: BC years are positive integers that count DOWN.
// 931 is EARLIER than 586. Every span satisfies startBc >= endBc, and the
// timeline runs left (earliest / largest number) to right (latest / smallest).

export interface TimelineRange {
  startBc: number; // left edge — the largest (earliest) year
  endBc: number;   // right edge — the smallest (latest) year
}

export interface Span {
  id: string;
  startBc: number;
  endBc: number;
}

/** Horizontal position of a year, as a percentage across the range. */
export function yearToPct(year: number, range: TimelineRange): number {
  const total = range.startBc - range.endBc;
  if (total <= 0) return 0;
  return ((range.startBc - year) / total) * 100;
}

/**
 * Left offset and width of a span, in percent. A zero-length span (a king who
 * reigned months, e.g. Zimri's seven days) would otherwise be invisible, so
 * width is floored at MIN_WIDTH_PCT.
 */
const MIN_WIDTH_PCT = 0.35;
export function spanToBox(span: Span, range: TimelineRange): { leftPct: number; widthPct: number } {
  const leftPct = yearToPct(span.startBc, range);
  const rawWidth = yearToPct(span.endBc, range) - leftPct;
  return { leftPct, widthPct: Math.max(rawWidth, MIN_WIDTH_PCT) };
}

/**
 * Do two spans share any time? Spans that merely touch at a boundary year do
 * NOT overlap — Judah's kings are recorded by accession year, so Rehoboam
 * (931-913) and Abijah (913-911) share 913 without co-reigning, and flagging
 * that would push all 20 kings onto separate rows.
 */
export function spansOverlap(a: Span, b: Span): boolean {
  return a.startBc > b.endBc && b.startBc > a.endBc;
}

/**
 * Greedy row packing: place each span in the first row where it collides with
 * nothing already there. Used by every lane whose members legitimately overlap
 * — the judges (several judged concurrently in different regions), the
 * prophets, and the books. Single-occupancy lanes like Judah's kings pack into
 * one row naturally and need no special case.
 */
export function packRows<T extends Span>(items: T[]): T[][] {
  const sorted = [...items].sort((x, y) => y.startBc - x.startBc); // earliest first
  const rows: T[][] = [];
  for (const item of sorted) {
    let placed = false;
    for (const row of rows) {
      if (!row.some(existing => spansOverlap(existing, item))) {
        row.push(item);
        placed = true;
        break;
      }
    }
    if (!placed) rows.push([item]);
  }
  return rows;
}

/**
 * The visible range, derived from the data rather than hardcoded, so adding
 * people or events later widens the view automatically.
 */
export function computeRange(spans: Span[], pointYears: number[], padYears = 20): TimelineRange {
  const years: number[] = [];
  for (const s of spans) years.push(s.startBc, s.endBc);
  for (const y of pointYears) years.push(y);
  if (years.length === 0) return { startBc: 1000, endBc: 500 };
  return {
    startBc: Math.max(...years) + padYears,
    endBc: Math.min(...years) - padYears,
  };
}
```

- [ ] **Step 4: Run the assertions to verify they pass**

```bash
npx tsx scripts/verify-timeline-layout.ts
```

Expected: ALL CHECKS PASSED, exit 0.

- [ ] **Step 5: Add the npm script**

In `package.json`, alongside `verify:timeline`, add:

```json
    "verify:layout": "npx tsx scripts/verify-timeline-layout.ts"
```

- [ ] **Step 6: Typecheck, lint, commit**

```bash
npx tsc --noEmit && npx eslint lib scripts
git add lib/timeline-layout.ts scripts/verify-timeline-layout.ts package.json
git commit -m "feat: add pure timeline layout module with assertion suite"
```

Expected lint: no new errors (one pre-existing error in `scripts/seed-luke-lineage.ts` is out of scope — do not fix it).

---

### Task 2: Timeline data hook

**Files:**
- Create: `hooks/useTimeline.ts`

**Interfaces:**
- Consumes: `GET /api/timeline`, which returns `{ people: Person[]; events: HistoricalEvent[]; prophecyLinks: ProphecyLink[]; eventRefs: ScriptureRef[] }`.
- Produces: `useTimeline()` returning `{ people, events, prophecyLinks, eventRefs, loading, reload }`.

- [ ] **Step 1: Write the hook**

Create `hooks/useTimeline.ts`, following the exact shape of the existing `hooks/usePeople.ts` — including its top-level fetch function (which exists so `react-hooks/set-state-in-effect` does not fire) and its generation-counter guard against stale responses:

```typescript
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import type { Person, HistoricalEvent, ProphecyLink, ScriptureRef } from "@/lib/types";

interface TimelineData {
  people: Person[];
  events: HistoricalEvent[];
  prophecyLinks: ProphecyLink[];
  eventRefs: ScriptureRef[];
}

const EMPTY: TimelineData = { people: [], events: [], prophecyLinks: [], eventRefs: [] };

async function fetchTimeline(
  gen: number,
  genRef: { current: number },
  setData: (d: TimelineData) => void,
  setLoading: (l: boolean) => void,
) {
  try {
    const res = await fetch("/api/timeline");
    if (!res.ok) {
      if (res.status === 401) { window.location.href = "/login"; return; }
      console.error("Failed to load timeline:", res.status);
      if (gen === genRef.current) setLoading(false);
      return;
    }
    const json = await res.json();
    if (gen === genRef.current) { setData(json); setLoading(false); }
  } catch (e) {
    console.error("Failed to load timeline:", e);
    if (gen === genRef.current) setLoading(false);
  }
}

export function useTimeline() {
  const [data, setData] = useState<TimelineData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const genRef = useRef(0);

  const load = useCallback(() => {
    const gen = ++genRef.current;
    fetchTimeline(gen, genRef, setData, setLoading);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { ...data, loading, reload: load };
}
```

- [ ] **Step 2: Verify it typechecks and lints clean**

```bash
npx tsc --noEmit && npx eslint hooks
```

Expected: no errors. In particular `react-hooks/set-state-in-effect` must NOT fire — if it does, the fetch logic is inside the hook body instead of the top-level function.

- [ ] **Step 3: Commit**

```bash
git add hooks/useTimeline.ts
git commit -m "feat: add useTimeline data hook"
```

---

### Task 3: Filter panel

**Files:**
- Create: `components/TimelineFilters.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `BIBLE_BOOKS`, `BOOK_COVERAGE` from `@/lib/types`.
- Produces: `<TimelineFilters checkedBooks showBooksLayer showPeopleLayer onToggleBook onToggleAll onToggleBooksLayer onTogglePeopleLayer />`, where `checkedBooks: Set<string>`.

**Design note:** the user asked for two independent things — book checkboxes that filter, AND a Books layer that shows books as bars. Both live in this panel: two layer switches at the top, then the grouped checklist below.

- [ ] **Step 1: Write the component**

Create `components/TimelineFilters.tsx`:

```typescript
"use client";
import { BIBLE_BOOKS, BOOK_COVERAGE } from "@/lib/types";

// Only books with a coverage span can appear on this timeline. Grouping
// mirrors how a reader thinks about them, not canonical order.
const GROUPS: { label: string; books: string[] }[] = [
  { label: "Kings & History", books: ["Judges","Ruth","1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther"] },
  { label: "Wisdom & Poetry", books: ["Psalms","Proverbs","Ecclesiastes","Song of Solomon","Lamentations"] },
  { label: "Major Prophets",  books: ["Isaiah","Jeremiah","Ezekiel","Daniel"] },
  { label: "Minor Prophets",  books: ["Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi"] },
];

export const TIMELINE_BOOKS: string[] = GROUPS.flatMap(g => g.books);

interface Props {
  checkedBooks: Set<string>;
  showBooksLayer: boolean;
  showPeopleLayer: boolean;
  onToggleBook: (book: string) => void;
  onToggleAll: (checked: boolean) => void;
  onToggleBooksLayer: () => void;
  onTogglePeopleLayer: () => void;
}

export function TimelineFilters({
  checkedBooks, showBooksLayer, showPeopleLayer,
  onToggleBook, onToggleAll, onToggleBooksLayer, onTogglePeopleLayer,
}: Props) {
  const allChecked = TIMELINE_BOOKS.every(b => checkedBooks.has(b));

  return (
    <div className="tl-filters">
      <div className="tl-filters-section">
        <div className="tl-filters-heading">Show</div>
        <label className="tl-switch">
          <input type="checkbox" checked={showPeopleLayer} onChange={onTogglePeopleLayer} />
          <span>People</span>
          <span className="tl-switch-hint">kings, prophets, judges</span>
        </label>
        <label className="tl-switch">
          <input type="checkbox" checked={showBooksLayer} onChange={onToggleBooksLayer} />
          <span>Books</span>
          <span className="tl-switch-hint">the era each book covers</span>
        </label>
      </div>

      <div className="tl-filters-section">
        <div className="tl-filters-heading-row">
          <div className="tl-filters-heading">Books</div>
          <button className="tl-filters-all" onClick={() => onToggleAll(!allChecked)}>
            {allChecked ? "Clear all" : "Select all"}
          </button>
        </div>
        {GROUPS.map(group => (
          <div key={group.label} className="tl-filter-group">
            <div className="tl-filter-group-label">{group.label}</div>
            {group.books.map(book => {
              const cov = BOOK_COVERAGE[book];
              const meta = BIBLE_BOOKS.find(b => b.name === book);
              return (
                <label key={book} className="tl-check" title={meta?.summary ?? ""}>
                  <input
                    type="checkbox"
                    checked={checkedBooks.has(book)}
                    onChange={() => onToggleBook(book)}
                  />
                  <span className="tl-check-name">{book}</span>
                  {cov && (
                    <span className="tl-check-years">
                      {cov.startBc === cov.endBc ? `${cov.startBc}` : `${cov.startBc}–${cov.endBc}`}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the styles**

Append to `app/globals.css`, after the Family Tree block:

```css
/* ── Timeline: filter panel ─────────────────────────────────────────────── */
.tl-filters { width: 232px; flex-shrink: 0; border-right: 1px solid var(--border); background: var(--bg2); overflow-y: auto; padding: 14px 0 24px; }
.tl-filters-section { padding: 0 14px 14px; border-bottom: 1px solid var(--border); margin-bottom: 14px; }
.tl-filters-section:last-child { border-bottom: none; margin-bottom: 0; }
.tl-filters-heading { font-family: var(--font); font-size: 13px; font-weight: 700; color: var(--text2); margin-bottom: 8px; }
.tl-filters-heading-row { display: flex; align-items: baseline; justify-content: space-between; }
.tl-filters-all { border: none; background: transparent; color: var(--accent); font-family: var(--ui-font); font-size: 11px; font-weight: 600; cursor: pointer; padding: 0; }
.tl-filters-all:hover { text-decoration: underline; }
.tl-switch { display: flex; align-items: center; gap: 7px; padding: 4px 0; cursor: pointer; font-size: 13px; color: var(--text); }
.tl-switch-hint { margin-left: auto; font-size: 10px; color: var(--text3); }
.tl-filter-group { margin-bottom: 10px; }
.tl-filter-group-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--text3); margin: 8px 0 3px; }
.tl-check { display: flex; align-items: center; gap: 7px; padding: 3px 4px; border-radius: 5px; cursor: pointer; font-size: 12.5px; color: var(--text); }
.tl-check:hover { background: var(--bg3); }
.tl-check-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tl-check-years { margin-left: auto; font-size: 10px; color: var(--text3); font-family: var(--mono); flex-shrink: 0; }
```

- [ ] **Step 3: Typecheck, lint, commit**

```bash
npx tsc --noEmit && npx eslint components
git add components/TimelineFilters.tsx app/globals.css
git commit -m "feat: add timeline filter panel with grouped book checklist"
```

---

### Task 4: The lanes

**Files:**
- Create: `components/Timeline.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `useTimeline()` (Task 2), `TimelineFilters`/`TIMELINE_BOOKS` (Task 3), and `yearToPct`/`spanToBox`/`packRows`/`computeRange` (Task 1).
- Produces: `<Timeline onSelectPerson={(id: string) => void} />`.

This task renders the lanes statically — no click interaction, no pan/zoom yet. Those are Tasks 5 and 6.

- [ ] **Step 1: Write the component**

Create `components/Timeline.tsx`:

```typescript
"use client";
import { useMemo, useState, useEffect, useRef } from "react";
import { useTimeline } from "@/hooks/useTimeline";
import { BOOK_COVERAGE } from "@/lib/types";
import type { Person, HistoricalEvent } from "@/lib/types";
import { spanToBox, packRows, computeRange, yearToPct, type Span, type TimelineRange } from "@/lib/timeline-layout";
import { TimelineFilters, TIMELINE_BOOKS } from "./TimelineFilters";

// Lane colours drawn from the app's palette: terracotta family for Judah,
// teal/plum for Israel, muted purple for prophets, warm sand for judges.
const TRACK_COLORS: Record<string, string[]> = {
  judah_king:    ["#CF6B4F", "#B5532F", "#E08A5E", "#A9663F"],
  israel_king:   ["#2E7167", "#1F5450", "#4E8B80", "#3D6E64"],
  united_king:   ["#8A6A4F", "#A07C5C", "#75593F"],
  judge:         ["#9A8259", "#B09468", "#87724D"],
  major_prophet: ["#8B5A6B", "#A06B7D"],
  minor_prophet: ["#6B5A8B", "#7E6BA0"],
};

const LANES: { track: string; label: string; multiRow: boolean }[] = [
  { track: "judge",         label: "Judges",          multiRow: true  },
  { track: "united_king",   label: "United Kingdom",  multiRow: false },
  { track: "judah_king",    label: "Judah",           multiRow: false },
  { track: "israel_king",   label: "Israel",          multiRow: false },
  { track: "major_prophet", label: "Major Prophets",  multiRow: true  },
  { track: "minor_prophet", label: "Minor Prophets",  multiRow: true  },
];

const ROW_H = 26;
const ROW_GAP = 3;

interface Props { onSelectPerson: (id: string) => void }

export function Timeline({ onSelectPerson }: Props) {
  const { people, events, eventRefs, loading } = useTimeline();
  const [checkedBooks, setCheckedBooks] = useState<Set<string>>(() => new Set(TIMELINE_BOOKS));
  const [showBooksLayer, setShowBooksLayer] = useState(false);
  const [showPeopleLayer, setShowPeopleLayer] = useState(true);

  // Which people survive the book filter. A person is kept when any of their
  // scripture refs is tagged to a checked book. People are matched through
  // eventRefs' sibling data — person refs come from the people payload's own
  // book tags, so we derive the set from the refs the API already returned.
  const allChecked = checkedBooks.size === TIMELINE_BOOKS.length;

  const range: TimelineRange = useMemo(() => {
    const spans: Span[] = people
      .filter(p => p.timelineStartBc !== null && p.timelineEndBc !== null)
      .map(p => ({ id: p.id, startBc: p.timelineStartBc as number, endBc: p.timelineEndBc as number }));
    const bookSpans: Span[] = Object.entries(BOOK_COVERAGE)
      .map(([name, c]) => ({ id: name, startBc: c.startBc, endBc: c.endBc }));
    return computeRange([...spans, ...bookSpans], events.map(e => e.yearBc), 25);
  }, [people, events]);

  if (loading) {
    return <div className="loading-wrap"><div className="spinner" /></div>;
  }
  if (people.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🕰️</div>
        <div className="empty-state-title">No timeline data</div>
        <div className="empty-state-sub">Run <code>npm run seed:timeline</code> to populate it.</div>
      </div>
    );
  }

  const toggleBook = (book: string) => setCheckedBooks(prev => {
    const next = new Set(prev);
    if (next.has(book)) next.delete(book); else next.add(book);
    return next;
  });
  const toggleAll = (checked: boolean) =>
    setCheckedBooks(checked ? new Set(TIMELINE_BOOKS) : new Set());

  // Century gridlines give the eye something to measure against.
  const ticks: number[] = [];
  for (let y = Math.floor(range.startBc / 100) * 100; y > range.endBc; y -= 100) {
    if (y <= range.startBc) ticks.push(y);
  }

  return (
    <div className="tl-root">
      <TimelineFilters
        checkedBooks={checkedBooks}
        showBooksLayer={showBooksLayer}
        showPeopleLayer={showPeopleLayer}
        onToggleBook={toggleBook}
        onToggleAll={toggleAll}
        onToggleBooksLayer={() => setShowBooksLayer(v => !v)}
        onTogglePeopleLayer={() => setShowPeopleLayer(v => !v)}
      />

      <div className="tl-canvas">
        <div className="tl-scale">
          {ticks.map(t => (
            <div key={t} className="tl-tick" style={{ left: `${yearToPct(t, range)}%` }}>
              <span className="tl-tick-label">{t} BC</span>
            </div>
          ))}
        </div>

        <div className="tl-lanes">
          {showPeopleLayer && LANES.map(lane => (
            <PersonLane
              key={lane.track}
              label={lane.label}
              track={lane.track}
              people={people}
              range={range}
              checkedBooks={checkedBooks}
              allChecked={allChecked}
              onSelect={onSelectPerson}
            />
          ))}

          {events.length > 0 && (
            <EventLane events={events} range={range} eventRefs={eventRefs}
              checkedBooks={checkedBooks} allChecked={allChecked} />
          )}

          {showBooksLayer && (
            <BookLane range={range} checkedBooks={checkedBooks} />
          )}
        </div>
      </div>
    </div>
  );
}

function laneRows(people: Person[], track: string, multiRow: boolean) {
  const spans = people
    .filter(p => p.timelineTrack === track && p.timelineStartBc !== null && p.timelineEndBc !== null)
    .map(p => ({ id: p.id, startBc: p.timelineStartBc as number, endBc: p.timelineEndBc as number, person: p }));
  return multiRow ? packRows(spans) : [spans];
}

interface PersonLaneProps {
  label: string; track: string; people: Person[]; range: TimelineRange;
  checkedBooks: Set<string>; allChecked: boolean; onSelect: (id: string) => void;
}

function PersonLane({ label, track, people, range, checkedBooks, allChecked, onSelect }: PersonLaneProps) {
  const rows = useMemo(
    () => laneRows(people, track, LANES.find(l => l.track === track)?.multiRow ?? false),
    [people, track],
  );
  if (rows.length === 0 || rows[0].length === 0) return null;
  const palette = TRACK_COLORS[track] ?? ["#6b7280"];

  return (
    <div className="tl-lane">
      <div className="tl-lane-label">{label}</div>
      <div className="tl-lane-body" style={{ height: rows.length * (ROW_H + ROW_GAP) }}>
        {rows.map((row, ri) =>
          row.map((s, si) => {
            const { leftPct, widthPct } = spanToBox(s, range);
            // The book filter dims rather than removes, so a person's place in
            // the sequence stays legible even when filtered out.
            const dimmed = !allChecked && !personMatchesBooks(s.person, checkedBooks);
            return (
              <button
                key={s.id}
                className={`tl-seg${dimmed ? " tl-seg-dim" : ""}${s.person.dateConfidence === "uncertain" ? " tl-seg-uncertain" : ""}`}
                style={{
                  left: `${leftPct}%`, width: `${widthPct}%`,
                  top: ri * (ROW_H + ROW_GAP), height: ROW_H,
                  background: palette[si % palette.length],
                }}
                title={segTitle(s.person)}
                onClick={() => onSelect(s.person.id)}
              >
                <span className="tl-seg-label">{s.person.name}</span>
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}

function segTitle(p: Person) {
  const years = `${p.timelineStartBc}–${p.timelineEndBc} BC`;
  const conf = p.dateConfidence === "uncertain" ? " · dates uncertain" : "";
  return `${p.name} (${years})${conf}`;
}

// A person passes the filter when any book they're tagged to is checked.
// Book tags live in scripture_refs, which the timeline payload does not carry
// per-person; Task 5 threads them through. Until then every person matches,
// which keeps this task's deliverable independently viewable.
function personMatchesBooks(_p: Person, _checked: Set<string>): boolean {
  return true;
}

interface EventLaneProps {
  events: HistoricalEvent[]; range: TimelineRange;
  eventRefs: { eventId: string | null; book: string }[];
  checkedBooks: Set<string>; allChecked: boolean;
}

function EventLane({ events, range, eventRefs, checkedBooks, allChecked }: EventLaneProps) {
  const laneRef = useRef<HTMLDivElement>(null);

  // Event labels are centred under their marker, so two events close in time
  // collide even when their years differ — the fall of Samaria (722 BC) and
  // Sennacherib's failed siege (701 BC) are only 21 years apart and their text
  // overlaps at default zoom. Collision is a PIXEL problem, not a year problem
  // (it depends on label width and zoom), so it can only be resolved after
  // layout: measure each marker, then greedily push colliding ones onto a
  // lower row. No dependency array — widths change with zoom and filtering.
  useEffect(() => {
    const lane = laneRef.current;
    if (!lane) return;
    const markers = Array.from(lane.querySelectorAll<HTMLElement>(".tl-event"));
    markers.forEach(m => { m.style.top = "0px"; });
    const laneLeft = lane.getBoundingClientRect().left;
    const placed = markers
      .map(el => {
        const r = el.getBoundingClientRect();
        return { el, left: r.left - laneLeft, right: r.right - laneLeft };
      })
      .sort((a, b) => a.left - b.left);

    const ROW_H = 46, GAP = 6;
    const rows: [number, number][][] = [];
    for (const p of placed) {
      let row = 0;
      for (;;) {
        const occupied = rows[row] ?? (rows[row] = []);
        const collides = occupied.some(([l, r]) => p.left < r + GAP && p.right > l - GAP);
        if (!collides) { occupied.push([p.left, p.right]); break; }
        row++;
      }
      p.el.style.top = `${row * ROW_H}px`;
    }
    lane.style.height = `${Math.max(rows.length, 1) * ROW_H}px`;
  });

  return (
    <div className="tl-lane">
      <div className="tl-lane-label">Events</div>
      <div ref={laneRef} className="tl-lane-body tl-events">
        {events.map(ev => {
          const books = eventRefs.filter(r => r.eventId === ev.id).map(r => r.book);
          const dimmed = !allChecked && !books.some(b => checkedBooks.has(b));
          return (
            <div
              key={ev.id}
              className={`tl-event${dimmed ? " tl-seg-dim" : ""}`}
              style={{ left: `${yearToPct(ev.yearBc, range)}%` }}
              title={`${ev.title} (${ev.yearBc} BC)`}
            >
              <span className="tl-event-dot">◆</span>
              <span className="tl-event-label">{ev.title}<br />{ev.yearBc} BC</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BookLane({ range, checkedBooks }: { range: TimelineRange; checkedBooks: Set<string> }) {
  const rows = useMemo(() => {
    const spans = Object.entries(BOOK_COVERAGE)
      .filter(([name]) => checkedBooks.has(name))
      .map(([name, c]) => ({ id: name, startBc: c.startBc, endBc: c.endBc }));
    return packRows(spans);
  }, [checkedBooks]);

  if (rows.length === 0) return null;

  return (
    <div className="tl-lane">
      <div className="tl-lane-label">Books</div>
      <div className="tl-lane-body" style={{ height: rows.length * (ROW_H + ROW_GAP) }}>
        {rows.map((row, ri) =>
          row.map(s => {
            const { leftPct, widthPct } = spanToBox(s, range);
            const note = BOOK_COVERAGE[s.id]?.note;
            return (
              <div
                key={s.id}
                className="tl-seg tl-seg-book"
                style={{ left: `${leftPct}%`, width: `${widthPct}%`, top: ri * (ROW_H + ROW_GAP), height: ROW_H }}
                title={`${s.id} — covers ${s.startBc}–${s.endBc} BC${note ? "\n\n" + note : ""}`}
              >
                <span className="tl-seg-label">{s.id}</span>
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the lane styles**

Append to `app/globals.css`:

```css
/* ── Timeline: lanes ────────────────────────────────────────────────────── */
.tl-root { display: flex; flex: 1; min-height: 0; overflow: hidden; }
.tl-canvas { flex: 1; min-width: 0; overflow: auto; padding: 14px 24px 32px; position: relative; }
.tl-scale { position: relative; height: 20px; margin-left: 96px; }
.tl-tick { position: absolute; top: 0; bottom: 0; border-left: 1px dashed var(--border2); }
.tl-tick-label { position: absolute; top: 0; left: 4px; font-size: 10px; color: var(--text3); font-family: var(--mono); white-space: nowrap; }
.tl-lanes { margin-left: 96px; position: relative; }
.tl-lane { position: relative; margin-bottom: 12px; }
.tl-lane-label { position: absolute; left: -96px; top: 0; width: 88px; text-align: right; font-family: var(--font); font-size: 11px; font-weight: 700; color: var(--text2); line-height: 26px; }
.tl-lane-body { position: relative; background: var(--bg3); border-radius: 5px; min-height: 26px; }
.tl-seg { position: absolute; box-sizing: border-box; border: none; border-right: 2px solid var(--bg); border-radius: 3px; overflow: hidden; display: flex; align-items: center; padding-left: 6px; cursor: pointer; font-family: var(--ui-font); text-align: left; }
.tl-seg-label { font-size: 11px; font-weight: 600; color: #fff; text-shadow: 0 1px 1px rgba(0,0,0,.28); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tl-seg-dim { opacity: .22; }
/* Uncertain dates get soft edges — a judge whose span swings 200 years between
   reconstructions must not look as crisp as Hezekiah's reign. */
.tl-seg-uncertain { border-radius: 13px; opacity: .82; }
.tl-seg-book { background: var(--bg4); cursor: default; }
.tl-seg-book .tl-seg-label { color: var(--text2); text-shadow: none; }
.tl-events { background: transparent; min-height: 46px; }
.tl-event { position: absolute; top: 0; transform: translateX(-50%); text-align: center; white-space: nowrap; }
.tl-event-dot { color: var(--gold-deep); font-size: 13px; display: block; line-height: 1; }
.tl-event-label { font-size: 9.5px; color: var(--text3); line-height: 1.3; display: block; }
```

- [ ] **Step 3: Typecheck, lint, commit**

```bash
npx tsc --noEmit && npx eslint components lib hooks
git add components/Timeline.tsx app/globals.css
git commit -m "feat: render timeline lanes for people, events, and books"
```

---

### Task 5: Wire it into the app and make the filter real

**Files:**
- Modify: `components/Explorer.tsx`
- Modify: `app/api/timeline/route.ts`
- Modify: `components/Timeline.tsx`

**Interfaces:**
- Consumes: `<Timeline onSelectPerson>` (Task 4).
- Produces: a working "Timeline" nav section, and `personBooks: Record<string, string[]>` in the API payload so the book filter actually filters.

**Why the API changes:** Task 4 left `personMatchesBooks` returning `true` because the timeline payload carries no per-person book tags. Rather than shipping every person's full scripture refs, the route returns a compact person-id → book-names map.

- [ ] **Step 1: Add `personBooks` to the API**

In `app/api/timeline/route.ts`, add a fifth query to the `Promise.all`:

```typescript
      db.query<{ person_id: string; book: string }>(
        `SELECT DISTINCT sr.person_id, sr.book
         FROM scripture_refs sr
         JOIN people p ON p.id = sr.person_id
         WHERE p.timeline_start_bc IS NOT NULL AND sr.person_id != ''`
      ),
```

Name the destructured result `personBookRows`, then build and return the map:

```typescript
    const personBooks: Record<string, string[]> = {};
    for (const row of personBookRows) {
      (personBooks[row.person_id] ||= []).push(row.book);
    }
```

Add `personBooks` to the JSON response object alongside the existing four keys.

- [ ] **Step 2: Thread it through the hook and use it**

In `hooks/useTimeline.ts`, add `personBooks: Record<string, string[]>` to the `TimelineData` interface and `personBooks: {}` to `EMPTY`.

In `components/Timeline.tsx`, pull `personBooks` from `useTimeline()`, replace the placeholder with a real implementation, and pass the map down to `PersonLane` as a new prop:

```typescript
function personMatchesBooks(p: Person, checked: Set<string>, personBooks: Record<string, string[]>): boolean {
  const books = personBooks[p.id];
  if (!books || books.length === 0) return false;
  return books.some(b => checked.has(b));
}
```

Update `PersonLaneProps` to include `personBooks: Record<string, string[]>` and the call site accordingly.

- [ ] **Step 3: Add the nav entry**

In `components/Explorer.tsx`:

Extend the `Section` union (line ~35) to include `"timeline"`:

```typescript
type Section = "people" | "books" | "tree" | "timeline" | "stats";
```

Add to the `NAV` array, between `tree` and `stats`:

```typescript
  { key: "timeline", label: "Timeline", icon: "M12 8v4l3 2M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0" },
```

Import the component near the other component imports:

```typescript
import { Timeline } from "./Timeline";
```

Then add a section block, modelled exactly on the existing Tree section (same `.app-section` wrapper, same `.section-header` with the mobile menu button):

```tsx
        {/* Timeline section */}
        <div className={`app-section${section === "timeline" ? " active" : ""}`}>
          <div className="section-header">
            <button className="mob-menu-btn" onClick={() => setSidebarOpen(o => !o)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div>
              <div className="section-eyebrow">Explore</div>
              <div className="section-title">Timeline</div>
              <div className="section-subtitle">Who lived when, and when prophecy came true</div>
            </div>
          </div>
          <Timeline onSelectPerson={selectPerson} />
        </div>
```

- [ ] **Step 4: Verify in the browser**

Start the dev server in the background — never in the foreground, it blocks:

```bash
npm run dev > /tmp/tl-ui.log 2>&1 &
echo $! > /tmp/tl-ui.pid
for i in $(seq 1 40); do
  PORT=$(grep -oE 'localhost:[0-9]+' /tmp/tl-ui.log | head -1 | cut -d: -f2)
  [ -n "$PORT" ] && break
  sleep 1
done
echo "PORT=$PORT"
```

Then, using browser automation, log in with the passcode from `.env.local`'s `ADMIN_PASSCODE`, click the **Timeline** nav item, and confirm:

1. Six people lanes render (Judges, United Kingdom, Judah, Israel, Major Prophets, Minor Prophets), plus an Events lane.
2. Judah's lane shows 20 segments of visibly different widths — Asa's 41 years is clearly wider than Abijah's 2.
3. The Judges lane occupies more than one row (they overlap).
4. Unchecking every book dims the people rather than blanking the screen.
4b. **Event labels never overlap each other.** The fall of Samaria (722 BC) and Sennacherib's repelled siege (701 BC) are close together — confirm the second has been pushed onto a lower row rather than colliding with the first. Zoom out if needed to force the collision.
5. Toggling **Books** on adds a Books lane with bars; toggling it off removes it.
6. No errors in the browser console.

Take a screenshot for the report.

- [ ] **Step 5: Stop the server, commit**

```bash
kill "$(cat /tmp/tl-ui.pid)" 2>/dev/null; rm -f /tmp/tl-ui.pid /tmp/tl-ui.log
npx tsc --noEmit && npx eslint app components hooks lib
git add app/api/timeline/route.ts hooks/useTimeline.ts components/Timeline.tsx components/Explorer.tsx
git commit -m "feat: wire Timeline into nav and make the book filter functional"
```

---

### Task 6: Prophecy links, detail panel, pan/zoom, and mobile

**Files:**
- Modify: `components/Timeline.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: everything from Tasks 1-5.

- [ ] **Step 1: Add selection state and the detail panel**

In `components/Timeline.tsx`, add `const [selectedId, setSelectedId] = useState<string | null>(null);`. Clicking a person segment sets it (instead of calling `onSelectPerson` directly); the panel's "View full profile" button calls `onSelectPerson`.

Render a right-hand panel when `selectedId` is set, modelled on the existing `.ft-detail-panel` in `components/FamilyTree.tsx` (read it first and match its structure and voice). It shows: name, dates, track label, description, any `dateUncertaintyNote` in italics under a "Dating note" heading, and — for a prophet — every `prophecyLink` where `prophetPersonId === selectedId`, each rendering its `explanation` plus its `uncertaintyNote` when present.

Give it class `tl-detail-panel` and add styles mirroring `.ft-detail-panel`.

- [ ] **Step 2: Draw the fulfillment connectors**

When the selected person has prophecy links, draw a dashed line from their segment to each fulfilled event's marker. Add an absolutely-positioned `<svg className="tl-links">` layer over `.tl-lanes` with `pointer-events: none`.

For each matching link, compute the prophecy's x as the midpoint of the prophet's span and the event's x from `yearToPct(event.yearBc, range)`, then draw a quadratic curve between them:

```tsx
<path
  d={`M ${fromX}% ${fromY} Q ${(fromX + toX) / 2}% ${(fromY + toY) / 2 - 40} ${toX}% ${toY}`}
  stroke="var(--gold-deep)" strokeWidth={1.75} strokeDasharray="4 3" fill="none" opacity={0.85}
/>
```

`fromY`/`toY` are the vertical offsets of the prophet's lane and the events lane. Track those by giving each lane a `ref` and measuring with `getBoundingClientRect()` relative to `.tl-lanes`, recomputing in a `useEffect` keyed on `[selectedId, range, showBooksLayer, showPeopleLayer]`.

Also render a banner above the canvas while a link is selected, styled like the mockup's: warm amber background, one line per link, using the link's `explanation` verbatim.

- [ ] **Step 3: Hide labels that don't fit**

After render, measure each `.tl-seg-label` and hide it when it overflows its segment — the behaviour validated with the user, so no name is ever shown clipped mid-word:

```typescript
useEffect(() => {
  const labels = document.querySelectorAll<HTMLElement>(".tl-seg-label");
  labels.forEach(label => {
    const seg = label.parentElement;
    if (!seg) return;
    label.style.display = "";
    seg.style.paddingLeft = "6px";
    if (label.scrollWidth > seg.clientWidth - 6) {
      label.style.display = "none";
      seg.style.paddingLeft = "0";
    }
  });
});
```

This effect intentionally has no dependency array — it must re-measure after every render, since zoom and filter changes both alter segment widths.

- [ ] **Step 4: Add horizontal zoom**

Add `const [zoom, setZoom] = useState(1);` and apply it by widening the lane container: wrap `.tl-lanes` and `.tl-scale` in an inner div with `style={{ width: `${zoom * 100}%`, minWidth: "100%" }}`. Because positions are percentages, widening the container scales everything correctly and `.tl-canvas`'s existing `overflow: auto` provides panning for free — no transform matrix or custom pan reducer needed.

Add zoom controls (`−` / `+` / `Fit`) bottom-right, styled like `.ft-zoom` in `app/globals.css`. Clamp zoom to `[1, 8]`. "Fit" resets to 1.

- [ ] **Step 5: Guard mobile touches — REQUIRED**

`components/FamilyTree.tsx` shipped a bug where raw non-passive touch listeners on the pan container swallowed every tap on overlay UI, breaking buttons and inputs on mobile entirely. This Timeline uses native scrolling rather than custom touch handlers, so it does not reproduce that bug — but it must still declare the same CSS guard so nested scroll/tap behaviour stays correct:

```css
.tl-filters, .tl-detail-panel, .tl-zoom, .tl-banner { touch-action: manipulation; }
```

Then verify on a mobile viewport (see Step 6). Do NOT add custom `touchstart`/`touchmove` listeners to `.tl-canvas` — native overflow scrolling is deliberate here.

- [ ] **Step 6: Verify in the browser, desktop and mobile**

Start the dev server backgrounded exactly as in Task 5 Step 4, log in, open Timeline, and confirm:

1. Clicking **Isaiah** opens the detail panel, draws three dashed curves to Sennacherib's siege (701 BC), Jerusalem's fall (586 BC), and Cyrus's decree (538 BC), and shows all three explanations.
2. Clicking **Daniel** draws one curve to Babylon's fall (539 BC).
3. The Isaiah→Cyrus link displays its authorship `uncertaintyNote`.
4. A judge shows its dating note and renders with soft/rounded edges, visibly less crisp than Hezekiah's segment.
5. Zooming in widens segments and the canvas scrolls horizontally; no label is ever clipped mid-word at any zoom level.
6. At a 390×844 mobile viewport, the filter checkboxes and zoom buttons still respond to taps.
7. Browser console is free of errors.

Take screenshots of the Isaiah selection at desktop width and of the mobile viewport.

- [ ] **Step 7: Stop the server, final checks, commit**

```bash
kill "$(cat /tmp/tl-ui.pid)" 2>/dev/null; rm -f /tmp/tl-ui.pid /tmp/tl-ui.log
npx tsc --noEmit
npx eslint app components hooks lib
npm run verify:layout
npm run verify:timeline
npm run build
git add components/Timeline.tsx app/globals.css
git commit -m "feat: add prophecy connectors, detail panel, and zoom to the timeline"
```

Expected: tsc clean; eslint 1 pre-existing error only; both verify suites pass; build succeeds.
