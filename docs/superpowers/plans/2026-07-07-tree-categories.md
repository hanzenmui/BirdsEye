# Family Tree Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a category browser in front of the Family Tree so users can scope the view to a specific curated family (e.g. Abraham's Family) or a specific book's cast (e.g. Genesis), instead of always seeing the full Adam-rooted tree — fixing the "too crowded / too small to read" problem on mobile.

**Architecture:** A new pure layout function `buildForest` (sibling to the existing `buildLayout` in `components/FamilyTree.tsx`) lays out a member-restricted set of people as one or more independent mini-trees side by side, reusing the exact same per-tree recursion `buildLayout` already uses. `FamilyTree` gains one new optional `scope` prop that switches it from `buildLayout` to `buildForest` and hides/disables the UI that doesn't make sense once scoped (root-picker, book-filter, re-rooting). A new `TreeCategoryPicker` component drives a 2-step drill-down (category type → subcategory) and mounts `FamilyTree` with the right `scope` once a subcategory is picked.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, no CSS framework (hand-written `app/globals.css` with CSS custom properties). No test runner is configured in this project (no Jest/Vitest) — verification for pure functions uses standalone `tsx` fixture scripts (the same tool the project's seed scripts already use), and UI verification is manual via the dev server.

## Global Constraints

- Groups (Jesus + disciples, Paul + companions) are explicitly out of scope for this plan — deferred to a future spec.
- No new dependencies, no test framework introduced.
- `FamilyTree`'s existing unscoped ("All") behavior must remain byte-for-byte unchanged when `scope` is omitted.
- Follow existing code conventions in this file: inline `style={{...}}` objects for one-off positioning (as already used throughout `FamilyTree.tsx`), CSS classes (`app/globals.css`) for anything reused across multiple elements.

---

### Task 1: `lib/families.ts` — curated family data + name resolver

**Files:**
- Create: `lib/families.ts`
- Test (throwaway, deleted before commit): `scripts/dev-check-families.ts`

**Interfaces:**
- Produces: `interface FamilyMember { name: string; akaHint?: string }`, `interface FamilyCategory { key: string; label: string; members: FamilyMember[] }`, `export const FAMILIES: FamilyCategory[]`, `export function resolveFamilyMembers(people: Person[], family: FamilyCategory): Set<string>`

**Context on `akaHint`:** the database has multiple people sharing the same `name` (verified directly against every `scripts/*.ts` seed file). In every case found, the canonical/well-known bearer of a name has an empty `alsoKnownAs` field, and every namesake has a distinguishing `alsoKnownAs` string. `resolveFamilyMembers` uses this: no `akaHint` → match the person with `alsoKnownAs === ""`; `akaHint` given → match the person whose `alsoKnownAs` includes that substring. Verified collisions relevant to this roster: `Jacob` (patriarch aka "Israel" vs. a Matthew-genealogy Jacob), `Joseph` (patriarch has empty aka; NT Joseph aka "Joseph husband of Mary, Joseph of Nazareth"; two Luke-genealogy Josephs also have non-empty akas), `Manasseh` (Joseph's son aka "Manasseh son of Joseph" vs. a king of Judah aka "Manasseh king of Judah"), `Eliezer` (Abraham's servant has empty aka; Moses' son aka "Eliezer son of Moses"; a Luke-genealogy Eliezer also non-empty), `Levi`/`Simeon`/`Judah`/`Noah` (each has a patriarch/canonical entry with empty aka plus one or more Luke-genealogy or other namesakes with non-empty akas).

- [ ] **Step 1: Write the fixture verification script**

Create `scripts/dev-check-families.ts`:

```typescript
import assert from "node:assert";
import type { Person } from "../lib/types";
import { resolveFamilyMembers, type FamilyCategory } from "../lib/families";

function person(id: string, name: string, alsoKnownAs = ""): Person {
  return {
    id, name, alsoKnownAs, gender: "unknown", testament: "OT",
    birthYear: "", deathYear: "", description: "", tags: [], createdAt: "",
  };
}

const fixturePeople: Person[] = [
  person("p1", "Jacob", "Israel"),
  person("p2", "Jacob", "Jacob father of Joseph husband of Mary"),
  person("p3", "Joseph", ""),
  person("p4", "Joseph", "Joseph husband of Mary, Joseph of Nazareth"),
  person("p5", "Eliezer", ""),
  person("p6", "Eliezer", "Eliezer son of Moses"),
  person("p7", "Manasseh", "Manasseh son of Joseph"),
  person("p8", "Manasseh", "Manasseh king of Judah"),
  person("p9", "Adam", ""),
];

const testFamily: FamilyCategory = {
  key: "test",
  label: "Test",
  members: [
    { name: "Jacob", akaHint: "Israel" },
    { name: "Joseph" },
    { name: "Eliezer", akaHint: "son of Moses" },
    { name: "Manasseh", akaHint: "son of Joseph" },
    { name: "Adam" },
    { name: "Nobody" },
  ],
};

const result = resolveFamilyMembers(fixturePeople, testFamily);

assert.strictEqual(result.size, 5, `expected 5 resolved members, got ${result.size}`);
assert.ok(result.has("p1"), "expected patriarch Jacob (p1) via akaHint");
assert.ok(!result.has("p2"), "must not match the other Jacob (p2)");
assert.ok(result.has("p3"), "expected patriarch Joseph (p3) via empty-aka default");
assert.ok(!result.has("p4"), "must not match NT Joseph (p4)");
assert.ok(result.has("p6"), "expected Moses' son Eliezer (p6) via akaHint");
assert.ok(!result.has("p5"), "must not match Abraham's servant Eliezer (p5)");
assert.ok(result.has("p7"), "expected Joseph's son Manasseh (p7) via akaHint");
assert.ok(!result.has("p8"), "must not match Manasseh king of Judah (p8)");
assert.ok(result.has("p9"), "expected Adam (p9) via empty-aka default");

console.log("families resolver: all assertions passed");
```

- [ ] **Step 2: Run the check to confirm it fails (module doesn't exist yet)**

Run: `npx tsx scripts/dev-check-families.ts`
Expected: FAIL — `Cannot find module '../lib/families'` (or similar module-not-found error).

- [ ] **Step 3: Write `lib/families.ts`**

Create `lib/families.ts`:

```typescript
import type { Person } from "./types";

export interface FamilyMember {
  name: string;
  akaHint?: string; // substring that must appear in alsoKnownAs; omit to require an EMPTY alsoKnownAs
}

export interface FamilyCategory {
  key: string;
  label: string;
  members: FamilyMember[];
}
```

_Note: the roster below was later expanded and had several `akaHint` values added post-implementation — see `lib/families.ts` for the current, correct source of truth._

```typescript
export const FAMILIES: FamilyCategory[] = [
  { key: "adam_family", label: "Adam's Family", members: [
    { name: "Adam" }, { name: "Eve" }, { name: "Cain" }, { name: "Abel" }, { name: "Seth" },
  ]},
  { key: "noah_family", label: "Noah's Family", members: [
    { name: "Noah" }, { name: "Shem" }, { name: "Ham" }, { name: "Japheth" },
  ]},
  { key: "abraham_family", label: "Abraham's Family", members: [
    { name: "Abraham" }, { name: "Sarah" }, { name: "Hagar" }, { name: "Ishmael" },
    { name: "Isaac" }, { name: "Esau" }, { name: "Jacob", akaHint: "Israel" },
  ]},
  { key: "isaac_family", label: "Isaac's Family", members: [
    { name: "Isaac" }, { name: "Rebekah" }, { name: "Esau" }, { name: "Jacob", akaHint: "Israel" },
  ]},
  { key: "jacob_family", label: "Jacob's Family", members: [
    { name: "Jacob", akaHint: "Israel" }, { name: "Leah" }, { name: "Rachel" },
    { name: "Bilhah" }, { name: "Zilpah" }, { name: "Reuben" }, { name: "Simeon" },
    { name: "Levi" }, { name: "Judah" }, { name: "Dan" }, { name: "Naphtali" },
    { name: "Gad" }, { name: "Asher" }, { name: "Issachar" }, { name: "Zebulun" },
    { name: "Dinah" }, { name: "Joseph" }, { name: "Benjamin" },
  ]},
  { key: "joseph_family", label: "Joseph's Family", members: [
    { name: "Joseph" }, { name: "Asenath" }, { name: "Manasseh", akaHint: "son of Joseph" },
    { name: "Ephraim" }, { name: "Jacob", akaHint: "Israel" },
  ]},
  { key: "moses_family", label: "Moses' Family", members: [
    { name: "Amram" }, { name: "Jochebed" }, { name: "Moses" }, { name: "Aaron" },
    { name: "Miriam" }, { name: "Zipporah" }, { name: "Gershom" },
    { name: "Eliezer", akaHint: "son of Moses" },
  ]},
  { key: "david_family", label: "David's Family", members: [
    { name: "Jesse" }, { name: "David" }, { name: "Michal" }, { name: "Abigail" },
    { name: "Bathsheba" }, { name: "Solomon" }, { name: "Absalom" }, { name: "Amnon" },
    { name: "Adonijah" },
  ]},
  { key: "jesus_family", label: "Jesus' Family", members: [
    { name: "Joseph", akaHint: "husband of Mary" }, { name: "Mary", akaHint: "mother of Jesus" },
    { name: "Jesus" },
  ]},
];

export function resolveFamilyMembers(people: Person[], family: FamilyCategory): Set<string> {
  const ids = new Set<string>();
  for (const m of family.members) {
    const match = people.find(p =>
      p.name === m.name && (m.akaHint ? p.alsoKnownAs.includes(m.akaHint) : p.alsoKnownAs === ""),
    );
    if (match) ids.add(match.id);
  }
  return ids;
}
```

- [ ] **Step 4: Run the check to confirm it passes**

Run: `npx tsx scripts/dev-check-families.ts`
Expected: `families resolver: all assertions passed`

- [ ] **Step 5: Delete the throwaway check script and typecheck**

Run: `rm scripts/dev-check-families.ts && npx tsc --noEmit`
Expected: no output from either command (clean exit).

- [ ] **Step 6: Commit**

```bash
git add lib/families.ts
git commit -m "$(cat <<'EOF'
feat: add curated family roster and name resolver for tree categories

Adds lib/families.ts with a hand-curated list of Bible families (Adam,
Noah, Abraham, Isaac, Jacob, Joseph, Moses, David, Jesus) and a resolver
that disambiguates duplicate names in the DB (e.g. two people named
"Jacob", four named "Joseph") using the alsoKnownAs field.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `buildForest` — multi-root layout for scoped trees

**Files:**
- Modify: `components/FamilyTree.tsx` (add function after `buildLayout`, i.e. after line 123)
- Test (throwaway, deleted before commit): `scripts/dev-check-forest.ts`

**Interfaces:**
- Consumes: `interface N { id: string; name: string; x: number; y: number; children: N[] }`, constants `NW`, `NH`, `HG`, `VG`, `PAD` (all already defined at `components/FamilyTree.tsx:48-52`), `Person`, `Relationship` from `@/lib/types`.
- Produces: `function buildForest(people: Person[], rels: Relationship[], memberIds: Set<string>): { all: N[]; w: number; h: number }` — same return shape as the existing `buildLayout`.

- [ ] **Step 1: Write the fixture verification script**

Create `scripts/dev-check-forest.ts`. `buildForest` is written as a named export (not just an internal helper) in `components/FamilyTree.tsx` specifically so this check — and any other caller — can import it directly:

```typescript
import assert from "node:assert";
import type { Person, Relationship } from "../lib/types";
import { buildForest } from "../components/FamilyTree";

function person(id: string, name: string, gender: "male" | "female" = "male"): Person {
  return {
    id, name, alsoKnownAs: "", gender, testament: "OT",
    birthYear: "", deathYear: "", description: "", tags: [], createdAt: "",
  };
}

function rel(aId: string, bId: string): Relationship {
  return {
    id: `${aId}-${bId}`, personAId: aId, personAName: aId, type: "parent_of",
    personBId: bId, personBName: bId, notes: "", createdAt: "",
  };
}

const people: Person[] = [
  person("abraham", "Abraham"),
  person("isaac", "Isaac"),
  person("esau", "Esau"),
  person("jacob", "Jacob"),
  person("sarah", "Sarah", "female"),
  person("melchizedek", "Melchizedek"),
];

const rels: Relationship[] = [
  rel("abraham", "isaac"),
  rel("isaac", "esau"),
  rel("isaac", "jacob"),
  // Sarah has no parent_of edge to anyone in the member set — she should
  // become her own singleton tree, not vanish.
  // Melchizedek has zero relationships at all anywhere — same expectation.
];

const memberIds = new Set(people.map(p => p.id));
const forest = buildForest(people, rels, memberIds);

assert.strictEqual(forest.all.length, 6, `expected 6 nodes total, got ${forest.all.length}`);

const byId = new Map(forest.all.map(n => [n.id, n]));
const abrahamNode = byId.get("abraham")!;
const isaacNode = byId.get("isaac")!;
const sarahNode = byId.get("sarah")!;
const melchizedekNode = byId.get("melchizedek")!;

assert.ok(abrahamNode, "Abraham should be present");
assert.strictEqual(abrahamNode.children.length, 1, "Abraham should have one child (Isaac)");
assert.strictEqual(isaacNode.children.length, 2, "Isaac should have two children (Esau, Jacob)");

// Three independent top-level trees at generation 0: Abraham's tree, Sarah's
// singleton, Melchizedek's singleton — all three roots share the same y.
assert.strictEqual(sarahNode.y, abrahamNode.y, "Sarah should be a top-level root, same y as Abraham");
assert.strictEqual(melchizedekNode.y, abrahamNode.y, "Melchizedek should be a top-level root, same y as Abraham");
assert.strictEqual(sarahNode.children.length, 0, "Sarah should have no children in this member set");
assert.strictEqual(melchizedekNode.children.length, 0, "Melchizedek should have no children");

// Forest lays trees out left-to-right: Sarah and Melchizedek must not share
// Abraham's tree's x-coordinates.
const abrahamTreeXs = new Set([abrahamNode.x, isaacNode.x, byId.get("esau")!.x, byId.get("jacob")!.x]);
assert.ok(!abrahamTreeXs.has(sarahNode.x), "Sarah's x must not collide with Abraham's tree");
assert.ok(!abrahamTreeXs.has(melchizedekNode.x), "Melchizedek's x must not collide with Abraham's tree");
assert.notStrictEqual(sarahNode.x, melchizedekNode.x, "Sarah and Melchizedek must not overlap each other");

assert.ok(forest.w > 0 && forest.h > 0, "forest should have positive bounding box");

console.log("buildForest: all assertions passed");
```

- [ ] **Step 2: Run the check to confirm it fails**

Run: `npx tsx scripts/dev-check-forest.ts`
Expected: FAIL — `buildForest` is not exported from `components/FamilyTree.tsx` (module has no exported member `buildForest`, or similar).

- [ ] **Step 3: Add `buildForest` to `components/FamilyTree.tsx`**

Insert immediately after the closing brace of `buildLayout` (after line 123, before the `// ── View state...` comment on line 125):

```typescript

// Like buildLayout, but supports a member-restricted set of people that may
// not form a single connected tree (e.g. a book's cast, or a curated family
// whose spouses often have no parent_of edge back into the set). Restricts
// parent_of edges to pairs where both ends are in memberIds, finds the
// connected components of that restricted graph, and lays each one out as
// its own mini-tree side by side using the same recursion buildLayout uses.
// A member with no parent_of edge to any other member becomes its own
// single-node tree rather than being dropped.
export function buildForest(people: Person[], rels: Relationship[], memberIds: Set<string>) {
  const byId = new Map(people.map(p => [p.id, p]));
  const hasMaleParent = new Set<string>();
  const hasParent = new Set<string>();
  const childrenOf = new Map<string, string[]>();
  const parentOf = new Map<string, string>();

  function addChild(parentId: string, childId: string) {
    if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
    childrenOf.get(parentId)!.push(childId);
    parentOf.set(childId, parentId);
  }

  // Pass 1: male parents (patrilineal preference), restricted to memberIds
  for (const r of rels) {
    if (r.type !== "parent_of") continue;
    if (!memberIds.has(r.personAId) || !memberIds.has(r.personBId)) continue;
    if (!byId.has(r.personAId) || !byId.has(r.personBId)) continue;
    if (byId.get(r.personAId)!.gender !== "male") continue;
    if (hasMaleParent.has(r.personBId)) continue;
    hasMaleParent.add(r.personBId);
    hasParent.add(r.personBId);
    addChild(r.personAId, r.personBId);
  }

  // Pass 2: female parents only when no male parent assigned
  for (const r of rels) {
    if (r.type !== "parent_of") continue;
    if (!memberIds.has(r.personAId) || !memberIds.has(r.personBId)) continue;
    if (!byId.has(r.personAId) || !byId.has(r.personBId)) continue;
    if (byId.get(r.personAId)!.gender === "male") continue;
    if (hasParent.has(r.personBId)) continue;
    hasParent.add(r.personBId);
    addChild(r.personAId, r.personBId);
  }

  // Each member's topmost ancestor within the restricted graph identifies
  // its connected component. Members with no parent_of edge at all become
  // their own topmost ancestor (a singleton component).
  function topmost(id: string): string {
    let cur = id;
    const seen = new Set([cur]);
    while (parentOf.has(cur)) {
      const next = parentOf.get(cur)!;
      if (seen.has(next)) break; // defensive: no real cycles expected in the data
      cur = next;
      seen.add(cur);
    }
    return cur;
  }

  const rootsInOrder: string[] = [];
  const seenRoots = new Set<string>();
  for (const id of memberIds) {
    if (!byId.has(id)) continue;
    const root = topmost(id);
    if (!seenRoots.has(root)) { seenRoots.add(root); rootsInOrder.push(root); }
  }

  const visited = new Set<string>();
  function build(id: string, gen: number): N {
    visited.add(id);
    const kids = (childrenOf.get(id) ?? [])
      .filter(c => byId.has(c) && !visited.has(c))
      .map(c => build(c, gen + 1))
      .reverse(); // API returns DESC order; reverse restores seed/birth order
    return { id, name: byId.get(id)!.name, x: 0, y: PAD + gen * (NH + VG), children: kids };
  }

  const trees = rootsInOrder.map(id => build(id, 0));

  // Single shared cursor across every tree in the forest — this naturally
  // lays every tree out left-to-right in one pass, same as buildLayout does
  // for a single tree's leaves.
  let cursor = 0;
  function assignX(n: N) {
    if (n.children.length === 0) {
      n.x = PAD + cursor++ * (NW + HG) + NW / 2;
      return;
    }
    n.children.forEach(assignX);
    n.x = (n.children[0].x + n.children[n.children.length - 1].x) / 2;
  }
  trees.forEach(assignX);

  const all: N[] = [];
  function collect(n: N) { all.push(n); n.children.forEach(collect); }
  trees.forEach(collect);

  if (all.length === 0) return { all, w: PAD * 2, h: PAD * 2 };

  const minX = Math.min(...all.map(n => n.x - NW / 2));
  if (minX < PAD) all.forEach(n => { n.x += PAD - minX; });

  const w = Math.max(...all.map(n => n.x)) + NW / 2 + PAD;
  const h = Math.max(...all.map(n => n.y)) + NH + PAD;
  return { all, w, h };
}
```

- [ ] **Step 4: Run the check to confirm it passes**

Run: `npx tsx scripts/dev-check-forest.ts`
Expected: `buildForest: all assertions passed`

- [ ] **Step 5: Delete the throwaway check script and typecheck**

Run: `rm scripts/dev-check-forest.ts && npx tsc --noEmit`
Expected: no output from either command.

- [ ] **Step 6: Commit**

```bash
git add components/FamilyTree.tsx
git commit -m "$(cat <<'EOF'
feat: add buildForest layout for member-scoped family trees

New function alongside buildLayout that lays out a restricted set of
people as one or more independent mini-trees side by side, so a family
or book scope can render even when some members (e.g. spouses, or
figures with no recorded parent) have no parent_of path connecting
them to the rest of the set.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `FamilyTree` — add `scope` prop

**Files:**
- Modify: `components/FamilyTree.tsx`

**Interfaces:**
- Consumes: `buildForest` (from Task 2, same file), `FamilyTree`'s existing `Props` interface at line 172-177.
- Produces: `Props.scope?: { label: string; memberIds: Set<string>; onBack: () => void }` — consumed by `TreeCategoryPicker` in Task 4/5.

This task has no standalone browser-testable deliverable yet (nothing calls `FamilyTree` with a `scope` prop until Task 5's Explorer wiring), so verification here is `tsc`/lint plus careful code review against the checklist below. Full interactive verification happens in Task 5.

- [ ] **Step 1: Extend the `Props` interface**

In `components/FamilyTree.tsx`, replace lines 172-177:

```typescript
interface Props {
  people: Person[];
  relationships: Relationship[];
  refs: ScriptureRef[];
  onSelect: (id: string) => void;
}
```

with:

```typescript
interface Props {
  people: Person[];
  relationships: Relationship[];
  refs: ScriptureRef[];
  onSelect: (id: string) => void;
  scope?: { label: string; memberIds: Set<string>; onBack: () => void };
}
```

- [ ] **Step 2: Destructure `scope` in the component signature**

Replace line 179:

```typescript
export function FamilyTree({ people, relationships, refs, onSelect }: Props) {
```

with:

```typescript
export function FamilyTree({ people, relationships, refs, onSelect, scope }: Props) {
```

- [ ] **Step 3: Branch the `tree` memo on `scope`**

Replace lines 270-273:

```typescript
  const tree = useMemo(() => {
    if (!effectiveRootId || people.length === 0) return null;
    return buildLayout(people, relationships, effectiveRootId);
  }, [people, relationships, effectiveRootId]);
```

with:

```typescript
  const tree = useMemo(() => {
    if (people.length === 0) return null;
    if (scope) return buildForest(people, relationships, scope.memberIds);
    if (!effectiveRootId) return null;
    return buildLayout(people, relationships, effectiveRootId);
  }, [people, relationships, effectiveRootId, scope]);
```

- [ ] **Step 4: Disable re-rooting via double-click while scoped**

Replace line 561:

```typescript
                onDoubleClick={e => { e.stopPropagation(); setRootId(n.id); setPickerQuery(""); setDetailId(null); }}
```

with:

```typescript
                onDoubleClick={e => { e.stopPropagation(); if (scope) return; setRootId(n.id); setPickerQuery(""); setDetailId(null); }}
```

- [ ] **Step 5: Replace the root-picker with a breadcrumb when scoped**

Replace the root-picker block, lines 586-625:

```typescript
      {/* ── Root picker — top left ─────────────────────────────────────────────── */}
      <div
        style={{ position: "absolute", top: 14, left: 14, zIndex: 20, minWidth: 180 }}
        onMouseDown={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface, #fff)", border: "1px solid rgba(60,45,20,.18)", borderRadius: 8, padding: "5px 10px", boxShadow: "0 1px 4px rgba(0,0,0,.12)", opacity: 0.95 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: "var(--text3, #888)" }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            value={pickerFocused ? pickerQuery : (rootPerson?.name ?? "")}
            onChange={e => { setPickerQuery(e.target.value); setPickerOpen(true); }}
            onFocus={() => { setPickerFocused(true); setPickerQuery(""); setPickerOpen(true); }}
            onBlur={() => setTimeout(() => { setPickerOpen(false); setPickerFocused(false); }, 120)}
            placeholder="Root: Adam"
            style={{ border: "none", outline: "none", background: "transparent", fontSize: 13, color: "var(--text, #1a1209)", width: 130, fontFamily: "var(--ui-font, sans-serif)" }}
          />
          {rootId && (
            <button
              onClick={() => { setRootId(null); setPickerQuery(""); }}
              title="Reset to Adam"
              style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, color: "var(--text3, #888)", fontSize: 15, lineHeight: 1, flexShrink: 0 }}
            >×</button>
          )}
        </div>
        {pickerOpen && pickerSuggestions.length > 0 && (
          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--surface, #fff)", border: "1px solid rgba(60,45,20,.18)", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,.10)", overflow: "hidden" }}>
            {pickerSuggestions.map(p => (
              <div
                key={p.id}
                onMouseDown={() => { setRootId(p.id); setPickerQuery(""); setPickerOpen(false); setPickerFocused(false); }}
                style={{ padding: "7px 12px", fontSize: 13, cursor: "pointer", color: "var(--text, #1a1209)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--bg2, #f5f0e8)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <div>{p.name}</div>
                {p.alsoKnownAs && <div style={{ fontSize: 11, color: "var(--text3, #888)", marginTop: 1 }}>{p.alsoKnownAs.split(",")[0].trim()}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
```

with:

```typescript
      {/* ── Root picker (unscoped) or breadcrumb (scoped) — top left ──────────── */}
      {scope ? (
        <div className="tree-breadcrumb" style={{ position: "absolute", top: 14, left: 14, zIndex: 20 }} onMouseDown={e => e.stopPropagation()}>
          <button onClick={scope.onBack}>‹ Back</button>
          <span style={{ color: "var(--text3, #888)" }}>·</span>
          <span style={{ fontWeight: 600 }}>{scope.label}</span>
        </div>
      ) : (
        <div
          style={{ position: "absolute", top: 14, left: 14, zIndex: 20, minWidth: 180 }}
          onMouseDown={e => e.stopPropagation()}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface, #fff)", border: "1px solid rgba(60,45,20,.18)", borderRadius: 8, padding: "5px 10px", boxShadow: "0 1px 4px rgba(0,0,0,.12)", opacity: 0.95 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: "var(--text3, #888)" }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              value={pickerFocused ? pickerQuery : (rootPerson?.name ?? "")}
              onChange={e => { setPickerQuery(e.target.value); setPickerOpen(true); }}
              onFocus={() => { setPickerFocused(true); setPickerQuery(""); setPickerOpen(true); }}
              onBlur={() => setTimeout(() => { setPickerOpen(false); setPickerFocused(false); }, 120)}
              placeholder="Root: Adam"
              style={{ border: "none", outline: "none", background: "transparent", fontSize: 13, color: "var(--text, #1a1209)", width: 130, fontFamily: "var(--ui-font, sans-serif)" }}
            />
            {rootId && (
              <button
                onClick={() => { setRootId(null); setPickerQuery(""); }}
                title="Reset to Adam"
                style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, color: "var(--text3, #888)", fontSize: 15, lineHeight: 1, flexShrink: 0 }}
              >×</button>
            )}
          </div>
          {pickerOpen && pickerSuggestions.length > 0 && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--surface, #fff)", border: "1px solid rgba(60,45,20,.18)", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,.10)", overflow: "hidden" }}>
              {pickerSuggestions.map(p => (
                <div
                  key={p.id}
                  onMouseDown={() => { setRootId(p.id); setPickerQuery(""); setPickerOpen(false); setPickerFocused(false); }}
                  style={{ padding: "7px 12px", fontSize: 13, cursor: "pointer", color: "var(--text, #1a1209)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--bg2, #f5f0e8)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <div>{p.name}</div>
                  {p.alsoKnownAs && <div style={{ fontSize: 11, color: "var(--text3, #888)", marginTop: 1 }}>{p.alsoKnownAs.split(",")[0].trim()}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 6: Hide the book-filter dropdown when scoped**

Find the "Node search + book filter — top right" block. Its opening is:

```typescript
      {/* ── Node search + book filter — top right ─────────────────────────────── */}
      <div
        className="ft-controls-tr"
        style={{ position: "absolute", top: 14, right: panelOpen ? 298 : 14, zIndex: 20, display: "flex", gap: 6, alignItems: "flex-start" }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Book filter */}
        <div style={{ background: "var(--surface, #fff)", border: "1px solid rgba(60,45,20,.18)", borderRadius: 8, padding: "5px 10px", boxShadow: "0 1px 4px rgba(0,0,0,.12)", opacity: 0.95, display: "flex", alignItems: "center", gap: 5 }}>
```

Change the book-filter `<div>` to only render when unscoped by wrapping it in `{!scope && ( ... )}`. Replace:

```typescript
        {/* Book filter */}
        <div style={{ background: "var(--surface, #fff)", border: "1px solid rgba(60,45,20,.18)", borderRadius: 8, padding: "5px 10px", boxShadow: "0 1px 4px rgba(0,0,0,.12)", opacity: 0.95, display: "flex", alignItems: "center", gap: 5 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: bookFilter ? "#f59e0b" : "var(--text3, #888)" }}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          <select
            value={bookFilter}
            onChange={e => setBookFilter(e.target.value)}
            style={{ border: "none", outline: "none", background: "transparent", fontSize: 12, color: bookFilter ? "#92400e" : "var(--text, #1a1209)", fontFamily: "var(--ui-font, sans-serif)", cursor: "pointer", maxWidth: 120 }}
          >
            <option value="">All books</option>
            <optgroup label="Old Testament">
              {BIBLE_BOOKS.filter(b => b.testament === "OT").map(b => (
                <option key={b.name} value={b.name}>{b.name}</option>
              ))}
            </optgroup>
            <optgroup label="New Testament">
              {BIBLE_BOOKS.filter(b => b.testament === "NT").map(b => (
                <option key={b.name} value={b.name}>{b.name}</option>
              ))}
            </optgroup>
          </select>
        </div>
```

with:

```typescript
        {/* Book filter — hidden when scoped, since a fixed member set makes it redundant */}
        {!scope && (
          <div style={{ background: "var(--surface, #fff)", border: "1px solid rgba(60,45,20,.18)", borderRadius: 8, padding: "5px 10px", boxShadow: "0 1px 4px rgba(0,0,0,.12)", opacity: 0.95, display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: bookFilter ? "#f59e0b" : "var(--text3, #888)" }}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            <select
              value={bookFilter}
              onChange={e => setBookFilter(e.target.value)}
              style={{ border: "none", outline: "none", background: "transparent", fontSize: 12, color: bookFilter ? "#92400e" : "var(--text, #1a1209)", fontFamily: "var(--ui-font, sans-serif)", cursor: "pointer", maxWidth: 120 }}
            >
              <option value="">All books</option>
              <optgroup label="Old Testament">
                {BIBLE_BOOKS.filter(b => b.testament === "OT").map(b => (
                  <option key={b.name} value={b.name}>{b.name}</option>
                ))}
              </optgroup>
              <optgroup label="New Testament">
                {BIBLE_BOOKS.filter(b => b.testament === "NT").map(b => (
                  <option key={b.name} value={b.name}>{b.name}</option>
                ))}
              </optgroup>
            </select>
          </div>
        )}
```

- [ ] **Step 7: Hide "Set as root" in the detail panel footer when scoped**

Replace lines 912-919:

```typescript
          {/* Footer actions */}
          <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(60,45,20,.10)", display: "flex", gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => { setRootId(detailId); setPickerQuery(""); }}
              style={{ flex: 1, fontSize: 12, padding: "6px 8px", background: "var(--bg2, #f5f0e8)", border: "1px solid rgba(60,45,20,.18)", borderRadius: 6, cursor: "pointer", color: "var(--text2, #4a3d1e)", fontFamily: "var(--ui-font, sans-serif)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--bg3, #ece7db)")}
              onMouseLeave={e => (e.currentTarget.style.background = "var(--bg2, #f5f0e8)")}
            >Set as root</button>
```

with:

```typescript
          {/* Footer actions */}
          <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(60,45,20,.10)", display: "flex", gap: 6, flexShrink: 0 }}>
            {!scope && (
              <button
                onClick={() => { setRootId(detailId); setPickerQuery(""); }}
                style={{ flex: 1, fontSize: 12, padding: "6px 8px", background: "var(--bg2, #f5f0e8)", border: "1px solid rgba(60,45,20,.18)", borderRadius: 6, cursor: "pointer", color: "var(--text2, #4a3d1e)", fontFamily: "var(--ui-font, sans-serif)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--bg3, #ece7db)")}
                onMouseLeave={e => (e.currentTarget.style.background = "var(--bg2, #f5f0e8)")}
              >Set as root</button>
            )}
```

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (clean exit).

- [ ] **Step 9: Commit**

```bash
git add components/FamilyTree.tsx
git commit -m "$(cat <<'EOF'
feat: add scope prop to FamilyTree for category-scoped views

When scope is provided, FamilyTree builds a forest restricted to
scope.memberIds instead of the full lineage tree, hides the root-picker
and book-filter (both meaningless once scoped), shows a back breadcrumb
instead, and disables re-rooting. Omitting scope leaves all existing
"All" behavior fully unchanged.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `components/TreeCategoryPicker.tsx` — 2-step category picker

**Files:**
- Create: `components/TreeCategoryPicker.tsx`
- Modify: `app/globals.css` (add category/family tile + breadcrumb styles)

**Interfaces:**
- Consumes: `FamilyTree` (from `./FamilyTree`, `scope` prop from Task 3), `FAMILIES`, `resolveFamilyMembers` (from `@/lib/families`, Task 1), `BIBLE_BOOKS` (from `@/lib/types`), `Person`, `Relationship`, `ScriptureRef` (from `@/lib/types`).
- Produces: `export function TreeCategoryPicker(props: { people: Person[]; relationships: Relationship[]; refs: ScriptureRef[]; onSelect: (id: string) => void }): JSX.Element` — mounted by `Explorer.tsx` in Task 5.

This task's own verification is `tsc`/lint; full interactive verification happens in Task 5 once it's actually mounted.

- [ ] **Step 1: Add CSS for category cards, family tiles, and the breadcrumb**

In `app/globals.css`, immediately after the existing `.book-tile-summary` rule (the line reading `.book-tile-summary { ... }`, part of the block that starts around line 277), add:

```css
.category-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; max-width: 640px; margin: 0 auto; padding: 40px 20px; }
.category-tile { padding: 28px 20px; border-radius: var(--radius-lg); background: var(--bg2); border: 1px solid var(--border); cursor: pointer; text-align: center; transition: all 120ms; }
.category-tile:hover { box-shadow: var(--shadow-sm); }
.category-tile-icon { font-size: 28px; margin-bottom: 10px; }
.category-tile-label { font-size: 15px; font-weight: 700; color: var(--text2); font-family: var(--font); }
.category-tile-sub { font-size: 12px; color: var(--text3); margin-top: 4px; }
.category-tile.families { border-color: var(--gold-dim); }
.category-tile.families:hover { border-color: var(--gold); background: var(--gold-dim); }
.category-tile.books { border-color: var(--accent-dim); }
.category-tile.books:hover { border-color: var(--accent); background: var(--accent-dim); }

.family-tile { padding: 10px 12px; border-radius: var(--radius-md); background: var(--bg2); border: 1px solid var(--gold-dim); cursor: pointer; transition: all 120ms; }
.family-tile:hover { border-color: var(--gold); box-shadow: var(--shadow-sm); }
.family-tile-name { font-size: 13px; font-weight: 600; color: var(--text2); font-family: var(--font); }
.family-tile-count { font-size: 11px; color: var(--text3); margin-top: 2px; }
```

Then, immediately after the existing `.ft-node-text` rule (part of the block starting around line 311-313), add:

```css
.tree-breadcrumb { display: flex; align-items: center; gap: 8px; background: var(--surface, #fff); border: 1px solid rgba(60,45,20,.18); border-radius: 8px; padding: 5px 10px; box-shadow: 0 1px 4px rgba(0,0,0,.12); font-size: 13px; color: var(--text2); font-family: var(--ui-font); }
.tree-breadcrumb button { border: none; background: transparent; cursor: pointer; color: var(--accent); font-weight: 600; font-family: var(--ui-font); font-size: 13px; padding: 0; }
```

- [ ] **Step 2: Write `components/TreeCategoryPicker.tsx`**

Create `components/TreeCategoryPicker.tsx`:

```typescript
"use client";
import { useMemo, useState } from "react";
import type { Person, Relationship, ScriptureRef } from "@/lib/types";
import { BIBLE_BOOKS } from "@/lib/types";
import { FAMILIES, resolveFamilyMembers } from "@/lib/families";
import { FamilyTree } from "./FamilyTree";

interface Props {
  people: Person[];
  relationships: Relationship[];
  refs: ScriptureRef[];
  onSelect: (id: string) => void;
}

type Step1 = "all" | "families" | "books";

export function TreeCategoryPicker({ people, relationships, refs, onSelect }: Props) {
  const [step1, setStep1] = useState<Step1 | null>(null);
  const [familyKey, setFamilyKey] = useState<string | null>(null);
  const [bookName, setBookName] = useState<string | null>(null);

  const bookCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of BIBLE_BOOKS) {
      counts.set(b.name, new Set(refs.filter(r => r.book === b.name).map(r => r.personId)).size);
    }
    return counts;
  }, [refs]);

  const familyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of FAMILIES) counts.set(f.key, resolveFamilyMembers(people, f).size);
    return counts;
  }, [people]);

  // "All" — the plain, unscoped tree, unchanged from today's behavior.
  if (step1 === "all") {
    return <FamilyTree people={people} relationships={relationships} refs={refs} onSelect={onSelect} />;
  }

  // A family has been picked — render the scoped tree. key= forces a fresh
  // FamilyTree instance per family so it auto-fits instead of trying to
  // recenter at whatever zoom the previous category was left at.
  if (familyKey) {
    const family = FAMILIES.find(f => f.key === familyKey)!;
    const memberIds = resolveFamilyMembers(people, family);
    return (
      <FamilyTree
        key={`family:${familyKey}`}
        people={people}
        relationships={relationships}
        refs={refs}
        onSelect={onSelect}
        scope={{ label: family.label, memberIds, onBack: () => setFamilyKey(null) }}
      />
    );
  }

  // A book has been picked — same idea, scoped to that book's cast.
  if (bookName) {
    const memberIds = new Set(refs.filter(r => r.book === bookName).map(r => r.personId));
    return (
      <FamilyTree
        key={`book:${bookName}`}
        people={people}
        relationships={relationships}
        refs={refs}
        onSelect={onSelect}
        scope={{ label: bookName, memberIds, onBack: () => setBookName(null) }}
      />
    );
  }

  // Step 2: Families grid
  if (step1 === "families") {
    return (
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ padding: "16px 20px 0" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setStep1(null)}>‹ Back</button>
        </div>
        <div className="book-grid" style={{ maxWidth: 720, margin: "0 auto", padding: "20px" }}>
          {FAMILIES.map(f => (
            <div key={f.key} className="family-tile" onClick={() => setFamilyKey(f.key)}>
              <div className="family-tile-name">{f.label}</div>
              <div className="family-tile-count">
                {familyCounts.get(f.key) ?? 0} {familyCounts.get(f.key) === 1 ? "person" : "people"}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Step 2: Books grid, grouped OT/NT
  if (step1 === "books") {
    return (
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ padding: "16px 20px 0" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setStep1(null)}>‹ Back</button>
        </div>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px" }}>
          {(["OT", "NT"] as const).map(testament => (
            <div key={testament} style={{ marginBottom: 24 }}>
              <div className="section-eyebrow" style={{ marginBottom: 8 }}>
                {testament === "OT" ? "Old Testament" : "New Testament"}
              </div>
              <div className="book-grid">
                {BIBLE_BOOKS.filter(b => b.testament === testament).map(b => {
                  const count = bookCounts.get(b.name) ?? 0;
                  return (
                    <div
                      key={b.name}
                      className="book-tile"
                      onClick={() => setBookName(b.name)}
                      style={count === 0 ? { opacity: 0.35, cursor: "default", pointerEvents: "none" } : undefined}
                    >
                      <div className="book-tile-name">{b.name}</div>
                      <div className="book-tile-count">{count === 0 ? "no people" : `${count} ${count === 1 ? "person" : "people"}`}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Step 1: category type
  return (
    <div className="category-grid">
      <div className="category-tile" onClick={() => setStep1("all")}>
        <div className="category-tile-icon">🌳</div>
        <div className="category-tile-label">All</div>
        <div className="category-tile-sub">The full Adam → Revelation tree</div>
      </div>
      <div className="category-tile families" onClick={() => setStep1("families")}>
        <div className="category-tile-icon">👪</div>
        <div className="category-tile-label">Families</div>
        <div className="category-tile-sub">Abraham's, Jacob's, Moses', and more</div>
      </div>
      <div className="category-tile books" onClick={() => setStep1("books")}>
        <div className="category-tile-icon">📖</div>
        <div className="category-tile-label">Books</div>
        <div className="category-tile-sub">See who appears in each book</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (clean exit).

- [ ] **Step 4: Commit**

```bash
git add components/TreeCategoryPicker.tsx app/globals.css
git commit -m "$(cat <<'EOF'
feat: add TreeCategoryPicker with 2-step Families/Books drill-down

New component sitting in front of FamilyTree: pick a category type
(All / Families / Books), then a subcategory, which mounts FamilyTree
scoped to that family's or book's people. Each category selection
remounts FamilyTree (via a key prop) so it auto-fits fresh rather than
inheriting the previous category's zoom/pan.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Wire `TreeCategoryPicker` into `Explorer.tsx` and verify end-to-end

**Files:**
- Modify: `components/Explorer.tsx`

**Interfaces:**
- Consumes: `TreeCategoryPicker` (from `./TreeCategoryPicker`, Task 4).

- [ ] **Step 1: Swap the import**

In `components/Explorer.tsx`, replace line 8:

```typescript
import { FamilyTree } from "./FamilyTree";
```

with:

```typescript
import { TreeCategoryPicker } from "./TreeCategoryPicker";
```

- [ ] **Step 2: Swap the mount point in the Tree section**

Replace line 933:

```typescript
          <FamilyTree people={people} relationships={relationships} refs={refs} onSelect={selectPerson} />
```

with:

```typescript
          <TreeCategoryPicker people={people} relationships={relationships} refs={refs} onSelect={selectPerson} />
```

- [ ] **Step 3: Update the section subtitle copy**

The subtitle at line 930 currently reads:

```typescript
              <div className="section-subtitle">Click a node to open profile · double-click to re-root · search &amp; filter top-right</div>
```

Replace with:

```typescript
              <div className="section-subtitle">Pick a family or book to explore, or view the full tree</div>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (clean exit).

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: no errors (warnings, if any pre-existed, are acceptable — do not introduce new ones).

- [ ] **Step 6: Manual end-to-end verification via dev server**

Start the dev server if not already running (`npm run dev`, default port 3000 — use another port such as 3002 if 3000 is occupied by another project, e.g. `PORT=3002 npm run dev`). Log in with the passcode from `.env.local` (`ADMIN_PASSCODE`). Using the browser (chrome-devtools MCP tools or manual click-through), verify all of the following:

1. Navigate to the "Family Tree" section. Confirm you see three cards: All, Families, Books (not the tree itself yet).
2. Click **All** → confirm the full Adam-rooted tree renders exactly as before (root-picker, node search, book filter, zoom controls, re-rooting via double-click, "Set as root" in detail panel — all present and working, matching pre-existing behavior).
3. Navigate back to Family Tree section fresh (or reload), click **Families** → confirm a grid of 9 family cards appears (Adam's, Noah's, Abraham's, Isaac's, Jacob's, Joseph's, Moses', David's, Jesus' Family), each showing a member count greater than 0.
4. Click **Abraham's Family** → confirm a small tree renders (not the full Bible tree), containing Abraham, Sarah, Hagar, Ishmael, Isaac, Esau, Jacob. Confirm the top-left shows a breadcrumb ("‹ Back · Abraham's Family") instead of the root-picker input. Confirm the top-right book-filter dropdown is gone (node search box remains). Confirm double-clicking a node does NOT re-root (tree stays the same). Open a node's detail panel and confirm there is no "Set as root" button, only "View profile".
5. Click "‹ Back" in the breadcrumb → confirm you return to the Families grid (not all the way to the Step 1 cards).
6. Click **Moses' Family** → confirm Amram, Jochebed, Moses, Aaron, Miriam, Zipporah, Gershom, and Eliezer (specifically Moses' son, not Abraham's servant — check the node's detail panel description mentions "Second son of Moses and Zipporah") all appear.
7. Click "‹ Back" twice to return to Step 1, click **Books** → confirm books are grouped under "Old Testament" and "New Testament" headers, each showing a person count, and books with 0 people are visibly dimmed and unclickable.
8. Click **Genesis** → confirm a compact forest renders (not the single giant Adam tree) containing Genesis-referenced people. Confirm Melchizedek appears as his own standalone single node somewhere in the forest (he has no parent_of edges to anyone).
9. Zoom in on the Genesis view using the "+" button several times, then click "‹ Back" and pick a different book (e.g. **Exodus**) — confirm the new book's tree auto-fits to the viewport (does not inherit the previous zoom level, since it's a different `key` and thus a fresh `FamilyTree` mount).
10. Confirm no console errors appear during any of the above steps.

Report the outcome of each numbered check.

- [ ] **Step 7: Commit**

```bash
git add components/Explorer.tsx
git commit -m "$(cat <<'EOF'
feat: wire TreeCategoryPicker into the Family Tree section

Family Tree now opens on a category picker (All / Families / Books)
instead of always showing the full Adam-rooted tree, so users can jump
straight to a focused, readable slice on mobile.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Self-Review Notes

- **Spec coverage:** data model (Task 1), engine change (Task 2), FamilyTree scope prop + hidden/disabled UI (Task 3), 2-step picker UI + accent tinting (Task 4), Explorer wiring + breadcrumb-returns-to-step-2 behavior + auto-fit-per-category via remount (Task 5) — every section of the spec has a task. Groups is explicitly excluded per Global Constraints.
- **Placeholder scan:** no TBDs; every step has literal, complete code or an exact command with expected output.
- **Type consistency:** `scope?: { label: string; memberIds: Set<string>; onBack: () => void }` is defined once in Task 3 and used identically in Task 4/5. `buildForest(people, rels, memberIds)` signature matches its Task 2 definition and its Task 3 call site. `FamilyCategory`/`FamilyMember`/`resolveFamilyMembers` names match between Task 1's definition and Task 4's usage.
