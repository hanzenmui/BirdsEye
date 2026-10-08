import { refCoversChapter } from "./mappers";
import type { Person, Relationship, ScriptureRef } from "./types";

const FAMILY_TYPES = new Set(["parent_of", "child_of", "spouse_of", "sibling_of", "ancestor_of", "descendant_of"]);

export function chapterStudy(people: Person[], relationships: Relationship[], refs: ScriptureRef[], book: string, chapter: number) {
  const relevantRefs = refs.filter(r => r.book === book && refCoversChapter(r, chapter));
  const memberIds = new Set(relevantRefs.map(r => r.personId));
  const directIds = new Set(relevantRefs.filter(r => r.chapterStart === chapter).map(r => r.personId));
  const members = people.filter(p => memberIds.has(p.id));
  const knownIds = new Set(members.map(p => p.id));
  const connections = relationships.filter(r => knownIds.has(r.personAId) && knownIds.has(r.personBId));
  const family = connections.filter(r => FAMILY_TYPES.has(r.type));
  // The opening diagram is a preview, not an unreadably shrunken full graph.
  // Prefer a connected group, then include every remaining name in the roster.
  const previewIds = new Set<string>();
  const ranked = [...family].sort((a, b) =>
    Number(directIds.has(b.personAId)) + Number(directIds.has(b.personBId))
    - Number(directIds.has(a.personAId)) - Number(directIds.has(a.personBId)));
  for (const rel of ranked) {
    const newIds = [rel.personAId, rel.personBId].filter(id => !previewIds.has(id));
    if (previewIds.size + newIds.length <= 12) newIds.forEach(id => previewIds.add(id));
  }
  return { members, memberIds: knownIds, directIds, connections, family, previewIds };
}
