import type { Person, Relationship, ScriptureRef, RelationshipType } from "./types";

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
  };
}
