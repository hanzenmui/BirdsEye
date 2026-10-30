// Pure view-data regression checks. No environment, network, or database.
import assert from "node:assert/strict";
import { withCurrentRelationshipNames } from "../lib/mappers";
import type { Relationship } from "../lib/types";

const parent: Relationship = Object.freeze({
  id: "parent-link", personAId: "parent", personAName: "Old parent name",
  personBId: "child", personBName: "Old child name", type: "parent_of",
  notes: "Keep the relationship itself unchanged", createdAt: "fixture",
});
const unknown: Relationship = Object.freeze({
  ...parent, id: "unloaded-link", personAId: "unloaded", personAName: "Saved fallback",
});
const links = Object.freeze([parent, unknown]);
const people = Object.freeze([
  Object.freeze({ id: "parent", name: "Current parent name" }),
  Object.freeze({ id: "child", name: "Current child name" }),
  Object.freeze({ id: "unrelated", name: "Old parent name" }),
]);
const result = withCurrentRelationshipNames(links, people);
assert.equal(result[0].personAName, "Current parent name");
assert.equal(result[0].personBName, "Current child name", "Both ends use the latest names");
assert.equal(result[1].personAName, "Saved fallback", "Missing people keep their saved display name");
assert.equal(result[1].personBName, "Current child name");
assert.deepEqual(result.map(link => link.id), links.map(link => link.id), "Link count and order stay unchanged");
assert.deepEqual(result[0], { ...parent, personAName: "Current parent name", personBName: "Current child name" });
assert.equal(parent.personAName, "Old parent name", "Source records are never mutated");
assert.equal(parent.personBName, "Old child name");
assert.equal(withCurrentRelationshipNames(links, [])[0], parent, "Unchanged links retain their identity");
assert.equal(withCurrentRelationshipNames(result, people)[0], result[0]);
const repeatedName = withCurrentRelationshipNames([parent], [{ id: "parent", name: "Same name" }, { id: "child", name: "Same name" }]);
assert.equal(repeatedName[0].personAId, "parent");
assert.equal(repeatedName[0].personBId, "child", "Names do not merge people or change the link target");
assert.equal(withCurrentRelationshipNames([parent], [{ id: "parent", name: "Élie — renamed" }])[0].personAName, "Élie — renamed");
assert.deepEqual(withCurrentRelationshipNames([], people), []);
console.log("Relationship name checks passed: immediate names at both ends, stable IDs/order/metadata, missing-person fallbacks, duplicate names, Unicode, and immutable source data.");
