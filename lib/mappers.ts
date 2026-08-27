import { GENDERS, TESTAMENTS, RELATIONSHIP_LABELS } from "./types";
import type { Person, Relationship, ScriptureRef, RelationshipType, HistoricalEvent, ProphecyLink } from "./types";

export function formatRef(r: ScriptureRef): string {
  const same = r.chapterStart === r.chapterEnd;
  if (same && r.verseStart === r.verseEnd) return `${r.book} ${r.chapterStart}:${r.verseStart}`;
  if (same) return `${r.book} ${r.chapterStart}:${r.verseStart}–${r.verseEnd}`;
  return `${r.book} ${r.chapterStart}:${r.verseStart} – ${r.chapterEnd}:${r.verseEnd}`;
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
    createdAt:              r.created_at,
  };
}
