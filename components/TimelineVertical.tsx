"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useTimeline } from "@/hooks/useTimeline";
import { BOOK_COVERAGE } from "@/lib/types";
import type { HistoricalEvent, Person, ProphecyLink } from "@/lib/types";
import { TIMELINE_PERIODS as ERAS, type TimelinePeriod as Era } from "@/lib/timeline-periods";
import { formatYear, formatYearSpan } from "@/lib/timeline-layout";
import { TimelineFilters, TIMELINE_BOOKS } from "./TimelineFilters";

interface Props {
  onSelectPerson: (id: string) => void;
  // Explorer keeps every section mounted and just toggles CSS display, so a
  // measurement taken while this section is display:none reads every offset
  // as zero. Re-measuring when this flips to true catches the tab actually
  // becoming visible, which no ResizeObserver reliably fires on across an
  // ancestor's display:none → flex transition.
  active?: boolean;
}

const TRACK_META: Record<string, { label: string; family: "leader" | "prophet"; color: string }> = {
  judge: { label: "Judge", family: "leader", color: "var(--tl-judge-1)" },
  united_king: { label: "King of united Israel", family: "leader", color: "var(--tl-united-1)" },
  judah_king: { label: "King of Judah", family: "leader", color: "var(--tl-judah-2)" },
  israel_king: { label: "King of Israel", family: "leader", color: "var(--tl-israel-1)" },
  major_prophet: { label: "Major prophet", family: "prophet", color: "var(--tl-major-prophet-1)" },
  minor_prophet: { label: "Minor prophet", family: "prophet", color: "var(--tl-minor-prophet-1)" },
  // New Testament. "family" decides the column: the left side holds whoever
  // held power at the time, the right side whoever spoke for God — so Rome,
  // Herod's family and the high priests sit opposite Jesus and the apostles.
  messiah:       { label: "The Messiah",  family: "prophet", color: "var(--tl-messiah-1)" },
  nt_prophet:    { label: "Prophet",      family: "prophet", color: "var(--tl-nt-prophet-1)" },
  apostle:       { label: "Apostle",      family: "prophet", color: "var(--tl-apostle-1)" },
  church_leader: { label: "Church leader", family: "prophet", color: "var(--tl-church-1)" },
  roman_ruler:   { label: "Roman ruler",  family: "leader",  color: "var(--tl-rome-1)" },
  herodian:      { label: "Herod's house", family: "leader", color: "var(--tl-herod-1)" },
  jewish_leader: { label: "Jewish leader", family: "leader", color: "var(--tl-priest-1)" },
};

// When a kingdom is split, one row can hold both a Judah king and an Israel
// king who were on their thrones at the same time. `isNew` marks which side
// just took power on this row (a full card) versus which side is only shown
// because they were still reigning across the border when the other kingdom's
// throne changed hands (a condensed "still reigning" reference).
interface KingdomRow {
  key: string;
  yearBc: number;
  judah?: Person;
  judahIsNew: boolean;
  israel?: Person;
  israelIsNew: boolean;
}

type TimelineEntry =
  | { key: string; kind: "person"; yearBc: number; side: "left" | "right"; person: Person }
  | { key: string; kind: "event"; yearBc: number; side: "left" | "right"; event: HistoricalEvent }
  | { key: string; kind: "kingdoms"; yearBc: number; row: KingdomRow };

// Merges two kingdoms' king lists into rows so contemporaneous reigns land on
// the same row (side by side) instead of one long single-file list — e.g.
// Rehoboam and Jeroboam, who both took their thrones the same year the
// kingdom split. A new row is emitted at every reign change on EITHER side;
// the side that didn't just change carries its still-reigning king forward
// as a reference rather than repeating their full card.
function pairKingdoms(judah: Person[], israel: Person[]): KingdomRow[] {
  const chronological = (a: Person, b: Person) => (b.timelineStartBc ?? 0) - (a.timelineStartBc ?? 0);
  const j = [...judah].sort(chronological);
  const i = [...israel].sort(chronological);
  const rows: KingdomRow[] = [];
  let ji = 0, ii = 0;
  let currentJudah: Person | undefined;
  let currentIsrael: Person | undefined;

  while (ji < j.length || ii < i.length) {
    const jNext = j[ji];
    const iNext = i[ii];
    if (jNext && iNext && jNext.timelineStartBc === iNext.timelineStartBc) {
      currentJudah = jNext;
      currentIsrael = iNext;
      rows.push({ key: `${jNext.id}+${iNext.id}`, yearBc: jNext.timelineStartBc as number, judah: jNext, judahIsNew: true, israel: iNext, israelIsNew: true });
      ji++; ii++;
    } else if (iNext === undefined || (jNext && (jNext.timelineStartBc as number) > (iNext.timelineStartBc as number))) {
      currentJudah = jNext;
      rows.push({ key: jNext.id, yearBc: jNext.timelineStartBc as number, judah: jNext, judahIsNew: true, israel: currentIsrael, israelIsNew: false });
      ji++;
    } else {
      currentIsrael = iNext;
      rows.push({ key: iNext.id, yearBc: iNext.timelineStartBc as number, israel: iNext, israelIsNew: true, judah: currentJudah, judahIsNew: false });
      ii++;
    }
  }
  return rows;
}

// offsetTop/offsetLeft are unaffected by CSS transforms on any ancestor
// (transform only changes paint, never layout), so walking the offsetParent
// chain gives a stable position for a card even while the whole story is
// visually scaled down by the zoom control below.
function offsetWithin(el: HTMLElement, ancestor: HTMLElement) {
  let top = 0, left = 0;
  let node: HTMLElement | null = el;
  while (node && node !== ancestor) {
    top += node.offsetTop;
    left += node.offsetLeft;
    node = node.offsetParent as HTMLElement | null;
  }
  return { top, left, width: el.offsetWidth, height: el.offsetHeight };
}

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 1;
const ZOOM_STEP = 0.1;

export function TimelineVertical({ onSelectPerson, active }: Props) {
  const { people, events, prophecyLinks, eventRefs, personBooks, loading } = useTimeline();
  const [checkedBooks, setCheckedBooks] = useState<Set<string>>(() => new Set(TIMELINE_BOOKS));
  const [showBooksLayer, setShowBooksLayer] = useState(false);
  const [showPeopleLayer, setShowPeopleLayer] = useState(true);
  const [showEventsLayer, setShowEventsLayer] = useState(true);
  const [showLinksLayer, setShowLinksLayer] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [pendingScrollKey, setPendingScrollKey] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const storyRef = useRef<HTMLDivElement>(null);
  const [linkGeoms, setLinkGeoms] = useState<{ id: string; d: string }[]>([]);
  const [naturalHeight, setNaturalHeight] = useState(0);

  const peopleById = useMemo(() => new Map(people.map(person => [person.id, person])), [people]);
  const eventsById = useMemo(() => new Map(events.map(event => [event.id, event])), [events]);
  const eventBooks = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const ref of eventRefs) {
      if (!ref.eventId) continue;
      const books = result[ref.eventId] ||= [];
      if (!books.includes(ref.book)) books.push(ref.book);
    }
    return result;
  }, [eventRefs]);
  const linksByPerson = useMemo(() => groupLinks(prophecyLinks, link => link.prophetPersonId), [prophecyLinks]);
  const linksByEvent = useMemo(() => groupLinks(prophecyLinks, link => link.fulfillmentEventId), [prophecyLinks]);
  const allBooksChecked = TIMELINE_BOOKS.every(book => checkedBooks.has(book));

  const visiblePeople = useMemo(() => {
    if (!showPeopleLayer) return [];
    return people.filter(person => {
      const books = personBooks[person.id] ?? [];
      if (!allBooksChecked && !books.some(book => checkedBooks.has(book))) return false;
      if (!deferredQuery) return true;
      const meta = TRACK_META[person.timelineTrack];
      return searchable([person.name, person.alsoKnownAs, person.description, meta?.label, ...books]).includes(deferredQuery);
    });
  }, [allBooksChecked, checkedBooks, deferredQuery, people, personBooks, showPeopleLayer]);

  const visibleEvents = useMemo(() => {
    if (!showEventsLayer) return [];
    return events.filter(event => {
      const books = eventBooks[event.id] ?? [];
      if (!allBooksChecked && !books.some(book => checkedBooks.has(book))) return false;
      if (!deferredQuery) return true;
      return searchable([event.title, event.description, event.era, ...books]).includes(deferredQuery);
    });
  }, [allBooksChecked, checkedBooks, deferredQuery, eventBooks, events, showEventsLayer]);

  const eraEntries = useMemo(() => ERAS.map(era => {
    const peopleInEra = visiblePeople.filter(person => person.timelineStartBc !== null && yearFallsInEra(person.timelineStartBc, era));
    const judahKings = peopleInEra.filter(person => person.timelineTrack === "judah_king");
    const israelKings = peopleInEra.filter(person => person.timelineTrack === "israel_king");
    // Only worth splitting into two columns once both thrones actually
    // coexist in this era — Judah-alone, for instance, has no Israel column
    // left to pair against.
    const splitKingdoms = judahKings.length > 0 && israelKings.length > 0;

    const leaderPeople = peopleInEra.filter(person => {
      if (TRACK_META[person.timelineTrack]?.family === "prophet") return false;
      if (splitKingdoms && (person.timelineTrack === "judah_king" || person.timelineTrack === "israel_king")) return false;
      return true;
    });
    const prophetPeople = peopleInEra.filter(person => TRACK_META[person.timelineTrack]?.family === "prophet");

    const peopleEntries: TimelineEntry[] = [
      ...leaderPeople.map(person => ({ key: `person-${person.id}`, kind: "person" as const, yearBc: person.timelineStartBc as number, side: "left" as const, person })),
      ...prophetPeople.map(person => ({ key: `person-${person.id}`, kind: "person" as const, yearBc: person.timelineStartBc as number, side: "right" as const, person })),
    ];

    const kingdomEntries: TimelineEntry[] = splitKingdoms
      ? pairKingdoms(judahKings, israelKings).map(row => ({ key: `kingdoms-${row.key}`, kind: "kingdoms" as const, yearBc: row.yearBc, row }))
      : [];

    const eventEntries: TimelineEntry[] = visibleEvents
      .filter(event => yearFallsInEra(event.yearBc, era))
      .map((event, index) => ({
        key: `event-${event.id}`,
        kind: "event" as const,
        yearBc: event.yearBc,
        side: index % 2 === 0 ? "right" as const : "left" as const,
        event,
      }));

    return {
      era,
      splitKingdoms,
      entries: [...peopleEntries, ...kingdomEntries, ...eventEntries].sort((a, b) => b.yearBc - a.yearBc || (a.kind === "event" ? -1 : 1)),
    };
  }), [visibleEvents, visiblePeople]);

  const resultCount = visiblePeople.length + visibleEvents.length;

  // Draws a curve for every prophecy link whose prophet AND fulfillment event
  // both currently render, so the connections are visible at a glance while
  // scrolling — not just for the one you happen to have clicked. Positions
  // are read straight off the DOM (post-filtering, post-layout) via
  // offsetWithin, which stays correct regardless of the zoom scale below
  // because it's measuring layout, not paint.
  const measureLinks = useCallback(() => {
    const story = storyRef.current;
    if (!story) return;
    let maxBottom = 0;
    const geoms: { id: string; d: string }[] = [];
    if (showLinksLayer) {
      for (const link of prophecyLinks) {
        const fromEl = document.getElementById(`tlv-person-${link.prophetPersonId}`);
        const toEl = document.getElementById(`tlv-event-${link.fulfillmentEventId}`);
        if (!fromEl || !toEl) continue;
        const a = offsetWithin(fromEl, story);
        const b = offsetWithin(toEl, story);
        const x1 = a.left + a.width / 2, y1 = a.top + a.height / 2;
        const x2 = b.left + b.width / 2, y2 = b.top + b.height / 2;
        maxBottom = Math.max(maxBottom, a.top + a.height, b.top + b.height);
        const midY = (y1 + y2) / 2;
        geoms.push({ id: link.id, d: `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}` });
      }
    }
    setLinkGeoms(geoms);
    // scrollHeight itself is unreliable to read here (observed transient
    // zero reads mid-reflow); getBoundingClientRect is measured the same
    // way as every card above and hasn't shown that flakiness.
    // Measuring `.tlv-story` itself (scrollHeight or getBoundingClientRect)
    // has shown transient zero reads in testing; each era section's own
    // bottom edge is a plainer element to measure and just as sufficient,
    // since eras render in order and the last one's bottom is the full height.
    for (const eraEl of story.querySelectorAll<HTMLElement>(".tlv-era")) {
      const rect = offsetWithin(eraEl, story);
      maxBottom = Math.max(maxBottom, rect.top + rect.height);
    }
    if (maxBottom > 0) setNaturalHeight(maxBottom);
  }, [prophecyLinks, showLinksLayer]);

  useEffect(() => {
    measureLinks();
    // A measurement taken the instant a fresh mount commits can land before
    // the browser has settled layout for newly-inserted content; one short
    // retry catches that without needing to poll indefinitely.
    const retry = window.setTimeout(measureLinks, 120);
    return () => window.clearTimeout(retry);
  }, [measureLinks, eraEntries, active]);

  useEffect(() => {
    const story = storyRef.current;
    if (!story) return;
    const observer = new ResizeObserver(() => measureLinks());
    observer.observe(story);
    return () => observer.disconnect();
  }, [measureLinks]);

  useEffect(() => {
    if (!pendingScrollKey) return;
    const frame = window.requestAnimationFrame(() => {
      const element = document.getElementById(`tlv-${pendingScrollKey}`);
      if (!element) return;
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => element.focus({ preventScroll: true }), 350);
      setFocusedKey(pendingScrollKey);
      setPendingScrollKey(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pendingScrollKey, visibleEvents, visiblePeople]);

  const toggleBook = (book: string) => setCheckedBooks(previous => {
    const next = new Set(previous);
    if (next.has(book)) next.delete(book); else next.add(book);
    return next;
  });

  const scrollToEntry = (key: string) => {
    const element = document.getElementById(`tlv-${key}`);
    if (element) {
      setFocusedKey(key);
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => element.focus({ preventScroll: true }), 350);
      return;
    }

    // A prophecy can point to an entry hidden by the current search, book
    // filter, or layer toggles. Reveal the full story before completing the
    // jump so a relationship never behaves like a dead link.
    setQuery("");
    setCheckedBooks(new Set(TIMELINE_BOOKS));
    if (key.startsWith("person-")) setShowPeopleLayer(true);
    if (key.startsWith("event-")) setShowEventsLayer(true);
    setPendingScrollKey(key);
  };

  const resetFilters = () => {
    setCheckedBooks(new Set(TIMELINE_BOOKS));
    setShowPeopleLayer(true);
    setShowEventsLayer(true);
    setQuery("");
  };

  if (loading) return <div className="loading-wrap"><div className="spinner" /></div>;
  if (people.length === 0 && events.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🕰️</div>
        <div className="empty-state-title">No timeline data</div>
        <div className="empty-state-sub">Run <code>npm run seed:timeline</code> to populate it.</div>
      </div>
    );
  }

  return (
    <div className="tlv-root">
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
        onToggleAll={checked => setCheckedBooks(checked ? new Set(TIMELINE_BOOKS) : new Set())}
        onToggleBooksLayer={() => setShowBooksLayer(value => !value)}
        onTogglePeopleLayer={() => setShowPeopleLayer(value => !value)}
        onToggleEventsLayer={() => setShowEventsLayer(value => !value)}
        onToggleLinksLayer={() => setShowLinksLayer(value => !value)}
        onZoomIn={() => setZoom(value => Math.min(ZOOM_MAX, Math.round((value + ZOOM_STEP) * 10) / 10))}
        onZoomOut={() => setZoom(value => Math.max(ZOOM_MIN, Math.round((value - ZOOM_STEP) * 10) / 10))}
        onZoomReset={() => setZoom(1)}
        open={filtersOpen}
        onToggleOpen={() => setFiltersOpen(value => !value)}
      />

      <div className="tlv-scroll">
        <section className="tlv-intro" aria-labelledby="tlv-intro-title">
          <div className="tlv-intro-copy">
            <span className="tlv-kicker">A scrollable Bible history</span>
            <h2 id="tlv-intro-title">Follow the story down through time.</h2>
            <p>Leaders and rulers are set apart from prophetic voices. Major moments connect the two as the story moves from the judges to exile and return.</p>
          </div>
          <div className="tlv-at-a-glance" aria-label="Timeline summary">
            <div><strong>{people.length}</strong><span>people</span></div>
            <div><strong>{events.length}</strong><span>turning points</span></div>
            <div><strong>{ERAS.length}</strong><span>eras</span></div>
          </div>
        </section>

        <nav className="tlv-era-nav" aria-label="Jump to an era">
          {eraEntries.map(({ era }) => (
            <button key={era.id} type="button" onClick={() => document.getElementById(`tlv-era-${era.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              {era.label}
            </button>
          ))}
        </nav>

        <div className="tlv-column-key" aria-hidden="true">
          <span>Leaders & rulers</span>
          <span>Earlier ↓ Later</span>
          <span>Prophetic voices</span>
        </div>

        {resultCount === 0 ? (
          <div className="tlv-empty-results">
            <span>No entries match these filters.</span>
            <button type="button" onClick={resetFilters}>Show the full timeline</button>
          </div>
        ) : (
          <div className="tlv-story-scaler" style={naturalHeight ? { height: naturalHeight * zoom } : undefined}>
            <div className="tlv-story" ref={storyRef} style={{ transform: `scale(${zoom})` }}>
              {linkGeoms.length > 0 && (
                <svg className="tlv-links-overlay" style={{ height: naturalHeight || undefined }} aria-hidden="true">
                  {linkGeoms.map(g => (
                    <g key={g.id}>
                      <path d={g.d} className="tlv-link-halo" />
                      <path d={g.d} className="tlv-link-line" />
                    </g>
                  ))}
                </svg>
              )}
              {eraEntries.map(({ era, entries, splitKingdoms }) => (
                <EraSection
                  key={era.id}
                  era={era}
                  entries={entries}
                  splitKingdoms={splitKingdoms}
                  checkedBooks={checkedBooks}
                  showBooksLayer={showBooksLayer}
                  focusedKey={focusedKey}
                  personBooks={personBooks}
                  eventBooks={eventBooks}
                  peopleById={peopleById}
                  eventsById={eventsById}
                  linksByPerson={linksByPerson}
                  linksByEvent={linksByEvent}
                  onSelectPerson={onSelectPerson}
                  onScrollToEntry={scrollToEntry}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EraSection({
  era,
  entries,
  splitKingdoms,
  checkedBooks,
  showBooksLayer,
  focusedKey,
  personBooks,
  eventBooks,
  peopleById,
  eventsById,
  linksByPerson,
  linksByEvent,
  onSelectPerson,
  onScrollToEntry,
}: {
  era: Era;
  entries: TimelineEntry[];
  splitKingdoms: boolean;
  checkedBooks: Set<string>;
  showBooksLayer: boolean;
  focusedKey: string | null;
  personBooks: Record<string, string[]>;
  eventBooks: Record<string, string[]>;
  peopleById: Map<string, Person>;
  eventsById: Map<string, HistoricalEvent>;
  linksByPerson: Map<string, ProphecyLink[]>;
  linksByEvent: Map<string, ProphecyLink[]>;
  onSelectPerson: (id: string) => void;
  onScrollToEntry: (key: string) => void;
}) {
  const coveringBooks = Object.entries(BOOK_COVERAGE)
    .filter(([book, coverage]) => checkedBooks.has(book) && spansOverlapEra(coverage.startBc, coverage.endBc, era));
  const firstKingdomIndex = entries.findIndex(entry => entry.kind === "kingdoms");

  return (
    <section id={`tlv-era-${era.id}`} className="tlv-era" aria-labelledby={`tlv-era-title-${era.id}`}>
      <header className="tlv-era-header">
        <div className="tlv-era-seal" aria-hidden="true"><span /></div>
        <div>
          <span>{era.years}</span>
          <h3 id={`tlv-era-title-${era.id}`}>{era.label}</h3>
          <p>{era.summary}</p>
        </div>
      </header>

      {showBooksLayer && coveringBooks.length > 0 && (
        <div className="tlv-book-band" aria-label={`Books covering ${era.label}`}>
          <span className="tlv-book-band-label">Books covering this era</span>
          <div>
            {coveringBooks.map(([book, coverage]) => (
              <span key={book} className="tlv-book-ribbon" title={coverage.note}>{book}<small>{formatYearSpan(coverage.startBc, coverage.endBc)}</small></span>
            ))}
          </div>
        </div>
      )}

      <div className="tlv-era-flow">
        {entries.length === 0 ? (
          <div className="tlv-era-empty">No matching entries in this era</div>
        ) : entries.map((entry, index) => (
          <div key={entry.key}>
            {splitKingdoms && index === firstKingdomIndex && (
              <div className="tlv-kingdom-split-label" aria-hidden="true">
                <span>Judah</span>
                <span>Israel</span>
              </div>
            )}
            <div className={`tlv-row${entry.kind === "kingdoms" ? " tlv-row-kingdoms" : ""}`}>
              {entry.kind === "person" ? (
                <PersonCard
                  person={entry.person}
                  side={entry.side}
                  books={personBooks[entry.person.id] ?? []}
                  links={linksByPerson.get(entry.person.id) ?? []}
                  eventsById={eventsById}
                  focused={focusedKey === entry.key}
                  onViewProfile={() => onSelectPerson(entry.person.id)}
                  onScrollToEvent={id => onScrollToEntry(`event-${id}`)}
                />
              ) : entry.kind === "kingdoms" ? (
                <>
                  {entry.row.judah && (
                    <PersonCard
                      person={entry.row.judah}
                      side="left"
                      variant={entry.row.judahIsNew ? "full" : "continues"}
                      books={personBooks[entry.row.judah.id] ?? []}
                      links={linksByPerson.get(entry.row.judah.id) ?? []}
                      eventsById={eventsById}
                      focused={focusedKey === `person-${entry.row.judah.id}`}
                      onViewProfile={() => onSelectPerson(entry.row.judah!.id)}
                      onScrollToEvent={id => onScrollToEntry(`event-${id}`)}
                    />
                  )}
                  {entry.row.israel && (
                    <PersonCard
                      person={entry.row.israel}
                      side="right"
                      variant={entry.row.israelIsNew ? "full" : "continues"}
                      books={personBooks[entry.row.israel.id] ?? []}
                      links={linksByPerson.get(entry.row.israel.id) ?? []}
                      eventsById={eventsById}
                      focused={focusedKey === `person-${entry.row.israel.id}`}
                      onViewProfile={() => onSelectPerson(entry.row.israel!.id)}
                      onScrollToEvent={id => onScrollToEntry(`event-${id}`)}
                    />
                  )}
                </>
              ) : (
                <EventCard
                  event={entry.event}
                  side={entry.side}
                  books={eventBooks[entry.event.id] ?? []}
                  links={linksByEvent.get(entry.event.id) ?? []}
                  peopleById={peopleById}
                  focused={focusedKey === entry.key}
                  onScrollToProphet={id => onScrollToEntry(`person-${id}`)}
                />
              )}
              <div className={`tlv-axis-point ${entry.kind === "kingdoms" ? "person" : entry.kind}`} aria-hidden="true">
                <span className="tlv-axis-dot" />
                <span className="tlv-axis-year">{formatYear(entry.yearBc)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PersonCard({ person, side, books, links, eventsById, focused, onViewProfile, onScrollToEvent, variant = "full" }: {
  person: Person;
  side: "left" | "right";
  books: string[];
  links: ProphecyLink[];
  eventsById: Map<string, HistoricalEvent>;
  focused: boolean;
  onViewProfile: () => void;
  onScrollToEvent: (id: string) => void;
  variant?: "full" | "continues";
}) {
  const meta = TRACK_META[person.timelineTrack] ?? { label: "Timeline figure", family: "leader" as const, color: "var(--accent)" };
  const style = { "--tlv-accent": meta.color } as CSSProperties;

  // A king still on the throne while the OTHER kingdom's changed hands gets a
  // condensed reference rather than a repeated full card — the full card (and
  // its DOM id, which links and jump-to-scroll target) lives only at the row
  // where they actually took power.
  if (variant === "continues") {
    return (
      <article tabIndex={-1} className={`tlv-card tlv-person-card tlv-card-continues ${side}${focused ? " focused" : ""}`} style={style}>
        <div className="tlv-card-topline"><span className="tlv-role">{meta.label} · still reigning</span></div>
        <h4>{person.name}</h4>
        <div className="tlv-card-years">{formatSpan(person.timelineStartBc, person.timelineEndBc)}</div>
      </article>
    );
  }

  return (
    <article id={`tlv-person-${person.id}`} tabIndex={-1} className={`tlv-card tlv-person-card ${side}${focused ? " focused" : ""}`} style={style}>
      <div className="tlv-card-topline">
        <span className="tlv-role">{meta.label}</span>
        {person.dateConfidence === "uncertain" && <span className="tlv-confidence" title={person.dateUncertaintyNote}>Dates approximate</span>}
      </div>
      <h4>{person.name}</h4>
      {person.alsoKnownAs && <div className="tlv-alias">Also known as {person.alsoKnownAs}</div>}
      <div className="tlv-card-years">{formatSpan(person.timelineStartBc, person.timelineEndBc)}</div>
      {person.description && <p className="tlv-description">{summarizeDescription(person.description)}</p>}
      <BookChips books={books} />
      {links.map(link => {
        const event = eventsById.get(link.fulfillmentEventId);
        return (
          <button key={link.id} type="button" className="tlv-prophecy-link" onClick={() => onScrollToEvent(link.fulfillmentEventId)}>
            <span>Prophecy → {event?.title ?? "fulfillment"}</span>
            <small>{formatProphecyRef(link)}</small>
            <em>{link.explanation}</em>
          </button>
        );
      })}
      <button type="button" className="tlv-profile-link" onClick={onViewProfile}>Open full profile <span aria-hidden="true">→</span></button>
    </article>
  );
}

function EventCard({ event, side, books, links, peopleById, focused, onScrollToProphet }: {
  event: HistoricalEvent;
  side: "left" | "right";
  books: string[];
  links: ProphecyLink[];
  peopleById: Map<string, Person>;
  focused: boolean;
  onScrollToProphet: (id: string) => void;
}) {
  return (
    <article id={`tlv-event-${event.id}`} tabIndex={-1} className={`tlv-card tlv-event-card ${side}${focused ? " focused" : ""}`}>
      <div className="tlv-card-topline"><span className="tlv-role">Turning point</span><span className="tlv-event-era">{event.era}</span></div>
      <h4>{event.title}</h4>
      <div className="tlv-card-years">{formatYear(event.yearBc)}</div>
      {event.description && <p className="tlv-description">{event.description}</p>}
      {event.dateUncertaintyNote && <p className="tlv-date-note">{event.dateUncertaintyNote}</p>}
      <BookChips books={books} />
      {links.map(link => {
        const prophet = peopleById.get(link.prophetPersonId);
        return (
          <button key={link.id} type="button" className="tlv-prophecy-link" onClick={() => onScrollToProphet(link.prophetPersonId)}>
            <span>Foretold by {prophet?.name ?? "a prophet"}</span>
            <small>{formatProphecyRef(link)}</small>
            <em>{link.explanation}</em>
          </button>
        );
      })}
    </article>
  );
}

function BookChips({ books }: { books: string[] }) {
  const visible = books.slice(0, 5);
  if (visible.length === 0) return null;
  return (
    <div className="tlv-book-chips" aria-label="Mentioned in">
      {visible.map(book => <span key={book}>{book}</span>)}
      {books.length > visible.length && <span>+{books.length - visible.length}</span>}
    </div>
  );
}

function groupLinks(links: ProphecyLink[], keyFor: (link: ProphecyLink) => string) {
  const grouped = new Map<string, ProphecyLink[]>();
  for (const link of links) {
    const key = keyFor(link);
    const group = grouped.get(key) ?? [];
    group.push(link);
    grouped.set(key, group);
  }
  return grouped;
}

function searchable(values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ").toLowerCase();
}

function yearFallsInEra(yearBc: number, era: Era) {
  return yearBc <= era.startBc && yearBc >= era.endBc;
}

function spansOverlapEra(startBc: number, endBc: number, era: Era) {
  return startBc >= era.endBc && endBc <= era.startBc;
}

function formatSpan(startBc: number | null, endBc: number | null) {
  if (startBc === null || endBc === null) return "Dates not recorded";
  return formatYearSpan(startBc, endBc);
}

function summarizeDescription(description: string, maxLength = 300) {
  if (description.length <= maxLength) return description;
  const excerpt = description.slice(0, maxLength);
  const sentenceEnd = excerpt.lastIndexOf(".");
  const cleanEnd = sentenceEnd >= Math.floor(maxLength * 0.55) ? sentenceEnd + 1 : maxLength;
  return `${excerpt.slice(0, cleanEnd).trim()}…`;
}

function formatProphecyRef(link: ProphecyLink): string {
  const sameChapter = link.prophecyChapterStart === link.prophecyChapterEnd;
  if (sameChapter && link.prophecyVerseStart === link.prophecyVerseEnd) {
    return `${link.prophecyBook} ${link.prophecyChapterStart}:${link.prophecyVerseStart}`;
  }
  if (sameChapter) return `${link.prophecyBook} ${link.prophecyChapterStart}:${link.prophecyVerseStart}–${link.prophecyVerseEnd}`;
  return `${link.prophecyBook} ${link.prophecyChapterStart}:${link.prophecyVerseStart} – ${link.prophecyChapterEnd}:${link.prophecyVerseEnd}`;
}
