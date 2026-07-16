# Lineage Consistency Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two real, uncontroversial lineage-rendering issues found by a database-wide structural consistency check: a self-inflicted Ephraim/Manasseh dual-parent regression, and an inaccurate "All" tree label.

**Architecture:** Two independent, small fixes touching unrelated files. Task 1 is a one-off live-database correction script (same pattern as `scripts/fix-genesis-audit.ts`: dry-run flag, fail-loud existing-row resolution, controller reviews dry-run output before live execution). Task 2 is a single-line copy change in an existing component.

**Tech Stack:** TypeScript, `tsx`, `@libsql/client` (Turso) for Task 1; React/TSX for Task 2. No test framework (none exists in this project).

## Global Constraints

- Task 1's script must support `--dry-run` and must not execute against the live database except in an explicit, separate step the controller reviews first — same safety pattern already established and reviewed in `scripts/fix-genesis-audit.ts`.
- No schema changes. No new dependencies.
- Fix 2's Finding 2 (Matthew/Luke record convergence) and Finding 4 (dropped-mother relationships) from the design spec are explicitly out of scope for this plan — no task should touch them.

---

### Task 1: Fix Ephraim/Manasseh dual-male-parent regression

**Files:**
- Create: `scripts/fix-lineage-ephraim-manasseh.ts`

**Interfaces:** None — standalone script, not imported elsewhere.

- [ ] **Step 1: Write the script with a `--dry-run` gate**

Create `scripts/fix-lineage-ephraim-manasseh.ts`:

```typescript
import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN ?? process.env.TURSO_DATABASE_TURSO_AUTH_TOKEN,
});

const DRY_RUN = process.argv.includes("--dry-run");

async function resolveExisting(name: string, alsoKnownAs?: string): Promise<string> {
  const row = alsoKnownAs
    ? await db.execute({
        sql: "SELECT id FROM people WHERE name = ? AND also_known_as = ? LIMIT 1",
        args: [name, alsoKnownAs],
      })
    : await db.execute({
        sql: "SELECT id FROM people WHERE name = ? LIMIT 1",
        args: [name],
      });
  const r = row.rows[0] as unknown as { id: string } | undefined;
  if (!r) {
    throw new Error(`resolveExisting: could not find person name="${name}" aka="${alsoKnownAs ?? ""}" — aborting`);
  }
  return r.id;
}

async function resolveRelationship(aId: string, type: string, bId: string): Promise<string> {
  const row = await db.execute({
    sql: "SELECT id FROM relationships WHERE person_a_id = ? AND type = ? AND person_b_id = ?",
    args: [aId, type, bId],
  });
  if (row.rows.length === 0) {
    throw new Error(`resolveRelationship: no relationship found for (${aId}, ${type}, ${bId})`);
  }
  if (row.rows.length > 1) {
    throw new Error(`resolveRelationship: ${row.rows.length} relationships found for (${aId}, ${type}, ${bId}) — ambiguous`);
  }
  return (row.rows[0] as unknown as { id: string }).id;
}

async function updateRelationshipType(relId: string, newType: string, label: string) {
  console.log(`\n[${label}] UPDATE relationships.type -> "${newType}" (id: ${relId})`);
  if (DRY_RUN) return;
  await db.execute({
    sql: `UPDATE relationships SET type = ? WHERE id = ?`,
    args: [newType, relId],
  });
}

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN — no statements will be executed ===" : "=== LIVE RUN — mutating database ===");

  const jacobId = await resolveExisting("Jacob", "Israel");
  const manassehId = await resolveExisting("Manasseh", "Manasseh son of Joseph");
  const ephraimId = await resolveExisting("Ephraim");

  // Change type from parent_of -> other. This was added by the Genesis audit
  // (Finding S5, Gen 48:5's adoption) as a second parent_of edge alongside
  // Joseph's existing biological parent_of edge, creating a dual-male-parent
  // structural ambiguity buildLayout/buildForest's Pass 1 can't resolve
  // deterministically. "other" is an existing RelationshipType already
  // rendered by the detail panel (with its label/color), but not read by
  // any tree-structure logic (only parent_of is), so this preserves the
  // Gen 48:5 fact as fully visible while removing the structural conflict.
  // Joseph reverts to being Manasseh/Ephraim's sole tree-structural parent.
  const manassehRelId = await resolveRelationship(jacobId, "parent_of", manassehId);
  await updateRelationshipType(manassehRelId, "other", "jacob->manasseh");

  const ephraimRelId = await resolveRelationship(jacobId, "parent_of", ephraimId);
  await updateRelationshipType(ephraimRelId, "other", "jacob->ephraim");

  console.log(`\n${DRY_RUN ? "[DRY RUN] Would update" : "Updated"} 2 relationships.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (clean exit).

- [ ] **Step 3: Run the dry-run and report the output**

Run: `npx tsx scripts/fix-lineage-ephraim-manasseh.ts --dry-run`
Expected output: two `UPDATE relationships.type` log lines (one for `jacob->manasseh`, one for `jacob->ephraim`), each showing a resolved relationship id, followed by `[DRY RUN] Would update 2 relationships.` No errors — if `resolveExisting` or `resolveRelationship` throws, STOP and report; do not proceed past this step until the dry-run succeeds cleanly.

**Do not proceed to Step 4 without controller review of the Step 3 output** — this is the same review checkpoint pattern used for `scripts/fix-genesis-audit.ts`. Report the full dry-run output and stop; wait to be told to continue.

- [ ] **Step 4: Run the script for real (only after dry-run has been reviewed)**

Run: `npx tsx scripts/fix-lineage-ephraim-manasseh.ts`
Expected: `Updated 2 relationships.` with no errors.

- [ ] **Step 5: Verify live via the API**

Start the dev server (pick a free port among 3000-3004), log in with the passcode from `.env.local` (`ADMIN_PASSCODE`), then:

```bash
curl -s -c cookies.txt -X POST -H "Content-Type: application/json" -d '{"passcode":"<passcode>"}' http://localhost:<port>/api/auth/login
curl -s -b cookies.txt http://localhost:<port>/api/relationships -o rels.json
python3 -c "
import json
rels = json.load(open('rels.json'))
curl -s -b cookies.txt http://localhost:<port>/api/people -o people.json
"
```

Then confirm: the `jacob`→`manasseh` and `jacob`→`ephraim` relationships now have `type: "other"` (not `"parent_of"`), and the `joseph`→`manasseh`/`joseph`→`ephraim` `parent_of` relationships are unchanged. Stop the dev server when done. Delete `cookies.txt`/`rels.json`/`people.json` (scratch files, not for commit).

- [ ] **Step 6: Commit**

```bash
git add scripts/fix-lineage-ephraim-manasseh.ts
git commit -m "$(cat <<'EOF'
fix: resolve Ephraim/Manasseh dual-male-parent tree ambiguity

The Genesis audit's Gen 48:5 fix (commit a0a3c43) added
jacob parent_of manasseh/ephraim alongside their existing biological
joseph parent_of manasseh/ephraim relationships, giving both people
two competing male parent_of edges. buildLayout/buildForest's Pass 1
takes the first male parent encountered with no tie-breaking rule, so
which parent displayed became insertion-order-dependent.

Changes the two Jacob relationships from parent_of to other, an
existing RelationshipType already rendered in the detail panel but
not read by any tree-structure logic. The Gen 48:5 adoption fact
stays fully visible; Joseph reverts to being their sole structural
tree-parent, matching their position before the Genesis audit and
matching how tribal genealogies (Numbers, Joshua) count them.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Fix "All" tree's inaccurate subtitle

**Files:**
- Modify: `components/TreeCategoryPicker.tsx:148`

**Interfaces:** None — single-line JSX text change.

- [ ] **Step 1: Change the subtitle copy**

In `components/TreeCategoryPicker.tsx`, find:

```tsx
        <div className="category-tile-sub">The full Adam → Revelation tree</div>
```

Replace with:

```tsx
        <div className="category-tile-sub">The traceable bloodline from Adam</div>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Manual verification**

Start the dev server, log in, navigate to Family Tree section. Confirm the "All" card in the step-1 picker now reads "The traceable bloodline from Adam" instead of "The full Adam → Revelation tree." Stop the dev server when done.

- [ ] **Step 4: Commit**

```bash
git add components/TreeCategoryPicker.tsx
git commit -m "$(cat <<'EOF'
fix: correct "All" tree category card's overclaiming subtitle

The tree canvas only ever renders people with a traceable parent_of
chain back to Adam (171 of 503 people, 34%, per a database-wide
structural check) — anyone without one is invisible, not shown as a
disconnected node, since buildLayout has no forest fallback the way
the scoped family/book views do. "The full Adam -> Revelation tree"
overclaimed coverage the view doesn't have. The remaining 332 people
are already fully browsable via the People and By Book sections; this
is a labeling fix, not an architecture change (converting "All" into
a full forest was considered and rejected — it would reintroduce the
crowding problem this feature was built to solve).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Self-Review Notes

- **Spec coverage:** Fix 1 (Ephraim/Manasseh) → Task 1. Fix 2 ("All" label) → Task 2. Findings 2 and 4 are explicitly out of scope per the spec and per this plan's Global Constraints — no task touches them.
- **Placeholder scan:** no TBDs; every step has literal code, exact commands, or exact expected output.
- **Type consistency:** N/A — the two tasks are fully independent, no shared interfaces between them.
