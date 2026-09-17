// No database access: checks the filtered graph and browser-history updates.
import assert from "node:assert/strict";
import { buildForest } from "../components/FamilyTree";
import { navigate } from "../hooks/useQueryState";
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

let href = "http://localhost/explore?book=Genesis&chapter=38";
const entries = [href];
let changeCount = 0;
Object.defineProperty(globalThis, "window", { configurable: true, value: {
  location: { get href() { return href; } },
  history: {
    pushState(_state: unknown, _unused: string, url: URL) { href = String(url); entries.push(href); },
    replaceState(_state: unknown, _unused: string, url: URL) { href = String(url); entries[entries.length - 1] = href; },
  },
  dispatchEvent() { changeCount++; },
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
console.log("Reading workflow checks passed: complete filtered forest, standalone names, navigation and return context.");
