"use client";
import { useDeferredValue, useMemo, useState, useEffect, useRef } from "react";
import { useTimeline } from "@/hooks/useTimeline";
import { BOOK_COVERAGE } from "@/lib/types";
import type { Person, HistoricalEvent, ProphecyLink } from "@/lib/types";
import { spanToBox, packRows, computeRange, yearToPct, formatYear, formatYearSpan, type Span, type TimelineRange } from "@/lib/timeline-layout";
import { TIMELINE_PERIODS } from "@/lib/timeline-periods";
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
  messiah:       ["var(--tl-messiah-1)"],
  nt_prophet:    ["var(--tl-nt-prophet-1)", "var(--tl-nt-prophet-2)"],
  apostle:       ["var(--tl-apostle-1)", "var(--tl-apostle-2)", "var(--tl-apostle-3)", "var(--tl-apostle-4)"],
  church_leader: ["var(--tl-church-1)", "var(--tl-church-2)", "var(--tl-church-3)"],
  roman_ruler:   ["var(--tl-rome-1)", "var(--tl-rome-2)", "var(--tl-rome-3)", "var(--tl-rome-4)"],
  herodian:      ["var(--tl-herod-1)", "var(--tl-herod-2)", "var(--tl-herod-3)"],
  jewish_leader: ["var(--tl-priest-1)", "var(--tl-priest-2)"],
};

// Lane order runs top to bottom as rulers first, then God's messengers — the
// same split the vertical view makes into left and right columns. A lane with
// nobody in it renders nothing, so the Old Testament lanes simply stop and the
// New Testament ones begin further right along the same axis.
const LANES: { track: string; label: string; family: string; multiRow: boolean }[] = [
  { track: "judge",         label: "Judges",          family: "Leaders", multiRow: true  },
  { track: "united_king",   label: "United kingdom",  family: "Rulers", multiRow: false },
  { track: "judah_king",    label: "Judah",           family: "Southern kingdom", multiRow: false },
  { track: "israel_king",   label: "Israel",          family: "Northern kingdom", multiRow: false },
  { track: "herodian",      label: "Herod's house",   family: "Rulers", multiRow: true  },
  { track: "roman_ruler",   label: "Rome",            family: "Rulers", multiRow: true  },
  { track: "jewish_leader", label: "Priests & teachers", family: "Rulers", multiRow: true },
  { track: "major_prophet", label: "Major prophets",  family: "Prophetic voices", multiRow: true  },
  { track: "minor_prophet", label: "Minor prophets",  family: "Prophetic voices", multiRow: true  },
  { track: "nt_prophet",    label: "Prophets (NT)",   family: "Prophetic voices", multiRow: true  },
  { track: "messiah",       label: "Jesus",           family: "Prophetic voices", multiRow: false },
  { track: "apostle",       label: "Apostles",        family: "Prophetic voices", multiRow: true  },
  { track: "church_leader", label: "Church leaders",  family: "Prophetic voices", multiRow: true  },
];

const ROW_H = 38;
const ROW_GAP = 6;
const ZOOM_MIN = 1;
const ZOOM_MAX = 6;
const ZOOM_STEP = 0.5;

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

export function TimelineHorizontal({ onSelectPerson }: Props) {
  const { people, events, prophecyLinks, eventRefs, personBooks, loading } = useTimeline();
  const [checkedBooks, setCheckedBooks] = useState<Set<string>>(() => new Set(TIMELINE_BOOKS));
  const [showBooksLayer, setShowBooksLayer] = useState(false);
  const [showPeopleLayer, setShowPeopleLayer] = useState(true);
  const [showEventsLayer, setShowEventsLayer] = useState(true);
  const [showLinksLayer, setShowLinksLayer] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  // Starts above "fit" (1) rather than at it: the full span is ~945 years
  // once judges and book coverage are included, so at zoom 1 every segment
  // is a blank sliver — nothing reads without hovering. 3x keeps a useful
  // share of names legible on load; "Fit" (below) still zooms out to 1 for
  // the whole-picture view in one click.
  const [zoom, setZoom] = useState(1.5);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [linkGeoms, setLinkGeoms] = useState<LinkGeom[]>([]);
  const [lanesHeight, setLanesHeight] = useState(0);
  const lanesRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  // Drag-to-pan bookkeeping. `moved` is what stops a drag that happens to end
  // on a segment from also registering as a click on it.
  const drag = useRef({ active: false, startX: 0, startScroll: 0, moved: false });

  // True once every book in the filter list is checked — the "no filtering
  // in effect" state, used below to skip the per-person/event book match
  // entirely. See personMatchesBooks() for how the actual filtering works.
  const allChecked = TIMELINE_BOOKS.every(book => checkedBooks.has(book));
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const range: TimelineRange = useMemo(() => {
    const spans: Span[] = people
      .filter(p => p.timelineStartBc !== null && p.timelineEndBc !== null)
      .map(p => ({ id: p.id, startBc: p.timelineStartBc as number, endBc: p.timelineEndBc as number }));
    const bookSpans: Span[] = Object.entries(BOOK_COVERAGE)
      .map(([name, c]) => ({ id: name, startBc: c.startBc, endBc: c.endBc }));
    return computeRange([...spans, ...bookSpans], events.map(e => e.yearBc), 25);
  }, [people, events]);

  const selectedPerson = selectedId ? people.find(p => p.id === selectedId) ?? null : null;
  const selectedEvent = selectedEventId ? events.find(e => e.id === selectedEventId) ?? null : null;

  const eventBooks = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const ref of eventRefs) {
      if (!ref.eventId) continue;
      const books = result[ref.eventId] ||= [];
      if (!books.includes(ref.book)) books.push(ref.book);
    }
    return result;
  }, [eventRefs]);

  const visiblePeople = useMemo(() => {
    if (!showPeopleLayer) return [];
    return people.filter(person => {
      if (person.timelineStartBc === null || person.timelineEndBc === null) return false;
      const books = personBooks[person.id] ?? [];
      if (!allChecked && !books.some(book => checkedBooks.has(book))) return false;
      if (!deferredQuery) return true;
      return searchable([person.name, person.alsoKnownAs, person.description, person.timelineTrack, ...books]).includes(deferredQuery);
    });
  }, [allChecked, checkedBooks, deferredQuery, people, personBooks, showPeopleLayer]);

  const visibleEvents = useMemo(() => {
    if (!showEventsLayer) return [];
    return events.filter(event => {
      const books = eventBooks[event.id] ?? [];
      if (!allChecked && !books.some(book => checkedBooks.has(book))) return false;
      if (!deferredQuery) return true;
      return searchable([event.title, event.description, event.era, ...books]).includes(deferredQuery);
    });
  }, [allChecked, checkedBooks, deferredQuery, eventBooks, events, showEventsLayer]);

  const resultCount = visiblePeople.length + visibleEvents.length;

  // Search is most useful when the matching person is brought into view, not
  // merely left highlighted somewhere offscreen in a very wide chart.
  useEffect(() => {
    if (!deferredQuery) return;
    const canvas = canvasRef.current;
    const lanes = lanesRef.current;
    if (!canvas || !lanes) return;
    const person = visiblePeople[0];
    const event = visibleEvents[0];
    const target = person
      ? lanes.querySelector<HTMLElement>(`[data-person-id="${person.id}"]`)
      : event
      ? lanes.querySelector<HTMLElement>(`[data-event-id="${event.id}"]`)
      : null;
    if (!target) return;
    const frame = window.requestAnimationFrame(() => {
      const canvasRect = canvas.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const targetCenter = targetRect.left + targetRect.width / 2;
      canvas.scrollTo({
        left: Math.max(0, canvas.scrollLeft + targetCenter - (canvasRect.left + canvasRect.width / 2)),
        behavior: "smooth",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [deferredQuery, visibleEvents, visiblePeople]);

  // The same prophecy_links rows read from either end. Picking a prophet asks
  // "what did this foretell?"; picking an event asks the reverse — "who
  // foretold this?" — which is the same set filtered on the other column, so
  // one geometry pass serves both directions.
  const relatedLinks = selectedPerson
    ? prophecyLinks.filter(l => l.prophetPersonId === selectedPerson.id)
    : selectedEvent
    ? prophecyLinks.filter(l => l.fulfillmentEventId === selectedEvent.id)
    : [];
  const selectedLinks = showLinksLayer ? relatedLinks : [];

  // Which books narrate the selected event.
  const selectedEventBooks = selectedEvent ? eventBooks[selectedEvent.id] ?? [] : [];

  const selectPerson = (id: string) => { setSelectedEventId(null); setSelectedId(id); };
  const selectEvent = (id: string) => { setSelectedId(null); setSelectedEventId(prev => prev === id ? null : id); };
  const panelOpen = selectedPerson !== null || selectedEvent !== null;

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

      if ((!selectedPerson && !selectedEvent) || selectedLinks.length === 0) { setLinkGeoms([]); return; }

      // A zero-width box is a transient layout frame — e.g. the instant the
      // canvas's padding-right compensation (below) applies and `.tl-lanes`
      // hasn't settled into its new size yet — not a dead end. Dividing by
      // it would put Infinity into an SVG path's `d`, so this bails for now,
      // but the ResizeObserver effect further down re-invokes this same
      // closure the moment `.tl-lanes`' box actually changes, including the
      // moment it recovers from zero, so the curves still land correctly
      // without needing a second interaction to force it.
      if (lanesRect.width === 0) return;

      // Measure a point on either a prophet's segment or an event's marker.
      const centreOf = (sel: string) => {
        const el = lanesEl.querySelector<HTMLElement>(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          x: ((r.left - lanesRect.left) + r.width / 2) / lanesRect.width * 100,
          y: r.top - lanesRect.top + r.height / 2,
        };
      };

      const geoms: LinkGeom[] = [];
      for (const link of selectedLinks) {
        const a = centreOf(`[data-person-id="${link.prophetPersonId}"]`);
        const b = centreOf(`[data-event-dot="${link.fulfillmentEventId}"]`);
        if (!a || !b) continue;
        geoms.push({
          id: link.id,
          d: `M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${(a.y + b.y) / 2 - 40} ${b.x} ${b.y}`,
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
  }, [selectedId, selectedEventId, range, showBooksLayer, showEventsLayer, showLinksLayer, showPeopleLayer]);

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

  // Mouse wheel pans the timeline left/right instead of scrolling it down.
  //
  // Telling a wheel from a trackpad: a mouse wheel reports movement only on
  // deltaY, while a two-finger horizontal swipe reports deltaX. So a
  // deltaY-dominant event is the wheel and gets translated to horizontal
  // motion; anything deltaX-dominant is already a horizontal gesture and is
  // left to the browser's native scrolling, which handles it (with momentum)
  // better than we could.
  //
  // Shift+wheel stays vertical. The lanes are taller than the canvas on
  // shorter screens, and the Events lane sits near the bottom — without an
  // escape hatch a mouse-only user could not reach it at all.
  //
  // Registered here rather than via React's onWheel because preventDefault()
  // requires a non-passive listener, and React attaches wheel handlers
  // passively.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.shiftKey) return;                                  // deliberate vertical
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;     // trackpad swipe
      if (el.scrollWidth <= el.clientWidth) return;            // nothing to pan
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // Not [] — the canvas does not exist during the loading and empty states
    // above, so an on-mount-only effect would find a null ref and never
    // attach. Re-running once those resolve is what actually binds it.
  }, [loading, people.length]);

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
  // Click-and-drag panning. Mouse only, by design: touch devices already pan
  // this canvas with native overflow scrolling, and adding touch listeners
  // here is what previously broke every tap on the Family Tree's overlay UI.
  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    // The segments and event markers ARE buttons, and they cover most of the
    // canvas — excluding buttons here would mean dragging only worked on the
    // empty gaps between kings. Start a drag anywhere on the canvas; the
    // `moved` flag below is what keeps a drag from also selecting whatever it
    // happened to start on. Only the detail panel, which overlays the canvas
    // and has its own scrolling and controls, is excluded.
    if ((e.target as Element).closest(".tl-detail-panel")) return;
    const el = canvasRef.current;
    if (!el) return;
    drag.current = { active: true, startX: e.clientX, startScroll: el.scrollLeft, moved: false };
  };

  const onCanvasMouseMove = (e: React.MouseEvent) => {
    if (!drag.current.active) return;
    const el = canvasRef.current;
    if (!el) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 3) drag.current.moved = true;
    el.scrollLeft = drag.current.startScroll - dx;
  };

  const endCanvasDrag = () => { drag.current.active = false; };
  // A normal mouseup is followed by a click that must be swallowed after a
  // real drag. Leaving the canvas produces no such click, so clear `moved`
  // here or the user's next intentional click would be discarded instead.
  const cancelCanvasDrag = () => {
    drag.current.active = false;
    drag.current.moved = false;
  };

  // Swallow the click that ends a drag, so panning past a king doesn't also
  // select him. Runs in the capture phase to beat the segment's own onClick.
  const onCanvasClickCapture = (e: React.MouseEvent) => {
    if (drag.current.moved) {
      e.stopPropagation();
      e.preventDefault();
      drag.current.moved = false;
    }
  };

  const ticks: number[] = [];
  for (let y = Math.floor(range.startBc / 100) * 100; y > range.endBc; y -= 100) {
    // There is no year zero — the calendar runs 1 BC straight into AD 1 — so
    // the century mark that lands on it is skipped rather than labelled.
    if (y === 0) continue;
    ticks.push(y);
  }

  return (
    <div className="tlh-root">
      <TimelineFilters
        checkedBooks={checkedBooks}
        showBooksLayer={showBooksLayer}
        showPeopleLayer={showPeopleLayer}
        showEventsLayer={showEventsLayer}
        showLinksLayer={showLinksLayer}
        zoom={zoom}
        query={query}
        resultCount={resultCount}
        onQueryChange={setQuery}
        onToggleBook={toggleBook}
        onToggleAll={toggleAll}
        onToggleBooksLayer={() => setShowBooksLayer(value => !value)}
        onTogglePeopleLayer={() => setShowPeopleLayer(value => !value)}
        onToggleEventsLayer={() => setShowEventsLayer(value => !value)}
        onToggleLinksLayer={() => setShowLinksLayer(value => !value)}
        onZoomIn={() => setZoom(value => Math.min(ZOOM_MAX, value + ZOOM_STEP))}
        onZoomOut={() => setZoom(value => Math.max(ZOOM_MIN, value - ZOOM_STEP))}
        onZoomReset={() => setZoom(1)}
        open={filtersOpen}
        onToggleOpen={() => setFiltersOpen(value => !value)}
      />

      <section className="tlh-intro" aria-labelledby="tlh-intro-title">
        <div>
          <span className="tlv-kicker">A side-by-side Bible history</span>
          <h2 id="tlh-intro-title">See who lived at the same time.</h2>
          <p>Each row follows one group through history. Drag sideways to compare rulers, prophets, books, and turning points that overlapped.</p>
        </div>
        <div className="tlh-at-a-glance" aria-label="Visible timeline summary">
          <div><strong>{visiblePeople.length}</strong><span>people</span></div>
          <div><strong>{visibleEvents.length}</strong><span>events</span></div>
          <div><strong>{TIMELINE_PERIODS.length}</strong><span>eras</span></div>
        </div>
      </section>

      <div className="tl-main tlh-main">
        <div className="tlh-chart-heading">
          <div>
            <span className="tlh-chart-kicker">Earlier <span aria-hidden="true">→</span> Later</span>
            <strong>Drag or scroll sideways to travel through time</strong>
          </div>
          <div className="tlh-legend" aria-label="Timeline color key">
            <span className="judah">Judah</span>
            <span className="israel">Israel</span>
            <span className="prophets">Prophets</span>
            <span className="events">Turning points</span>
          </div>
        </div>

        {selectedLinks.length > 0 && (
          <div className="tl-banner tlh-banner">
            <strong>Prophecy connection</strong>
            {selectedLinks.map(link => <div key={link.id} className="tl-banner-line">{link.explanation}</div>)}
          </div>
        )}

        <div
          ref={canvasRef}
          onMouseDown={onCanvasMouseDown}
          onMouseMove={onCanvasMouseMove}
          onMouseUp={endCanvasDrag}
          onMouseLeave={cancelCanvasDrag}
          onClickCapture={onCanvasClickCapture}
          className="tl-canvas tlh-canvas"
          style={{ paddingRight: panelOpen ? 32 + 340 : 32 }}
        >
          <div className="tlh-chart" style={{ width: `${zoom * 100}%` }}>
            <div className="tlh-era-strip" aria-label="Historical eras">
              <div className="tlh-gutter-title">Bible eras</div>
              <div className="tlh-era-track">
                {TIMELINE_PERIODS.map(period => {
                  const left = clampedYearPct(period.startBc, range);
                  const right = clampedYearPct(period.endBc, range);
                  return (
                    <div key={period.id} className={`tlh-era tlh-era-${period.id}`} style={{ left: `${left}%`, width: `${Math.max(right - left, 0)}%` }} title={period.summary}>
                      <strong>{period.label}</strong>
                      <small>{period.years}</small>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="tl-scale">
              <span className="tlh-scale-label">Year</span>
              <div className="tlh-scale-track">
                {ticks.map(t => (
                  <div key={t} className="tl-tick" style={{ left: `${yearToPct(t, range)}%` }}>
                    <span className="tl-tick-label">{formatYear(t)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="tl-lanes" ref={lanesRef}>
              <div className="tlh-grid" aria-hidden="true">
                <div className="tlh-grid-track">
                  {ticks.map(tick => <span key={tick} style={{ left: `${yearToPct(tick, range)}%` }} />)}
                </div>
              </div>
              {LANES.map(lane => (
                <PersonLane
                  key={lane.track}
                  label={lane.label}
                  family={lane.family}
                  track={lane.track}
                  multiRow={lane.multiRow}
                  people={visiblePeople}
                  range={range}
                  selectedId={selectedId}
                  onSelect={selectPerson}
                />
              ))}

              {showEventsLayer && visibleEvents.length > 0 && (
                <EventLane events={visibleEvents} range={range} selectedEventId={selectedEventId} onSelectEvent={selectEvent} />
              )}

              {showBooksLayer && <BookLane range={range} checkedBooks={checkedBooks} />}

              {resultCount === 0 && !showBooksLayer && (
                <div className="tlh-empty">No matching timeline entries. Try another search or turn a layer back on.</div>
              )}

              {linkGeoms.length > 0 && (
                <svg className="tl-links" viewBox={`0 0 100 ${lanesHeight}`} preserveAspectRatio="none" aria-hidden="true">
                  {linkGeoms.map(geometry => (
                    <g key={geometry.id}>
                      <path d={geometry.d} className="tlh-link-halo" vectorEffect="non-scaling-stroke" />
                      <path d={geometry.d} className="tlh-link-line" vectorEffect="non-scaling-stroke" />
                    </g>
                  ))}
                </svg>
              )}
            </div>
          </div>
        </div>

        {selectedEvent && (
          <EventDetailPanel event={selectedEvent} books={selectedEventBooks} links={relatedLinks} people={people}
            onClose={() => setSelectedEventId(null)} onSelectProphet={selectPerson} />
        )}

        {selectedPerson && (
          <PersonDetailPanel
            person={selectedPerson}
            trackLabel={LANES.find(lane => lane.track === selectedPerson.timelineTrack)?.label ?? selectedPerson.timelineTrack}
            links={relatedLinks}
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
  label: string; family: string; track: string; multiRow: boolean; people: Person[]; range: TimelineRange;
  selectedId: string | null; onSelect: (id: string) => void;
}

function PersonLane({ label, family, track, multiRow, people, range, selectedId, onSelect }: PersonLaneProps) {
  const rows = useMemo(
    () => laneRows(people, track, multiRow),
    [people, track, multiRow],
  );
  if (rows.length === 0 || rows[0].length === 0) return null;
  const palette = TRACK_COLORS[track] ?? ["#6b7280"];

  return (
    <div className={`tl-lane tl-lane-${track}`}>
      <div className="tl-lane-label">
        <span>{family}</span>
        <strong>{label}</strong>
      </div>
      <div className="tl-lane-body" style={{ height: rows.length * (ROW_H + ROW_GAP) }}>
        {rows.map((row, ri) =>
          row.map((s, si) => {
            const { leftPct, widthPct, floored } = spanToBox(s, range);
            return (
              <button
                key={s.id}
                data-person-id={s.person.id}
                className={`tl-seg${s.person.dateConfidence === "uncertain" ? " tl-seg-uncertain" : ""}${s.person.id === selectedId ? " tl-seg-selected" : ""}`}
                style={{
                  left: `${leftPct}%`, width: `${widthPct}%`,
                  top: ri * (ROW_H + ROW_GAP), height: ROW_H,
                  background: palette[si % palette.length],
                  // A floored (zero-length) reign shares its exact leftPct with
                  // the next king, who is wider — e.g. Zimri vs Omri. Without a
                  // deterministic stacking order the wider neighbour, painted
                  // later or earlier depending on incidental array order, can
                  // bury the narrow one entirely. Floored segments always win.
                  zIndex: floored ? 2 : 1,
                }}
                title={segTitle(s.person)}
                onClick={() => onSelect(s.person.id)}
              >
                <span className="tl-seg-label">
                  <strong>{s.person.name}</strong>
                  <small>{s.person.timelineStartBc}–{s.person.timelineEndBc}</small>
                </span>
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}

function segTitle(p: Person) {
  const years = formatYearSpan(p.timelineStartBc as number, p.timelineEndBc as number);
  const conf = p.dateConfidence === "uncertain" ? " · dates uncertain" : "";
  return `${p.name} (${years})${conf}`;
}

function searchable(values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").toLowerCase();
}

function clampedYearPct(year: number, range: TimelineRange) {
  return Math.min(100, Math.max(0, yearToPct(year, range)));
}

interface EventLaneProps {
  events: HistoricalEvent[]; range: TimelineRange;
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
}

function EventLane({ events, range, selectedEventId, onSelectEvent }: EventLaneProps) {
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

    const EVENT_ROW_H = 70, GAP = 12;
    const rows: [number, number][][] = [];
    for (const p of placed) {
      let row = 0;
      for (;;) {
        const occupied = rows[row] ?? (rows[row] = []);
        const collides = occupied.some(([l, r]) => p.left < r + GAP && p.right > l - GAP);
        if (!collides) { occupied.push([p.left, p.right]); break; }
        row++;
      }
      p.el.style.top = `${row * EVENT_ROW_H}px`;
    }
    lane.style.height = `${Math.max(rows.length, 1) * EVENT_ROW_H}px`;
  });

  return (
    <div className="tl-lane tl-event-lane">
      <div className="tl-lane-label">
        <span>Story milestones</span>
        <strong>Turning points</strong>
      </div>
      <div ref={laneRef} className="tl-lane-body tl-events">
        {events.map(ev => {
          return (
            <button
              key={ev.id}
              type="button"
              data-event-id={ev.id}
              className={`tl-event${ev.id === selectedEventId ? " tl-event-selected" : ""}`}
              style={{ left: `${yearToPct(ev.yearBc, range)}%` }}
              title={`${ev.title} (${formatYear(ev.yearBc)})`}
              onClick={() => onSelectEvent(ev.id)}
            >
              <span className="tl-event-dot" data-event-dot={ev.id}>◆</span>
              <span className="tl-event-label">
                <span className="tl-event-title">{ev.title}</span>
                <span className="tl-event-year">{formatYear(ev.yearBc)}</span>
              </span>
            </button>
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
    <div className="tl-lane tl-book-lane">
      <div className="tl-lane-label">
        <span>Scripture</span>
        <strong>Book coverage</strong>
      </div>
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
                <span className="tl-seg-label"><strong>{s.id}</strong><small>{s.startBc}–{s.endBc}</small></span>
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

interface EventDetailPanelProps {
  event: HistoricalEvent;
  books: string[];
  links: ProphecyLink[];
  people: Person[];
  onClose: () => void;
  onSelectProphet: (id: string) => void;
}

// The reverse of PersonDetailPanel: instead of "what did this prophet
// foretell?", this answers "who foretold this, and where is it written?" —
// reading the same prophecy_links rows from the fulfillment end.
function EventDetailPanel({ event, books, links, people, onClose, onSelectProphet }: EventDetailPanelProps) {
  return (
    <div className="tl-detail-panel">
      <div className="tl-detail-header">
        <div>
          <div className="tl-detail-name">{event.title}</div>
          <div className="tl-detail-meta">
            {formatYear(event.yearBc)}{event.era ? " · " + event.era : ""}
          </div>
        </div>
        <button className="tl-detail-close" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div className="tl-detail-body">
        {event.description && (
          <div className="tl-detail-section">
            <div className="tl-detail-label">About</div>
            <p className="tl-detail-text">{event.description}</p>
          </div>
        )}

        {event.dateUncertaintyNote && (
          <div className="tl-detail-section">
            <div className="tl-detail-label">Dating note</div>
            <p className="tl-detail-note">{event.dateUncertaintyNote}</p>
          </div>
        )}

        {books.length > 0 && (
          <div className="tl-detail-section">
            <div className="tl-detail-label">Where it&apos;s written</div>
            <div className="tl-detail-books">
              {books.map(b => <span key={b} className="tl-book-chip">{b}</span>)}
            </div>
          </div>
        )}

        {links.length > 0 ? (
          <div className="tl-detail-section">
            <div className="tl-detail-label">Foretold by ({links.length})</div>
            {links.map(link => {
              const prophet = people.find(p => p.id === link.prophetPersonId);
              return (
                <div key={link.id} className="tl-prophecy">
                  <button
                    type="button"
                    className="tl-prophet-link"
                    onClick={() => onSelectProphet(link.prophetPersonId)}
                    title={prophet ? "Show " + prophet.name + " on the timeline" : undefined}
                  >
                    {prophet ? prophet.name : "Unknown"} — {formatProphecyRef(link)}
                  </button>
                  <p className="tl-detail-text">{link.explanation}</p>
                  {link.uncertaintyNote && <p className="tl-detail-note">{link.uncertaintyNote}</p>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="tl-detail-section">
            <div className="tl-detail-label">Foretold by</div>
            <p className="tl-detail-note">No prophecy in the timeline points at this event yet.</p>
          </div>
        )}
      </div>
    </div>
  );
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
            {formatYearSpan(person.timelineStartBc as number, person.timelineEndBc as number)} · {trackLabel}
          </div>
        </div>
        <button type="button" className="tl-detail-close" onClick={onClose} aria-label="Close person details">×</button>
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
