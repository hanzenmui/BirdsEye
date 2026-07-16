# Lineage Consistency Review — Design

**Date:** 2026-07-15
**Status:** Approved

## Context

Following the Genesis data audit and the tree-line-simplification work, a database-wide structural check was run: for every person, does their `parent_of` chain actually connect the way the app's own rendering code (`buildLayout`, `buildForest`, `findLineagePath`) expects? This is a different concern from the Genesis audit (which checked textual accuracy against ESV) — this checks internal consistency between the data and how the app displays it.

The check (a live-data pull + a Python script mirroring `buildLayout`'s exact patrilineal-preference logic) surfaced four findings:

1. **332 of 503 people (66%) never appear in the "All" tree at all** — `buildLayout` only renders people reachable from Adam via an unbroken `parent_of` chain; anyone without one (most apostles, several OT kings, most NT epistle figures) is invisible, not even as a disconnected node, since `buildLayout` (unlike `buildForest`) has no forest fallback.
2. **Two points where Matthew's and Luke's genealogies converge on shared person records** (Joseph husband of Mary, and Shealtiel/Zerubbabel) — investigated and found to be a *deliberate* editorial choice already in `scripts/seed-luke-lineage.ts` (inline comment: `"Heli as father of Joseph (father-in-law per Luke 3:23 tradition)"`), reflecting a real, defensible harmonization theory. Not a data error — a disputed theological modeling choice already made and reasoned about in the code. **No fix in this spec.**
3. **Ephraim and Manasseh now have two competing male `parent_of` edges** — Joseph (biological) and Jacob (the Gen 48:5 adoption relationship added by the Genesis data audit branch). Since `buildLayout`/`buildForest`'s Pass 1 logic takes the first male parent encountered with no tie-breaking rule, which parent displays is now arbitrary/insertion-order-dependent. This is a regression introduced by this project's own prior work, not a pre-existing issue.
4. **51 cases where a mother's `parent_of` edge is dropped in favor of a father's**, per the existing patrilineal-preference rule. Spot-checked — every case follows the expected pattern (mother still visible via the `spouse_of` horizontal line). **No fix needed.**

Findings 2 and 4 require no code changes and are documented here for completeness, not carried into the plan.

## Fix 1: Ephraim/Manasseh dual-male-parent regression

**Root cause:** `jacob parent_of manasseh` and `jacob parent_of ephraim` (added in commit `a0a3c43`, Genesis audit Finding S5) are structurally identical in type to `joseph parent_of manasseh`/`ephraim` (their original biological relationship), so both compete for the single "male parent" tree-structure slot.

**Fix:** Change the two Jacob relationships from `parent_of` to `other`, keeping their existing note (`"Adopted by Jacob per Gen 48:5 — 'they are mine, as Reuben and Simeon are'"`) unchanged. This is a live database `UPDATE relationships SET type = 'other' WHERE ...` — the same kind of one-off correction script pattern already used in `scripts/fix-genesis-audit.ts`, scoped to exactly these two rows.

Why `other` and not a different structural fix: `other` is already an existing, established catch-all `RelationshipType` in this app (used elsewhere, e.g. Genesis's `insertRel(..., "other", ...)` calls), the detail panel already renders every relationship type including `other` with its label and a color dot, and no rendering code treats `other` as tree-structural (only `parent_of` is read by `buildLayout`/`buildForest`'s Pass 1/Pass 2). This preserves the Gen 48:5 fact as fully visible/discoverable while removing it from competing for Joseph's structural position. Joseph reverts to being Manasseh/Ephraim's sole tree-parent, matching their position before the Genesis audit and matching how every other tribal-genealogy list (Numbers, Joshua) counts them.

## Fix 2: "All" tree mislabeled as complete

**Root cause:** `components/TreeCategoryPicker.tsx:148` reads `"The full Adam → Revelation tree"`, but the tree canvas only ever shows the subset of the database with a traceable `parent_of` chain back to Adam (171 of 503 people, 34%).

**Fix:** This is a labeling fix, not an architecture change. Converting "All" into a `buildForest`-based rendering of all 503 people was considered and rejected: it would reintroduce exactly the visual-crowding problem the Family Tree Categories feature was built to solve (332 additional disconnected singleton nodes scattered across the canvas). The 332 bloodline-disconnected people are already fully browsable via the existing People and By Book sections — the tree canvas's scope (the traceable bloodline) is a reasonable, useful, and already-functional concept; it just needs accurate copy. Change the subtitle to `"The traceable bloodline from Adam"` (or equivalently honest phrasing) so the picker doesn't overclaim coverage it doesn't have.

## Out of scope

- Splitting the Joseph/Shealtiel/Zerubbabel shared records into distinct Matthew-line and Luke-line people (Finding 2) — deferred indefinitely, pending explicit user direction on which harmonization stance the app should reflect, since this is a content/theological decision, not a correctness bug.
- Any change to the 51 dropped-mother relationships (Finding 4) — reviewed, no issue found.
- Any change to `buildLayout`/`buildForest`'s underlying patrilineal-preference algorithm itself — both fixes here work within the existing algorithm's rules rather than changing them.
