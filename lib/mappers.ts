import { GENDERS, TESTAMENTS, RELATIONSHIP_LABELS } from "./types";
import type {
  Person, Relationship, ScriptureRef, RelationshipType, HistoricalEvent, ProphecyLink,
  Tradition, TraditionEdge, TraditionPerson,
} from "./types";

export function formatRef(r: ScriptureRef): string {
  const same = r.chapterStart === r.chapterEnd;
  if (same && r.verseStart === r.verseEnd) return `${r.book} ${r.chapterStart}:${r.verseStart}`;
  if (same) return `${r.book} ${r.chapterStart}:${r.verseStart}–${r.verseEnd}`;
  return `${r.book} ${r.chapterStart}:${r.verseStart} – ${r.chapterEnd}:${r.verseEnd}`;
}

// formatRef uses en-dashes and spaces for display; Bible Gateway's search
// parser wants a plain ASCII hyphen and no padding, so the link needs its own
// string rather than a cleaned-up version of the visible label.
export function bibleGatewayUrl(r: ScriptureRef, version = "NIV"): string {
  const same = r.chapterStart === r.chapterEnd;
  const passage =
    same && r.verseStart === r.verseEnd
      ? `${r.book} ${r.chapterStart}:${r.verseStart}`
      : same
      ? `${r.book} ${r.chapterStart}:${r.verseStart}-${r.verseEnd}`
      : `${r.book} ${r.chapterStart}:${r.verseStart}-${r.chapterEnd}:${r.verseEnd}`;
  return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(passage)}&version=${version}`;
}

// A person "appears in" a chapter when the chapter falls anywhere inside the
// reference's span, not just where it starts — Jacob's Genesis 37–50 reference
// has to surface him in chapter 42 as well as 37.
export function refCoversChapter(r: ScriptureRef, chapter: number): boolean {
  return r.chapterStart <= chapter && r.chapterEnd >= chapter;
}

// Rejects unknown gender/testament values at the API boundary — this is how
// the "adversary_of" relationship-type bug happened: a seed script wrote a
// value the app's type union didn't know about, and it silently fell back to
// a raw label + gray color instead of failing loudly.
export function validatePersonFields(body: { gender?: string; testament?: string }): string | null {
  if (body.gender !== undefined && !(GENDERS as readonly string[]).includes(body.gender)) {
    return `Invalid gender: ${body.gender}`;
  }
  if (body.testament !== undefined && !(TESTAMENTS as readonly string[]).includes(body.testament)) {
    return `Invalid testament: ${body.testament}`;
  }
  return null;
}

export function validateRelationshipType(type: string): string | null {
  if (!(type in RELATIONSHIP_LABELS)) return `Invalid relationship type: ${type}`;
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function personFromDb(r: any): Person {
  return {
    id:          r.id,
    name:        r.name,
    alsoKnownAs: r.also_known_as ?? "",
    gender:      r.gender ?? "unknown",
    testament:   r.testament ?? "OT",
    birthYear:   r.birth_year ?? "",
    deathYear:   r.death_year ?? "",
    description: r.description ?? "",
    tags:        (() => { try { return JSON.parse(r.tags ?? "[]"); } catch { return []; } })(),
    createdAt:   r.created_at,
    timelineStartBc:     r.timeline_start_bc ?? null,
    timelineEndBc:       r.timeline_end_bc ?? null,
    timelineTrack:       r.timeline_track ?? "",
    dateUncertaintyNote: r.date_uncertainty_note ?? "",
    dateConfidence:      r.date_confidence ?? "firm",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function personToDb(p: Person): unknown[] {
  return [
    p.id, p.name, p.alsoKnownAs ?? "", p.gender ?? "unknown",
    p.testament ?? "OT", p.birthYear ?? "", p.deathYear ?? "",
    p.description ?? "", JSON.stringify(p.tags ?? []), p.createdAt,
  ];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function relationshipFromDb(r: any): Relationship {
  return {
    id:           r.id,
    personAId:    r.person_a_id,
    personAName:  r.person_a_name ?? "",
    type:         r.type as RelationshipType,
    personBId:    r.person_b_id,
    personBName:  r.person_b_name ?? "",
    notes:        r.notes ?? "",
    createdAt:    r.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function scriptureRefFromDb(r: any): ScriptureRef {
  return {
    id:           r.id,
    personId:     r.person_id,
    book:         r.book,
    chapterStart: r.chapter_start ?? 1,
    verseStart:   r.verse_start ?? 1,
    chapterEnd:   r.chapter_end ?? 1,
    verseEnd:     r.verse_end ?? 1,
    note:         r.note ?? "",
    createdAt:    r.created_at,
    eventId:      r.event_id ?? null,
  };
}

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
    uncertaintyNote:        r.uncertainty_note ?? "",
    createdAt:              r.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function traditionFromDb(r: any): Tradition {
  return {
    id:                  r.id,
    name:                r.name,
    alsoKnownAs:         r.also_known_as ?? "",
    kind:                r.kind ?? "denomination",
    tier:                r.tier ?? 3,
    startYear:           r.start_year,
    endYear:             r.end_year ?? null,
    region:              r.region ?? "",
    description:         r.description ?? "",
    distinctives:        r.distinctives ?? "",
    adherents:           r.adherents ?? "",
    dateUncertaintyNote: r.date_uncertainty_note ?? "",
    dateConfidence:      r.date_confidence ?? "firm",
    createdAt:           r.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function traditionEdgeFromDb(r: any): TraditionEdge {
  return {
    id:        r.id,
    parentId:  r.parent_id,
    childId:   r.child_id,
    type:      r.type ?? "split_from",
    year:      r.year,
    eventId:   r.event_id ?? null,
    notes:     r.notes ?? "",
    createdAt: r.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function traditionPersonFromDb(r: any): TraditionPerson {
  return {
    id:           r.id,
    traditionId:  r.tradition_id,
    personId:     r.person_id,
    role:         r.role ?? "key_figure",
    notes:        r.notes ?? "",
    createdAt:    r.created_at,
  };
}

// Parses a search box query as a scripture reference: "genesis 38",
// "2 kings 18", "gen 38", "1 sam" or just "judges".
//
// Returns null when the query is not a reference, so the caller can fall back
// to ordinary name/description searching. A bare number returns null too —
// "38" alone names no book, and guessing one would be worse than no match.
//
// `books` is passed in rather than imported so this stays a pure function.
export function parseReferenceQuery(
  query: string,
  books: { name: string; abbrev: string }[],
): { book: string; chapter: number | null } | null {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!q) return null;

  // Split a trailing chapter number off the end, tolerating "38:1" since
  // people paste whole references.
  const m = q.match(/^(.*?)[\s.]*(\d{1,3})(?::\d{1,3})?$/);
  const bookPart = (m ? m[1] : q).trim().replace(/[.,]$/, "");
  const chapter = m ? Number(m[2]) : null;
  if (!bookPart) return null;

  // Longest name first so "1 samuel" cannot be claimed by a shorter book whose
  // name is a prefix of it (Judges vs Jude, for one).
  const candidates = [...books].sort((a, b) => b.name.length - a.name.length);
  const exact = candidates.find(b => b.name.toLowerCase() === bookPart);
  const byAbbrev = candidates.find(b => b.abbrev.toLowerCase() === bookPart);
  const byPrefix = candidates.find(b => b.name.toLowerCase().startsWith(bookPart));
  const book = exact ?? byAbbrev ?? byPrefix;
  if (!book) return null;

  return { book: book.name, chapter: chapter && chapter > 0 ? chapter : null };
}
