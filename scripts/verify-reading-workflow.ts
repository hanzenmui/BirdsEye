// No database access: checks the filtered graph and browser-history updates.
import assert from "node:assert/strict";
import { buildForest, buildLayout } from "../components/FamilyTree";
import { navigate } from "../hooks/useQueryState";
import { requestEventFocus, readEventFocus, consumeEventFocus } from "../lib/nav-bus";
import type { Person, Relationship } from "../lib/types";

const person = (id: string, gender: Person["gender"] = "male") => ({ id, name: id, gender } as Person);
const people = [person("father"), person("child"), person("mother", "female"), person("unconnected"), person("outside")];
const rels = [
  { personAId: "father", personBId: "child", type: "parent_of" },
  { personAId: "mother", personBId: "child", type: "parent_of" },
  { personAId: "outside", personBId: "father", type: "parent_of" },
] as Relationship[];
const members = new Set(["father", "child", "mother", "unconnected"]);
const forest = buildForest(people, rels, members);
assert.deepEqual(new Set(forest.all.map(p => p.id)), members, "Every name, including isolated people, must have a position");
assert.equal(forest.all.length, members.size, "No duplicate people from multiple parents");
assert.ok(forest.all.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
assert.equal(buildForest(people, rels, new Set()).all.length, 0);
assert.equal(buildForest(people, rels, new Set(["child"])).all.length, 1);

const generations = ["ancestor", "parent", "child", "grandchild", "great-grandchild"].map(id => person(id));
const chain = generations.slice(1).map((p, i) => ({ personAId: generations[i].id, personBId: p.id, type: "parent_of" })) as Relationship[];
const nearby = buildLayout(generations, chain, "ancestor", 2);
assert.deepEqual(new Set(nearby?.all.map(p => p.id)), new Set(["ancestor", "parent", "child"]), "Nearby view shows exactly three generations");
assert.equal(buildLayout(generations, chain, "ancestor")?.all.length, 5, "Whole tree keeps all generations");
assert.deepEqual(new Set(buildLayout(generations, chain, "child", 2)?.all.map(p => p.id)), new Set(["child", "grandchild", "great-grandchild"]), "Continuing a branch reveals the next generations");

let href = "http://localhost/explore?book=Genesis&chapter=38";
const entries = [href];
let changeCount = 0;
const stored = new Map<string, string>();
Object.defineProperty(globalThis, "window", { configurable: true, value: {
  location: { get href() { return href; } },
  history: {
    pushState(_state: unknown, _unused: string, url: URL) { href = String(url); entries.push(href); },
    replaceState(_state: unknown, _unused: string, url: URL) { href = String(url); entries[entries.length - 1] = href; },
  },
  dispatchEvent() { changeCount++; },
  localStorage: { setItem(key: string, value: string) { stored.set(key, value); }, getItem(key: string) { return stored.get(key) ?? null; }, removeItem(key: string) { stored.delete(key); } },
} });
navigate({ section: "people", person: "judah", return: "books" });
let params = new URL(href).searchParams;
assert.equal(params.get("book"), "Genesis");
assert.equal(params.get("chapter"), "38");
assert.equal(params.get("person"), "judah");
assert.equal(entries.length, 2, "Opening a profile is one Back step");
navigate({ section: "people", person: "judah", return: "books" });
assert.equal(entries.length, 2, "Repeated navigation does not add duplicate history");
navigate({ peopleQuery: "Judah" }, true);
assert.equal(entries.length, 2, "Typing does not flood browser history");
navigate({ section: "books", person: null });
params = new URL(href).searchParams;
assert.equal(params.get("person"), null);
assert.equal(params.get("chapter"), "38");
assert.equal(changeCount, 3);
requestEventFocus("kingdom-splits", "everything");
assert.equal(new URL(href).searchParams.get("timelineAct"), "everything", "Chapter events must not be forced into church history");
assert.equal(readEventFocus()?.id, "kingdom-splits");
assert.equal(consumeEventFocus()?.id, "kingdom-splits");
assert.equal(readEventFocus(), null, "A completed jump cannot replay on a later mount");
requestEventFocus("great-schism");
assert.equal(new URL(href).searchParams.get("timelineAct"), "after-nt", "Tradition event jumps preserve their existing default");
console.log("Reading workflow checks passed: complete filtered forest, nearby/whole-tree generations, standalone names, navigation and return context.");
