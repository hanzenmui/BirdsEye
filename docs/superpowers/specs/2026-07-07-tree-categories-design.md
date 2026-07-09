# Family Tree Categories — Design

**Date:** 2026-07-07
**Status:** Approved (pending final review)

## Context

The Family Tree view (`components/FamilyTree.tsx`, mounted from `components/Explorer.tsx`) currently renders one giant tree rooted at Adam, containing every person in the database. On mobile especially, this is too crowded and too small to read — the original complaint that started this work. The tree already supports jumping to any person as a new root (root-picker, search, double-click), but re-rooting still shows that person's *entire* downstream lineage, which for early patriarchs is most of the Bible.

This spec adds a category browser in front of the tree: instead of always seeing the full tree, the user picks a scoped slice — a specific family, or a specific book's cast — and sees a small, focused tree containing only that group.

**Explicitly out of scope for this spec:** "Groups" (e.g. Jesus + disciples, Paul + traveling companions). These are defined by non-parent-child relationships (`mentor_of`, `ally_of`) radiating from a central figure, not by lineage, and need a genuinely different hub-and-spoke layout. This is deferred to its own follow-up spec once this category-browser pattern exists to build on.

## Flow

```
Family Tree section
  └─ Step 1: category type — [All] [Families] [Books]
       ├─ All      → today's full tree, unscoped, unchanged
       ├─ Families → Step 2: grid of family cards (Adam's, Noah's, Abraham's, ...)
       │                └─ selecting one → scoped tree for that family
       └─ Books    → Step 2: grid of books, grouped OT/NT (reusing BIBLE_BOOKS)
                        └─ selecting one → scoped tree for that book's cast
```

Picking "All" skips step 2 entirely, since it has no subcategories.

## Data model

### Families — hand-curated

New file `lib/families.ts` exports a static list:

```typescript
interface FamilyMember { name: string; akaHint?: string }
interface FamilyCategory {
  key: string;
  label: string;
  members: FamilyMember[];
}
export const FAMILIES: FamilyCategory[] = [ /* see roster below */ ];
```

Each family is an explicit, hand-picked member list (root + spouse(s) + children + grandchildren — an "immediate household" slice, not the full downstream lineage). This is hand-curated rather than derived (e.g. via an N-hop graph walk) because real biblical families mix parents, spouses, siblings, and in-laws in combinations no single graph rule captures consistently, and because every other piece of content in this app (all seed scripts) is already hand-authored rather than computed.

**`akaHint` — resolving duplicate names:** the database has multiple people sharing the same `name` (confirmed: three people named "Eliezer" — Abraham's servant, Moses' son, and a Luke-genealogy figure; two people named "Manasseh" — Joseph's son and a later king of Judah; likely also "Joseph" and "Mary" given NT/OT overlap). Plain `name` matching is ambiguous for these. When a family roster needs one of these names, `akaHint` gives a substring that must appear in that person's `alsoKnownAs` field to disambiguate (e.g. `{ name: "Eliezer", akaHint: "son of Moses" }`). Resolution logic: `people.find(p => p.name === m.name && (!m.akaHint || p.alsoKnownAs.includes(m.akaHint)))`. Names without a collision omit `akaHint`.

**v1 roster** (member names as they exist in the seeded data; final list validated against the live DB during implementation — any name that fails to resolve is silently skipped, same as existing `.find()` patterns elsewhere in this file):

> Note: this roster was expanded and several `akaHint` values were added
> after initial implementation, based on further review and live-data
> verification. `lib/families.ts` is the source of truth for the current
> roster — this table reflects the original design intent, not the final
> member lists.

| Key | Label | Members |
|---|---|---|
| `adam_family` | Adam's Family | Adam, Eve, Cain, Abel, Seth |
| `noah_family` | Noah's Family | Noah, Shem, Ham, Japheth |
| `abraham_family` | Abraham's Family | Abraham, Sarah, Hagar, Ishmael, Isaac, Esau, Jacob |
| `isaac_family` | Isaac's Family | Isaac, Rebekah, Esau, Jacob |
| `jacob_family` | Jacob's Family | Jacob, Leah, Rachel, Bilhah, Zilpah, Reuben, Simeon, Levi, Judah, Dan, Naphtali, Gad, Asher, Issachar, Zebulun, Dinah, Joseph, Benjamin |
| `joseph_family` | Joseph's Family | Joseph, Asenath, Manasseh (`akaHint: "son of Joseph"`), Ephraim, Jacob |
| `moses_family` | Moses' Family | Amram, Jochebed, Moses, Aaron, Miriam, Zipporah, Gershom, Eliezer (`akaHint: "son of Moses"`) |
| `david_family` | David's Family | Jesse, David, Michal, Abigail, Bathsheba, Solomon, Absalom, Amnon, Adonijah |
| `jesus_family` | Jesus' Family | Joseph (`akaHint: "husband of Mary"`), Mary (`akaHint: "mother of Jesus"`), Jesus |

### Books — no new data

Member set = `refs.filter(r => r.book === bookName).map(r => r.personId)`, exactly the computation the existing book-filter dropdown already does for its dim/highlight behavior. `BIBLE_BOOKS` (already defined in `lib/types.ts`) supplies the OT/NT-grouped list for the Step 2 grid, same grouping already used in the existing book-filter `<select>`.

## Engine change: `buildForest`

New function alongside `buildLayout` in `components/FamilyTree.tsx` (or extracted to a small sibling module if it grows):

```typescript
function buildForest(people: Person[], relationships: Relationship[], memberIds: Set<string>): { all: N[]; w: number; h: number }
```

Behavior:
1. Restrict `parent_of` edges to pairs where **both** people are in `memberIds`.
2. Find connected components of that restricted graph.
3. For each component, pick the topmost node (no parent within the component) and run the *existing, unmodified* `build()` + `assignX()` recursion from `buildLayout` to lay it out as its own mini-tree.
4. Any member with no `parent_of` edge to another member at all (e.g. Melchizedek, who has zero parent-child edges anywhere in the database) becomes its own single-node tree.
5. Concatenate all component trees left-to-right with a fixed gap, and return the combined `{ all, w, h }` — the same shape `buildLayout` already returns.

This is the one new piece of layout logic needed. Both Families and Books use it identically (Families' member sets sometimes fail to fully connect via `parent_of` too — e.g. within an Abraham's-Family-scoped set, Sarah's only `parent_of` edge is to Isaac, but patrilineal preference already assigns Isaac to Abraham, leaving Sarah disconnected — so she'd render as her own singleton node next to Abraham's cluster, still joined visually by the existing dashed `spouse_of` arc).

**Why rendering code doesn't change:** `FamilyTree`'s SVG output (nodes, `parent_of` connector lines, relationship arcs) only ever reads the generic `{ all, w, h }` result and a `posMap` built from it — it has no idea whether that came from `buildLayout` or `buildForest`. Cross-cluster relationships (spouse_of, ally_of, sibling_of, etc.) already draw as arcs between two node positions regardless of which tree/cluster each node belongs to, so disconnected clusters still get visually reconnected by these existing dashed lines.

## UI changes

**`FamilyTree` component** gains one new optional prop:

```typescript
scope?: { label: string; memberIds: Set<string> }
```

- **Omitted** (today's "All" behavior): fully unchanged — same root-picker, book-filter dropdown, re-rooting, everything.
- **Present**:
  - `tree` memo calls `buildForest(people, relationships, scope.memberIds)` instead of `buildLayout(...)`.
  - The top-left root-picker and the top-right book-filter dropdown are hidden (both meaningless once scoped to a fixed set).
  - A small breadcrumb replaces the root-picker: "‹ Back to Families" / "‹ Back to Books" plus the current scope's label (e.g. "Abraham's Family").
  - Node search (top-right "Find person…") stays active, now searching within the scoped set only.
  - Re-rooting (double-click a node, or "Set as root" in the detail panel) is disabled — a forest has no single mutable root the way a lineage tree does. Double-click becomes a no-op; "Set as root" is hidden from the detail panel footer while scoped.
  - Auto-fit-on-load behavior is unchanged, now fitting to the forest's combined bounding box.

**New component `components/TreeCategoryPicker.tsx`**: owns the 2-step picker state (`type: "all" | "families" | "books"` for step 1, then a selected key for step 2). Mounted in `Explorer.tsx`'s Tree section in place of the current direct `<FamilyTree ... />` call:

- **Step 1**: three cards — All, Families, Books.
- **Step 2** (Families or Books only): a card grid.
  - Families: one card per `FAMILIES` entry, showing the label and a resolved member count.
  - Books: cards grouped under "Old Testament" / "New Testament" headers (mirroring the existing `<optgroup>` structure), each showing the book name and its member count (`refs` filtered by book, deduped by `personId`).
  - Cards get a subtle accent tint by category type (a warm tone for Families, a cool tone for Books) — a lighter-weight version of the original color-coding idea, applied to the picker rather than to tree nodes themselves.
  - A "‹ Back" control returns to Step 1.
- Selecting a Step 2 card computes the member set and renders `<FamilyTree scope={{ label, memberIds }} people={...} relationships={...} refs={refs} onSelect={onSelect} />`. Selecting "All" at Step 1 renders `<FamilyTree people={...} relationships={...} refs={refs} onSelect={onSelect} />` with no `scope` prop.

Because `Explorer.tsx`'s `.app-section` elements stay mounted (`display: none` when inactive, per existing CSS) rather than unmounting when the user switches tabs, `TreeCategoryPicker`'s picker state naturally persists across tab switches within a session — no extra persistence logic needed.

## Edge cases

- A family or book with very few resolvable people renders as a small forest (expected — that's the point) or, if genuinely empty, falls back to the existing "No people in the database"-style empty state already defined in `FamilyTree`.
- Curated family member names that don't resolve against a given environment's data (e.g. a name not yet seeded, or a typo) are silently skipped — consistent with the existing `.find()`-returns-`undefined`-then-filtered pattern already used throughout this file.
- Duplicate-name collisions are handled via `akaHint` as described above; this is the one real data ambiguity found during design and is fully resolved by the roster table above, not left open.

## Testing

This project has no automated test suite configured (no Jest/Vitest in `package.json`). Verification will be manual: run the dev server, and drive it via chrome-devtools MCP browser automation (same approach used for the two mobile-touch fixes earlier in this project) to confirm each family and book category renders a coherent, correctly-scoped forest, and that breadcrumb/back navigation and auto-fit work as designed. No new test framework is introduced as part of this feature.
