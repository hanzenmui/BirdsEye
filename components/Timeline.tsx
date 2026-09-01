"use client";

import { useDeferredValue, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useTimeline } from "@/hooks/useTimeline";
import { BOOK_COVERAGE } from "@/lib/types";
import type { HistoricalEvent, Person, ProphecyLink } from "@/lib/types";
import { TimelineFilters, TIMELINE_BOOKS } from "./TimelineFilters";

interface Props {
  onSelectPerson: (id: string) => void;
}

interface Era {
  id: string;
  label: string;
  years: string;
  startBc: number;
  endBc: number;
  summary: string;
}

const ERAS: Era[] = [
  { id: "judges", label: "Settlement & Judges", years: "c. 1400–1051 BC", startBc: 1500, endBc: 1051, summary: "Israel settles in the land and repeatedly turns from oppression to rescue." },
  { id: "united", label: "The United Kingdom", years: "1050–932 BC", startBc: 1050, endBc: 932, summary: "Saul, David, and Solomon rule one kingdom, and Jerusalem becomes its center." },
  { id: "divided", label: "The Divided Kingdom", years: "931–723 BC", startBc: 931, endBc: 723, summary: "Israel divides north and south while prophets confront both kingdoms." },
  { id: "judah-alone", label: "Judah Stands Alone", years: "722–587 BC", startBc: 722, endBc: 587, summary: "After Israel falls to Assyria, Judah faces reform, warning, and Babylon." },
  { id: "exile-return", label: "Exile & Return", years: "586–350 BC", startBc: 586, endBc: 350, summary: "Jerusalem falls, the people live in exile, and a remnant returns to rebuild." },
];

const TRACK_META: Record<string, { label: string; family: "leader" | "prophet"; color: string }> = {
  judge: { label: "Judge", family: "leader", color: "var(--tl-judge-1)" },
  united_king: { label: "King of united Israel", family: "leader", color: "var(--tl-united-1)" },
  judah_king: { label: "King of Judah", family: "leader", color: "var(--tl-judah-2)" },
  israel_king: { label: "King of Israel", family: "leader", color: "var(--tl-israel-1)" },
  major_prophet: { label: "Major prophet", family: "prophet", color: "var(--tl-major-prophet-1)" },
  minor_prophet: { label: "Minor prophet", family: "prophet", color: "var(--tl-minor-prophet-1)" },
};

type TimelineEntry =
  | { key: string; kind: "person"; yearBc: number; side: "left" | "right"; person: Person }
  | { key: string; kind: "event"; yearBc: number; side: "left" | "right"; event: HistoricalEvent };

export function Timeline({ onSelectPerson }: Props) {
  const { people, events, prophecyLinks, eventRefs, personBooks, loading } = useTimeline();
  const [checkedBooks, setCheckedBooks] = useState<Set<string>>(() => new Set(TIMELINE_BOOKS));
  const [showBooksLayer, setShowBooksLayer] = useState(false);
  const [showPeopleLayer, setShowPeopleLayer] = useState(true);
  const [showEventsLayer, setShowEventsLayer] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [pendingScrollKey, setPendingScrollKey] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

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
    const peopleEntries: TimelineEntry[] = visiblePeople
      .filter(person => person.timelineStartBc !== null && yearFallsInEra(person.timelineStartBc, era))
      .map(person => ({
        key: `person-${person.id}`,
        kind: "person",
        yearBc: person.timelineStartBc as number,
        side: TRACK_META[person.timelineTrack]?.family === "prophet" ? "right" : "left",
        person,
      }));
    const eventEntries: TimelineEntry[] = visibleEvents
      .filter(event => yearFallsInEra(event.yearBc, era))
      .map((event, index) => ({
        key: `event-${event.id}`,
        kind: "event",
        yearBc: event.yearBc,
        side: index % 2 === 0 ? "right" : "left",
        event,
      }));
    return {
      era,
      entries: [...peopleEntries, ...eventEntries].sort((a, b) => b.yearBc - a.yearBc || (a.kind === "event" ? -1 : 1)),
    };
  }), [visibleEvents, visiblePeople]);

  const resultCount = visiblePeople.length + visibleEvents.length;

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
        query={query}
        resultCount={resultCount}
        onQueryChange={setQuery}
        onToggleBook={toggleBook}
        onToggleAll={checked => setCheckedBooks(checked ? new Set(TIMELINE_BOOKS) : new Set())}
        onToggleBooksLayer={() => setShowBooksLayer(value => !value)}
        onTogglePeopleLayer={() => setShowPeopleLayer(value => !value)}
        onToggleEventsLayer={() => setShowEventsLayer(value => !value)}
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
          <div className="tlv-story">
            {eraEntries.map(({ era, entries }) => (
              <EraSection
                key={era.id}
                era={era}
                entries={entries}
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
        )}
      </div>
    </div>
  );
}

function EraSection({
  era,
  entries,
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
              <span key={book} className="tlv-book-ribbon" title={coverage.note}>{book}<small>{coverage.startBc}–{coverage.endBc} BC</small></span>
            ))}
          </div>
        </div>
      )}

      <div className="tlv-era-flow">
        {entries.length === 0 ? (
          <div className="tlv-era-empty">No matching entries in this era</div>
        ) : entries.map(entry => (
          <div key={entry.key} className="tlv-row">
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
            <div className={`tlv-axis-point ${entry.kind}`} aria-hidden="true">
              <span className="tlv-axis-dot" />
              <span className="tlv-axis-year">{entry.yearBc} BC</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PersonCard({ person, side, books, links, eventsById, focused, onViewProfile, onScrollToEvent }: {
  person: Person;
  side: "left" | "right";
  books: string[];
  links: ProphecyLink[];
  eventsById: Map<string, HistoricalEvent>;
  focused: boolean;
  onViewProfile: () => void;
  onScrollToEvent: (id: string) => void;
}) {
  const meta = TRACK_META[person.timelineTrack] ?? { label: "Timeline figure", family: "leader" as const, color: "var(--accent)" };
  const style = { "--tlv-accent": meta.color } as CSSProperties;
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
      <div className="tlv-card-years">{event.yearBc} BC</div>
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
  if (startBc === endBc) return `${startBc} BC`;
  return `${startBc}–${endBc} BC`;
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
