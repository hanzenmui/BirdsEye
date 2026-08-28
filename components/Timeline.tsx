"use client";
import { useMemo, useState, useEffect, useRef } from "react";
import { useTimeline } from "@/hooks/useTimeline";
import { BOOK_COVERAGE } from "@/lib/types";
import type { Person, HistoricalEvent, ProphecyLink } from "@/lib/types";
import { spanToBox, packRows, computeRange, yearToPct, type Span, type TimelineRange } from "@/lib/timeline-layout";
import { TimelineFilters, TIMELINE_BOOKS } from "./TimelineFilters";

// Lane colours drawn from the app's palette: terracotta family for Judah,
// teal/plum for Israel, muted purple for prophets, warm sand for judges.
// The actual values live in app/globals.css as --tl-* custom properties so
// the palette stays themeable with the rest of the app; these are just the
// var() references, keyed by track.
const TRACK_COLORS: Record<string, string[]> = {
  judah_king:    ["var(--tl-judah-1)", "var(--tl-judah-2)", "var(--tl-judah-3)", "var(--tl-judah-4)"],
  israel_king:   ["var(--tl-israel-1)", "var(--tl-israel-2)", "var(--tl-israel-3)", "var(--tl-israel-4)"],
  united_king:   ["var(--tl-united-1)", "var(--tl-united-2)", "var(--tl-united-3)"],
  judge:         ["var(--tl-judge-1)", "var(--tl-judge-2)", "var(--tl-judge-3)"],
  major_prophet: ["var(--tl-major-prophet-1)", "var(--tl-major-prophet-2)"],
  minor_prophet: ["var(--tl-minor-prophet-1)", "var(--tl-minor-prophet-2)"],
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
const ZOOM_MIN = 1;
const ZOOM_MAX = 8;
const ZOOM_STEP = 1;

interface Props { onSelectPerson: (id: string) => void }

// One rendered fulfillment curve, in coordinates relative to `.tl-lanes`:
// x is a 0-100 value (percent of the lanes' width — see the `tl-links` SVG's
// viewBox below), y is a literal pixel offset. Mixing units this way is what
// lets the curve's x auto-scale with zoom (which only ever widens `.tl-lanes`
// horizontally) without recomputing on every zoom tick, while y — which zoom
// never touches — is measured once per relayout.
interface LinkGeom {
  id: string;
  d: string;
}

export function Timeline({ onSelectPerson }: Props) {
  const { people, events, prophecyLinks, eventRefs, personBooks, loading } = useTimeline();
  const [checkedBooks, setCheckedBooks] = useState<Set<string>>(() => new Set(TIMELINE_BOOKS));
  const [showBooksLayer, setShowBooksLayer] = useState(false);
  const [showPeopleLayer, setShowPeopleLayer] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Starts above "fit" (1) rather than at it: the full span is ~945 years
  // once judges and book coverage are included, so at zoom 1 every segment
  // is a blank sliver — nothing reads without hovering. 3x keeps a useful
  // share of names legible on load; "Fit" (below) still zooms out to 1 for
  // the whole-picture view in one click.
  const [zoom, setZoom] = useState(3);
  const [linkGeoms, setLinkGeoms] = useState<LinkGeom[]>([]);
  const [lanesHeight, setLanesHeight] = useState(0);
  const lanesRef = useRef<HTMLDivElement>(null);

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

  const selectedPerson = selectedId ? people.find(p => p.id === selectedId) ?? null : null;
  const selectedLinks = selectedPerson
    ? prophecyLinks.filter(l => l.prophetPersonId === selectedPerson.id)
    : [];

  // Draw each fulfillment curve: from the selected prophet's segment to the
  // marker of the event their prophecy points at. Positions are read straight
  // off the DOM (post row-packing, post collision-stacking) rather than
  // re-derived from the layout math, so the arrows always land on the actual
  // rendered segment/marker — including multi-row lanes and stacked event
  // labels. Stored in a ref (updated every render, below) rather than called
  // directly, so the mount-once ResizeObserver further down always invokes
  // today's closure — selectedPerson/selectedLinks/events included — instead
  // of the one captured when the observer was created.
  const measureLinksRef = useRef<() => void>(() => {});
  useEffect(() => {
    measureLinksRef.current = () => {
      const lanesEl = lanesRef.current;
      if (!lanesEl) return;
      const lanesRect = lanesEl.getBoundingClientRect();
      setLanesHeight(lanesRect.height);

      if (!selectedPerson || selectedLinks.length === 0) { setLinkGeoms([]); return; }

      // A zero-width box is a transient layout frame — e.g. the instant the
      // canvas's padding-right compensation (below) applies and `.tl-lanes`
      // hasn't settled into its new size yet — not a dead end. Dividing by
      // it would put Infinity into an SVG path's `d`, so this bails for now,
      // but the ResizeObserver effect further down re-invokes this same
      // closure the moment `.tl-lanes`' box actually changes, including the
      // moment it recovers from zero, so the curves still land correctly
      // without needing a second interaction to force it.
      if (lanesRect.width === 0) return;

      const fromEl = lanesEl.querySelector<HTMLElement>(`[data-person-id="${selectedPerson.id}"]`);
      if (!fromEl) { setLinkGeoms([]); return; }
      const fromRect = fromEl.getBoundingClientRect();
      const fromX = ((fromRect.left - lanesRect.left) + fromRect.width / 2) / lanesRect.width * 100;
      const fromY = fromRect.top - lanesRect.top + fromRect.height / 2;

      const geoms: LinkGeom[] = [];
      for (const link of selectedLinks) {
        const ev = events.find(e => e.id === link.fulfillmentEventId);
        if (!ev) continue;
        const toEl = lanesEl.querySelector<HTMLElement>(`[data-event-dot="${ev.id}"]`);
        if (!toEl) continue;
        const toRect = toEl.getBoundingClientRect();
        const toX = ((toRect.left - lanesRect.left) + toRect.width / 2) / lanesRect.width * 100;
        const toY = toRect.top - lanesRect.top + toRect.height / 2;
        geoms.push({
          id: link.id,
          d: `M ${fromX} ${fromY} Q ${(fromX + toX) / 2} ${(fromY + toY) / 2 - 40} ${toX} ${toY}`,
        });
      }
      setLinkGeoms(geoms);
    };
  });

  // Re-measure on the state changes that can move a segment or event marker
  // vertically (a new selection, the range recomputing, either layer's
  // visibility flipping). Deliberately excludes `zoom`: x is stored as a
  // fraction of `.tl-lanes`' own width, which stays correct as zoom widens
  // that element with no recompute needed (see LinkGeom above).
  useEffect(() => {
    measureLinksRef.current();
  }, [selectedId, range, showBooksLayer, showPeopleLayer]);

  // ...and independently, whenever `.tl-lanes`' own box actually resizes —
  // covering both the zero-width frame described above (the box recovering
  // from 0 fires this, retrying the measurement that bailed) and the window
  // being resized while a person is already selected, which the deps list
  // above has no way to see and would otherwise leave curves stale.
  useEffect(() => {
    const lanesEl = lanesRef.current;
    if (!lanesEl) return;
    const ro = new ResizeObserver(() => measureLinksRef.current());
    ro.observe(lanesEl);
    return () => ro.disconnect();
  }, []);

  // Hide any segment label that would otherwise clip mid-word. No dependency
  // array intentional — must re-measure after every render, since zoom and
  // filter changes both alter segment widths.
  useEffect(() => {
    const labels = document.querySelectorAll<HTMLElement>(".tl-seg-label");
    labels.forEach(label => {
      const seg = label.parentElement;
      if (!seg) return;
      label.style.display = "";
      (seg as HTMLElement).style.paddingLeft = "6px";
      if (label.scrollWidth > seg.clientWidth - 6) {
        label.style.display = "none";
        (seg as HTMLElement).style.paddingLeft = "0";
      }
    });
  });

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
    ticks.push(y);
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

      <div className="tl-main">
        {selectedLinks.length > 0 && (
          <div className="tl-banner">
            {selectedLinks.map(link => (
              <div key={link.id} className="tl-banner-line">{link.explanation}</div>
            ))}
          </div>
        )}

        <div
          className="tl-canvas"
          // The detail panel docks over the canvas's right 280px. Later
          // events (Cyrus's decree is the latest date in the whole dataset)
          // sit at the timeline's right edge, so without this the panel would
          // sit directly on top of the very marker its own connector points
          // at. Padding out the canvas's content box — border-box, so this
          // actually narrows it — reflows the percentage-positioned lanes to
          // fit beside the panel instead of under it.
          style={{ paddingRight: selectedPerson ? 24 + 280 : 24 }}
        >
          <div style={{ width: `${zoom * 100}%`, minWidth: "100%" }}>
            <div className="tl-scale">
              {ticks.map(t => (
                <div key={t} className="tl-tick" style={{ left: `${yearToPct(t, range)}%` }}>
                  <span className="tl-tick-label">{t} BC</span>
                </div>
              ))}
            </div>

            <div className="tl-lanes" ref={lanesRef}>
              {showPeopleLayer && LANES.map(lane => (
                <PersonLane
                  key={lane.track}
                  label={lane.label}
                  track={lane.track}
                  multiRow={lane.multiRow}
                  people={people}
                  range={range}
                  checkedBooks={checkedBooks}
                  allChecked={allChecked}
                  personBooks={personBooks}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              ))}

              {events.length > 0 && (
                <EventLane events={events} range={range} eventRefs={eventRefs}
                  checkedBooks={checkedBooks} allChecked={allChecked} />
              )}

              {showBooksLayer && (
                <BookLane range={range} checkedBooks={checkedBooks} />
              )}

              {linkGeoms.length > 0 && (
                <svg className="tl-links" viewBox={`0 0 100 ${lanesHeight}`} preserveAspectRatio="none">
                  {linkGeoms.map(g => (
                    // A plain 1.75px dashed line reads as almost invisible against
                    // the lanes' own terracotta/teal/plum fills, so each curve gets
                    // a wider pale halo underneath for contrast, same idea as a
                    // route line drawn on a busy map.
                    <g key={g.id}>
                      <path d={g.d} stroke="var(--bg2)" strokeWidth={4.5} fill="none" opacity={0.9} vectorEffect="non-scaling-stroke" />
                      <path
                        d={g.d}
                        stroke="var(--gold-deep)"
                        strokeWidth={2.25}
                        strokeDasharray="5 3.5"
                        fill="none"
                        vectorEffect="non-scaling-stroke"
                      />
                    </g>
                  ))}
                </svg>
              )}
            </div>
          </div>
        </div>

        <div className="tl-zoom" style={{ right: selectedPerson ? 296 : 16 }}>
          <button onClick={() => setZoom(z => Math.max(ZOOM_MIN, z - ZOOM_STEP))} title="Zoom out (−)">−</button>
          <button onClick={() => setZoom(z => Math.min(ZOOM_MAX, z + ZOOM_STEP))} title="Zoom in (+)">+</button>
          <button className="tl-zoom-fit" onClick={() => setZoom(1)} title="Reset zoom">Fit</button>
        </div>

        {selectedPerson && (
          <PersonDetailPanel
            person={selectedPerson}
            trackLabel={LANES.find(l => l.track === selectedPerson.timelineTrack)?.label ?? selectedPerson.timelineTrack}
            links={selectedLinks}
            onClose={() => setSelectedId(null)}
            onViewProfile={() => { onSelectPerson(selectedPerson.id); setSelectedId(null); }}
          />
        )}
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
  label: string; track: string; multiRow: boolean; people: Person[]; range: TimelineRange;
  checkedBooks: Set<string>; allChecked: boolean; personBooks: Record<string, string[]>;
  selectedId: string | null; onSelect: (id: string) => void;
}

function PersonLane({ label, track, multiRow, people, range, checkedBooks, allChecked, personBooks, selectedId, onSelect }: PersonLaneProps) {
  const rows = useMemo(
    () => laneRows(people, track, multiRow),
    [people, track, multiRow],
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
            const dimmed = !allChecked && !personMatchesBooks(s.person, checkedBooks, personBooks);
            return (
              <button
                key={s.id}
                data-person-id={s.person.id}
                className={`tl-seg${dimmed ? " tl-seg-dim" : ""}${s.person.dateConfidence === "uncertain" ? " tl-seg-uncertain" : ""}${s.person.id === selectedId ? " tl-seg-selected" : ""}`}
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
// Book tags come from the API's personBooks map (person id -> book names,
// derived from scripture_refs). A person with no tagged books never matches
// once any filtering is in effect.
function personMatchesBooks(p: Person, checked: Set<string>, personBooks: Record<string, string[]>): boolean {
  const books = personBooks[p.id];
  if (!books || books.length === 0) return false;
  return books.some(b => checked.has(b));
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
              <span className="tl-event-dot" data-event-dot={ev.id}>◆</span>
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

// `2 Kings 19:32–36` / `Isaiah 44:28 – 45:1` — same shape as lib/mappers.ts's
// formatRef, but ProphecyLink carries its own prophecyBook/prophecyChapter*
// fields rather than a ScriptureRef, so it can't reuse that helper directly.
function formatProphecyRef(l: ProphecyLink): string {
  const same = l.prophecyChapterStart === l.prophecyChapterEnd;
  if (same && l.prophecyVerseStart === l.prophecyVerseEnd) {
    return `${l.prophecyBook} ${l.prophecyChapterStart}:${l.prophecyVerseStart}`;
  }
  if (same) return `${l.prophecyBook} ${l.prophecyChapterStart}:${l.prophecyVerseStart}–${l.prophecyVerseEnd}`;
  return `${l.prophecyBook} ${l.prophecyChapterStart}:${l.prophecyVerseStart} – ${l.prophecyChapterEnd}:${l.prophecyVerseEnd}`;
}

interface PersonDetailPanelProps {
  person: Person; trackLabel: string; links: ProphecyLink[];
  onClose: () => void; onViewProfile: () => void;
}

function PersonDetailPanel({ person, trackLabel, links, onClose, onViewProfile }: PersonDetailPanelProps) {
  return (
    <div className="tl-detail-panel">
      <div className="tl-detail-header">
        <div style={{ minWidth: 0 }}>
          <div className="tl-detail-name">{person.name}</div>
          <div className="tl-detail-meta">
            {person.timelineStartBc}–{person.timelineEndBc} BC · {trackLabel}
          </div>
        </div>
        <button className="tl-detail-close" onClick={onClose}>×</button>
      </div>

      <div className="tl-detail-body">
        {person.description && (
          <div>
            <div className="tl-detail-heading">About</div>
            <p className="tl-detail-desc">{person.description}</p>
          </div>
        )}

        {person.dateUncertaintyNote && (
          <div>
            <div className="tl-detail-heading">Dating note</div>
            <p className="tl-detail-note">{person.dateUncertaintyNote}</p>
          </div>
        )}

        {links.length > 0 && (
          <div>
            <div className="tl-detail-heading">
              Prophecy fulfilled ({links.length})
            </div>
            <div>
              {links.map(link => (
                <div key={link.id} className="tl-link-item">
                  <div className="tl-link-ref">{formatProphecyRef(link)}</div>
                  <p className="tl-link-explanation">{link.explanation}</p>
                  {link.uncertaintyNote && (
                    <p className="tl-link-uncertainty">{link.uncertaintyNote}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {links.length === 0 && !person.description && !person.dateUncertaintyNote && (
          <div className="tl-detail-note">No additional information recorded.</div>
        )}
      </div>

      <div className="tl-detail-footer">
        <button onClick={onViewProfile}>View full profile</button>
      </div>
    </div>
  );
}
