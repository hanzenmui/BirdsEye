import assert from "node:assert/strict";
import { chapterStudy } from "../lib/chapter-study";
import type { Person, Relationship, ScriptureRef } from "../lib/types";
const people = ["father", "child", "mother", "isolated", "outside"].map(id => ({ id, name: id } as Person));
const refs = [
  { personId: "father", book: "Genesis", chapterStart: 1, chapterEnd: 4 },
  { personId: "child", book: "Genesis", chapterStart: 3, chapterEnd: 3 },
  { personId: "mother", book: "Genesis", chapterStart: 3, chapterEnd: 4 },
  { personId: "isolated", book: "Genesis", chapterStart: 3, chapterEnd: 3 },
  { personId: "outside", book: "Genesis", chapterStart: 5, chapterEnd: 5 },
  { personId: "outside", book: "Exodus", chapterStart: 3, chapterEnd: 3 },
] as ScriptureRef[];
const rels = [
  { personAId: "father", personBId: "child", type: "parent_of" },
  { personAId: "mother", personBId: "child", type: "parent_of" },
  { personAId: "child", personBId: "isolated", type: "ally_of" },
  { personAId: "outside", personBId: "child", type: "parent_of" },
] as Relationship[];
const result = chapterStudy(people, rels, refs, "Genesis", 3);
assert.deepEqual(result.memberIds, new Set(["father", "child", "mother", "isolated"]));
assert.deepEqual(result.directIds, new Set(["child", "mother", "isolated"]));
assert.equal(result.connections.length, 3);
assert.equal(result.family.length, 2);
assert.deepEqual(result.previewIds, new Set(["mother", "child", "father"]));
assert.equal(chapterStudy(people, rels, refs, "Genesis", 20).members.length, 0);
const large = Array.from({ length: 30 }, (_, i) => ({ id: String(i), name: String(i) } as Person));
const largeRefs = large.map(p => ({ personId: p.id, book: "Ruth", chapterStart: 1, chapterEnd: 1 } as ScriptureRef));
const largeRels = large.slice(1).map((p, i) => ({ personAId: large[i].id, personBId: p.id, type: "parent_of" } as Relationship));
const big = chapterStudy(large, largeRels, largeRefs, "Ruth", 1);
assert.equal(big.members.length, 30, "The roster never loses people to the preview cap");
assert.ok(big.previewIds.size <= 12);
console.log("Chapter study checks passed: chapter-scoped roster, broad-range distinction, connected preview cap, isolated people and cross-book exclusion.");
