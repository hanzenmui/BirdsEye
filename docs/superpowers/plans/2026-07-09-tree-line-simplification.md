# Tree Line Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove relationship-type color coding and varied dash styles from the Family Tree canvas; add an explicit horizontal connector line for spouses; keep parent-child vertical lines and the Adam→Jesus violet lineage outline unchanged.

**Architecture:** All changes are confined to `components/FamilyTree.tsx`'s SVG rendering — no changes to layout algorithms (`buildLayout`/`buildForest`), no changes to `lib/types.ts`'s relationship constants (still used by the untouched detail panel), no changes to any other file.

**Tech Stack:** Next.js 16, React 19, TypeScript, inline SVG rendering (no charting library).

## Global Constraints

- The detail panel's relationship list (the sidebar shown when a person is clicked, `components/FamilyTree.tsx` lines ~1003-1036) must remain fully unchanged — it still shows every relationship type with its label and color dot. Do not delete `RELATIONSHIP_COLORS`, `RELATIONSHIP_LABELS`, or `RELATIONSHIP_INVERSE_LABELS` from `lib/types.ts`; do not remove their usage in the detail panel.
- The Adam→Jesus lineage highlight (`RELATIONSHIP_COLORS.lineage`, a node stroke color applied via `findLineagePath`) must remain fully unchanged.
- No new dependencies. No test framework introduced (none exists in this project).

---

### Task 1: Simplify canvas relationship rendering to spouse-only horizontal lines

**Files:**
- Modify: `components/FamilyTree.tsx`

**Interfaces:** None — this task only changes JSX rendering inside the existing `FamilyTree` component; no new exports, no signature changes to `buildLayout`/`buildForest`/`FamilyTree`'s `Props`.

- [ ] **Step 1: Remove the now-unused `outerArcPath` helper**

In `components/FamilyTree.tsx`, delete this function (it will have no remaining callers after Step 3):

```typescript
// Cubic bezier that hugs the left (x=0) or right (x=treeW) SVG edge so arcs
// avoid passing through the tree interior. Stays within SVG bounds so it is
// never clipped by overflow:hidden on the container.
function outerArcPath(x1: number, y1: number, x2: number, y2: number, treeW: number): string {
  const goLeft = Math.min(x1, x2) <= treeW - Math.max(x1, x2);
  const edgeX = goLeft ? 0 : treeW;
  return `M ${x1} ${y1} C ${edgeX} ${y1} ${edgeX} ${y2} ${x2} ${y2}`;
}
```

- [ ] **Step 2: Replace the "Extra relationship arcs" block with a spouse-only horizontal-line block**

Find this block (currently right after the `<svg>` opening tag, before the "Parent-of connector lines" comment):

```tsx
          {/* Extra relationship arcs */}
          {relationships
            .filter(r => r.type !== "parent_of" && r.type !== "child_of")
            .filter(r => posMap.has(r.personAId) && posMap.has(r.personBId))
            .map(r => {
              const nA = posMap.get(r.personAId)!;
              const nB = posMap.get(r.personBId)!;
              const color = RELATIONSHIP_COLORS[r.type] ?? RELATIONSHIP_COLORS.other;
              const dash: Record<string, string> = {
                sibling_of:    "6 3",
                spouse_of:     "2 3",
                ancestor_of:   "10 4",
                descendant_of: "10 4",
                mentor_of:     "7 3",
                disciple_of:   "7 3",
                ally_of:       "5 3",
                servant_of:    "3 5",
                enemy_of:      "5 2 1 2",
                ruler_of:      "9 3",
                other:         "3 3",
              };
              const isAnc = r.type === "ancestor_of" || r.type === "descendant_of";
              return (
                <path
                  key={r.id}
                  d={outerArcPath(nA.x, nA.y + NH / 2, nB.x, nB.y + NH / 2, w)}
                  stroke={color}
                  strokeWidth={1.5}
                  fill="none"
                  strokeDasharray={dash[r.type] ?? "4 3"}
                  opacity={isAnc ? 0.4 : 0.8}
                />
              );
            })}
```

Replace it with:

```tsx
          {/* Spouse connector lines — plain, same visual weight as parent-child lines */}
          {relationships
            .filter(r => r.type === "spouse_of")
            .filter(r => posMap.has(r.personAId) && posMap.has(r.personBId))
            .map(r => {
              const nA = posMap.get(r.personAId)!;
              const nB = posMap.get(r.personBId)!;
              return (
                <line
                  key={r.id}
                  x1={nA.x} y1={nA.y + NH / 2}
                  x2={nB.x} y2={nB.y + NH / 2}
                  stroke="rgba(60,45,20,.18)"
                  strokeWidth={1.5}
                />
              );
            })}
```

- [ ] **Step 3: Simplify the legend to 3 entries**

Find this block (the `.ft-legend` div's contents):

```tsx
        {([
          ["rgba(60,45,20,.75)", "Parent / Blood",   undefined],
          [RELATIONSHIP_COLORS.sibling_of,   "Sibling",      "6 3"],
          [RELATIONSHIP_COLORS.spouse_of,    "Spouse",       "2 3"],
          [RELATIONSHIP_COLORS.mentor_of,    "Mentor",       "7 3"],
          [RELATIONSHIP_COLORS.enemy_of,     "Enemy",        "5 2 1 2"],
          [RELATIONSHIP_COLORS.ally_of,      "Ally / Friend","5 3"],
          [RELATIONSHIP_COLORS.ancestor_of,  "Ancestor",     "10 4"],
          [RELATIONSHIP_COLORS.ruler_of,     "Ruler",        "9 3"],
        ] as [string, string, string | undefined][]).map(([color, label, dash]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="20" height="6" style={{ flexShrink: 0 }}>
              <line x1="0" y1="3" x2="20" y2="3" stroke={color} strokeWidth="2" strokeDasharray={dash} />
            </svg>
            <span>{label}</span>
          </div>
        ))}
```

Replace it with:

```tsx
        {([
          ["rgba(60,45,20,.75)", "Parent / Child"],
          ["rgba(60,45,20,.75)", "Spouse"],
        ] as [string, string][]).map(([color, label]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="20" height="6" style={{ flexShrink: 0 }}>
              <line x1="0" y1="3" x2="20" y2="3" stroke={color} strokeWidth="2" />
            </svg>
            <span>{label}</span>
          </div>
        ))}
```

(The `Adam → Jesus lineage` row immediately below this block is untouched — leave it exactly as-is.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (clean exit). This will also surface if `RELATIONSHIP_COLORS` import becomes partially unused — it will not, since `RELATIONSHIP_COLORS.lineage` (line ~669 node-stroke logic and the legend's lineage swatch) and `RELATIONSHIP_COLORS[r.type]` (detail panel, unchanged) both still reference it.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: same error/warning count as the current baseline on `main` (no new problems). If unsure of the baseline, compare via `git stash` on the unmodified file first.

- [ ] **Step 6: Manual verification via dev server**

Start the dev server (`npm run dev`, picking a free port if 3000 is occupied), log in with the passcode from `.env.local` (`ADMIN_PASSCODE`), navigate to Family Tree → Families → Adam's Family. Confirm:
1. Adam and Eve are connected by a plain horizontal line (no dashing, neutral color) — not merely adjacent by accident.
2. No colored/dashed arcs appear anywhere on the canvas for any other relationship type.
3. The bottom-left legend shows exactly 3 rows: "Parent / Child," "Spouse," and "Adam → Jesus lineage."
4. Click on a person with known non-spouse relationships (e.g. someone with a sibling or mentor relationship) and confirm the **detail panel** (right-side sidebar) still shows that relationship with its label and color dot — this part must be unaffected.
5. No console errors.

- [ ] **Step 7: Commit**

```bash
git add components/FamilyTree.tsx
git commit -m "$(cat <<'EOF'
refactor: simplify tree canvas to parent/child + spouse lines only

Removes relationship-type color coding and varied dash styles from
the tree canvas. Spouses now get an explicit horizontal connector
line (previously spouses were only ever adjacent by layout accident,
never actually connected by a drawn line). All other non-parent
relationship types (sibling, mentor, ally, enemy, ruler, etc.) stop
rendering as arcs. Parent-child connector lines and the Adam->Jesus
lineage node-stroke highlight are unchanged. The detail panel's
relationship list keeps its full type labels and colors.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Self-Review Notes

- **Spec coverage:** spouse horizontal line (Step 2), removal of other arc types (Step 2), parent/child lines unchanged (not touched by any step), lineage highlight unchanged (not touched), legend reduced to 3 entries (Step 3), detail panel untouched (verified in Step 6.4) — every requirement in the spec maps to a step.
- **Placeholder scan:** no TBDs; every step has literal before/after code or an exact command.
- **Type consistency:** N/A — single task, no cross-task interfaces.
