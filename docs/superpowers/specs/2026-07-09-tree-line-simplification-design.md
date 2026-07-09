# Family Tree Line Simplification — Design

**Date:** 2026-07-09
**Status:** Approved

## Context

The Family Tree canvas (`components/FamilyTree.tsx`) currently draws every non-parent relationship type (`sibling_of`, `spouse_of`, `ancestor_of`, `descendant_of`, `mentor_of`, `disciple_of`, `ally_of`, `servant_of`, `enemy_of`, `ruler_of`, `other`) as a color-coded, differently-dashed curved arc (`outerArcPath`, bowing out to the left/right edge of the canvas), explained by an 8-entry legend in the bottom-left corner. Critically, `spouse_of` is drawn the same arc-based way as everything else — there is no dedicated, explicit spouse connector. Spouses only appear near each other today because of incidental leaf-slot positioning in the layout algorithm, not because any line actually connects them.

This incidental-adjacency behavior is also implicated in a separate data bug (see the companion Genesis audit spec): disconnected/orphaned nodes in `buildForest` land in the same leftover-slot row as spouses, making them visually indistinguishable from "part of the family." Making the spouse connection explicit is one part of making the canvas trustworthy to read.

This spec covers only the tree canvas's own line/arc rendering. It does **not** touch the detail panel's relationship list (the sidebar shown when a person is clicked), which keeps its full relationship-type labels and color-coded dots — that list serves a different purpose (understanding one person's relationships) and stays as-is.

## Changes

1. **`spouse_of` gets an explicit, dedicated connector**: a plain straight horizontal line drawn directly between the two spouse nodes, at their shared vertical center. No color coding, no dashing — a plain neutral stroke matching the existing parent-child connector line's visual weight (same `rgba(60,45,20,.18)`-style neutral tone already used for `parent_of` lines).
2. **Every other non-parent relationship type stops rendering on the canvas entirely**: `sibling_of`, `ancestor_of`, `descendant_of`, `mentor_of`, `disciple_of`, `ally_of`, `servant_of`, `enemy_of`, `ruler_of`, `other` are no longer drawn as arcs. The `outerArcPath` function and the "Extra relationship arcs" rendering block are removed except for the new spouse-line special case.
3. **`parent_of` connector lines are unchanged** — already vertical, already neutral-toned, no modification needed.
4. **The Adam→Jesus lineage highlight is unchanged** — it's a node *stroke* color (`RELATIONSHIP_COLORS.lineage`, violet), applied via `findLineagePath`, entirely independent of the arc-rendering code being removed here.
5. **The legend shrinks** from 8 relationship-type entries down to 3: "Parent / Child," "Spouse," and "Adam → Jesus lineage" (the last one already exists as a separate legend row and is unchanged).

## Out of scope

- The detail panel's relationship list (`RELATIONSHIP_LABELS`, `RELATIONSHIP_COLORS`, `RELATIONSHIP_INVERSE_LABELS` in `lib/types.ts`) stays fully intact — those constants are still used there and must not be deleted, only their *tree-canvas arc rendering* usage is removed.
- No change to `buildLayout` or `buildForest`'s node positioning logic — this is a rendering-only change. (Positioning spouses closer together, if desired, would be a separate future layout change.)
- No change to the Genesis data audit (separate spec).
