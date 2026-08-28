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
