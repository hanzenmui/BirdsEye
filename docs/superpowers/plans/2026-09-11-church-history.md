# Church History — Implementation Plan

**Date:** 2026-09-11
**Design:** `../specs/2026-09-11-church-history-design.md`
**Data:** `../specs/2026-09-11-church-history-findings.md`
**Status:** Design decisions final (2026-09-11, per Hanzen) — implementation underway

Six phases, each independently shippable and verifiable. Phases 0–2 extend what
exists; 3–5 add the traditions half; 6 is polish. Stopping after any phase leaves the
app in a working state.

---

## Phase 0 — Prerequisites (small, do first)

Nothing here is visible, and everything later depends on it.

1. **Add `'CH'` to `TESTAMENTS`** in `lib/types.ts`; label it **"After New
   Testament"** everywhere it is user-facing, per Hanzen's naming instruction — the
   internal enum value can stay a short code, but no UI text says "Church History."
   Update the filter chips in `components/Explorer.tsx` (currently All / OT / NT /
   OT & NT) and anything else assuming three values. Existing rows are untouched.
2. **Extend the recognised-track list** in `scripts/verify-timeline.ts` with
   `church_father`, `theologian`, `reformer`, `missionary`, `church_ruler`,
   `tradition`.
3. **Nullable end year.** Add `formatYearSpan`-adjacent handling for an open-ended
   span so a living tradition reads "1054–present". Cleanest as a small
   `formatOpenSpan(start, end | null)` in `lib/timeline-layout.ts` beside the
   existing formatters, with unit assertions added to
   `scripts/verify-timeline-layout.ts`.

**Verify:** `npx tsc --noEmit`; `npm run verify:timeline` still all-pass; the People
browser counts unchanged (509 / 352 / 157).

---

## Phase 1 — Extend the timeline to the present

No new tables. This proves the axis and the year convention hold at 2,000 more years.

1. **Eight new periods** in `lib/timeline-periods.ts` from findings §1, with
   one-sentence summaries in the existing voice. Check each `startBc > endBc` and
   that none overlap — `judah-alone` through `global-church` must stay contiguous.
2. **`scripts/seed-church-history.ts`**, following `seed-nt-timeline.ts` exactly:
   `--dry-run` gate, `resolvePersonRow` refusing to guess on ambiguity, upsert with
   change detection, the `RENAMED_EVENTS` map pattern, idempotent on re-run.
   Seeds the ~55 people (findings §5) and ~60 events (findings §3).
3. **Six new tracks** with `TRACK_META` entries (vertical), `TRACK_COLORS` and
   `LANES` entries (horizontal), and CSS custom properties in `app/globals.css`
   alongside the existing `--tl-*` palette. Follow the rulers/messengers column
   split already in use.
4. **Every event needs a book tag or an exemption.** `verify-timeline.ts` asserts
   every event is tagged to a book, and church-history events are not in any book.
   Either relax that check to Bible-era events only, or — better — give the check an
   explicit era-based exemption so it still catches a genuinely untagged biblical
   event. Do not invent fake scripture references to satisfy it.

**Verify:** dry-run reviewed before the live run; `npm run verify:timeline` all-pass;
spot-check that `formatYear(-1517)` renders "AD 1517" and that the horizontal axis
ticks run past AD 1000 without an "AD 0".

**Expected ugliness at the end of this phase:** the horizontal chart will be close to
unusable at full span, and the vertical view will have 19 chapters. That is what
Phase 2 is for, and it is worth seeing the problem before fixing it.

---

## Phase 2 — The Act selector

Pure UI. Makes the previous phase usable.

1. **`lib/timeline-acts.ts`** — four acts (Old Testament, New Testament,
   **After New Testament**, Everything), each with a year range, the set of tracks
   it shows, and a default zoom. "After New Testament" is the literal, contractual
   display label per Hanzen — not "Church History."
2. **Segmented control** next to the existing orientation toggle, persisted to
   `localStorage` beside `birdseye-timeline-orientation`.
3. **Horizontal:** the act's range overrides `computeRange`; lanes not in the act's
   track set render nothing; default zoom comes from the act. Raise `ZOOM_MAX` from
   6 to ~40 and make the initial zoom act-derived rather than the constant 1.5.
4. **Vertical:** the act filters which periods render.
5. **Book filter** hidden in the After New Testament act; in "Everything",
   church-history tracks are exempt from it rather than filtered out (design doc,
   "Book filter and church history").

**Verify:** each act's axis spans only its own range; switching acts does not lose
the orientation choice; the book filter no longer hides Augustine.

---

## Phase 3 — The traditions data model

1. **Three migrations** appended to `MIGRATIONS` in `lib/schema.ts` — `traditions`,
   `tradition_edges`, `tradition_people` — per the design doc's DDL. Additive only.
   Note `lib/db.ts` only skips already-applied `ALTER TABLE ... ADD COLUMN`, so
   `CREATE TABLE IF NOT EXISTS` is the right form here and stays quiet on re-run.
2. **Types** in `lib/types.ts` (`Tradition`, `TraditionEdge`, `TraditionPerson`,
   plus the `kind` / `tier` / edge-type vocabularies) and mappers in
   `lib/mappers.ts`.
3. **`scripts/seed-traditions.ts`** — the ~50 traditions and their edges from
   findings §4, same script conventions as Phase 1. Structural edges
   (`split_from`, `merged_into`) and decorative ones (`influenced_by`,
   `renewal_within`) both seeded, with `event_id` wired to the council or schism
   that caused each split where one exists. **The three `kind: 'cult'` rows
   (Latter-day Saints, Jehovah's Witnesses, Christian Science) get zero rows in
   `tradition_edges` — no parent, no child, no influence edge, nothing.**
4. **`scripts/verify-traditions.ts`** — a real verification suite, in the spirit of
   `verify-timeline.ts`:
   - every edge points at two traditions that exist;
   - no tradition descends from itself (walk for cycles);
   - a child never starts before its parent;
   - every tradition has a non-empty `distinctives`;
   - **the branch rule holds at every major split, not just Chalcedon** — Western
     Church (1054–1517) has exactly five structural children all dated 1517–1536,
     and **none of them is named "Western Church"** (i.e. no child silently reuses
     the parent's identity); same shape-check at The Imperial Church (431–451) and
     The Chalcedonian Church (451–1054);
   - **no `kind: 'cult'` tradition has any row in `tradition_edges`**, as either
     parent or child — this is the one negative-space check worth automating,
     since a future edit accidentally wiring a cult into the tree would be exactly
     the kind of silent regression a script should catch and a human might not;
   - every `uncertain` tradition carries a note.
5. **`/api/traditions`** route, and add traditions to `/api/timeline` so the
   `tradition` lane has data.

**Verify:** the new suite all-pass; dry-run reviewed; re-run produces no changes.

---

## Phase 4 — Traditions on the family tree

The part you asked for, and the reason Phase 3's shape matters.

1. **Widen the tree's parameter types** in `components/FamilyTree.tsx` to the
   `TreeNode` / `TreeEdge` structural interfaces from the design doc.

   **Already proven, 2026-09-11.** Rather than leave this as an assumption, the
   change was made as a throwaway experiment and typechecked: replacing every
   `people: Person[], rels: Relationship[]` signature in that file with
   `people: TreeNode[], rels: TreeEdge[]` — where

   ```ts
   interface TreeNode { id: string; name: string; gender?: string; alsoKnownAs?: string }
   interface TreeEdge { personAId: string; type: string; personBId: string }
   ```

   — gives `tsc --noEmit` exit 0 with **zero call-site changes**, because `Person`
   and `Relationship` already satisfy those shapes structurally. The experiment was
   then reverted, so the working tree is untouched, but the risk is retired: this
   step is a one-line-per-signature edit, not a refactor.
2. **Parent-choice comparator** becomes an optional parameter: people keep the
   male-preferred rule, traditions use earliest-parent. Default preserves today's
   behaviour exactly, so the Adam-to-Jesus lineage cannot regress.
3. **Adapter** mapping `Tradition` → `TreeNode` and structural `TraditionEdge` →
   `TreeEdge` with `type: "parent_of"`.
4. **New picker groups** in `lib/families.ts` / `TreeCategoryPicker`, alongside
   Families and Books:
   - **"Traditions"** — the historic descent tree: "Everything from Acts", "The
     Great Schism", "The Reformation", "Protestant families."
   - **"Outside Historic Christianity"** (or similar copy) — the three `kind: 'cult'`
     entries shown side by side with no parent linkage, entirely separate from the
     Traditions group so nobody browsing the historic tree stumbles into them
     looking like a branch of it.
5. **Node rendering** differs for traditions: wider nodes (names like "Church of God
   (Cleveland, Tennessee)" do not fit a 124px person node), a living-tradition
   affordance for the open-ended ones, and `kind`-based styling so a *movement*
   (Holiness, Evangelicalism) does not read as a denomination, and a *cult* entry
   reads as visually distinct again from either.
6. **Decorative edges** drawn in the existing non-parent relationship colours —
   `influenced_by` dashed, `renewal_within` looping back — reusing the machinery that
   already colours spouse/mentor/ally edges.

**Verify in the browser:** the Adam-to-Jesus tree and the red/blue Solomon/Nathan
lineages are pixel-unchanged; the Reformation tree renders as one split into five
siblings (Roman Catholic, Lutheran, Reformed, Anglican, Anabaptist), with no node
carrying over the "Western Church" identity; Methodism shows one solid parent edge
(Anglican) and one dashed influence edge (Moravian); the three cult entries render
only under their own category, never reachable by browsing the historic tree; mobile
touch and the side name list still work.

---

## Phase 5 — Joining the two halves

1. **`tradition_people`** surfaced both ways: a tradition node lists its founders and
   key figures; a person's profile says which tradition they founded or belonged to.
2. **Events list what they produced** — the Great Schism event shows the two
   communions it created, via `tradition_edges.event_id`.
3. **Clicking a split edge** opens the council behind it.

**Verify:** Luther's profile names Lutheranism; the Great Schism event names both
communions; every `event_id` on an edge resolves.

---

## Phase 6 — Polish

- `distinctives` given real presentation — this is the field that answers "what's
  different about each", so it deserves better than a paragraph in a tooltip.
- Tier-based collapse: tiers 1–2 by default, tier 3 on demand.
- Adherent counts shown with the year they refer to.
- Vault and `CLAUDE.md` updated; roadmap items 2 and 3 marked done.

---

## Risks

| Risk | Handling |
|---|---|
| The tree refactor regresses the genealogy | Retired. The widening was trial-run on 2026-09-11 and typechecks with zero call-site changes (Phase 4 step 1). The remaining exposure is the *rendering* changes in steps 5–6, which are additive and guarded by checking the Adam-to-Jesus and Solomon/Nathan views in the browser. |
| 19 periods make the vertical view unusable | Phase 2 lands before anyone has to live with it. |
| Someone objects to the denominational shape | The branch rule and its limits are written down in the design doc and asserted in Phase 3's verification suite, so the shape is deliberate and testable rather than incidental. |
| Live Turso writes | Every seed script is `--dry-run` first, idempotent, additive, reviewed before the live run — the pattern the whole 30-book audit series and the NT extension already used. |
| Scope creep into 200 denominations | Tiers cap it. ~50 nodes, and tier 3 is the only place to add more. |

## Decisions (2026-09-11, per Hanzen — supersedes the three open questions above)

1. ~~Which Church of God is Oakland Church of God?~~ **Not tracing any one specific
   congregation.** The goal is general coverage of "what's out there," with
   Non-denominational as the honest catch-all. Both Churches of God are seeded as
   ordinary, unrelated tier-3 entries.
2. ~~Latter-day Saints, Jehovah's Witnesses, Christian Science~~ **All three are
   `kind: 'cult'`, off the descent tree entirely, in their own picker category.**
3. ~~No side is "the true main church"~~ **applies at every major split, not only
   Chalcedon and the Great Schism — including 1517.** Roman Catholic Church is a
   node dated 1517, structurally a sibling of Lutheran/Reformed/Anglican/Anabaptist,
   not a continuation of what came before. See the corrected trunk in findings §2.

## Still open (lower stakes, does not block starting)

1. **Depth in the East.** The findings list the Oriental Orthodox members and the
   Eastern Orthodox national churches. Worth naming the Greek/Russian/Serbian/
   Romanian churches individually, or is "Eastern Orthodox" enough at tier 1?
   Deferred to Phase 6 polish — tier 1–2 ships first either way.
