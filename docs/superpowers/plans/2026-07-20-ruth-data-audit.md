# Ruth Data Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every person, relationship, and scripture ref in `scripts/seed-ruth.ts` against the actual Ruth text (ESV, fetched live), producing a findings document, then correct the live database to match — seventh of the planned per-book audit series.

**Architecture:** Single audit pass (10 new people, one of the smaller books audited), followed by a dry-run-safe correction script (same pattern as `scripts/fix-judges-audit.ts`, already reviewed and proven six times), followed by post-correction verification that, unlike most prior books, must actually run the `buildForest` chain-completeness check since Jesse is a confirmed member of the curated `david_family`.

**Tech Stack:** TypeScript, `tsx`, `@libsql/client` (Turso) for the correction script. WebFetch/WebSearch for source-text verification. No test framework (none exists in this project).

## Global Constraints

- **Source of truth:** ESV, fetched live via WebFetch/WebSearch for every claim checked — not recalled from memory.
- **In scope:** all 10 new people (Elimelech, Naomi, Mahlon, Chilion, Ruth, Orpah, Salmon, Boaz, Obed, Jesse), all 16 relationships, and all 12 scripture refs in `scripts/seed-ruth.ts` — including the manual cross-book ref insert to Rahab (lines 183-191).
- **Out of scope:** re-auditing Rahab's or Nahshon's own person records (owned by Joshua and Numbers respectively) — only the two relationships this file adds referencing them are in scope; re-auditing the Perez-through-Amminadab genealogical chain beyond confirming `Nahshon parent_of Salmon` continues it correctly; seeding a person record for the unnamed nearer kinsman (Ruth 4:1); any book other than Ruth.
- **Findings categories:** exactly one of `Incorrect`, `Missing`, `Unsupported`, `Structural gap` per finding — never a compound value.
- **Priority:** (a) Naomi's name-change to "Mara" and its stated reason match Ruth 1:20-21 precisely, (b) the full genealogical chain Salmon→Boaz→Obed→Jesse matches Ruth 4:18-22 exactly, (c) the two `Judah ancestor_of` relationships (Elimelech, Boaz) target the correct "Judah" person record — multiple "Judah" records exist in the DB (the patriarch and "Judah son of Joseph" from Luke's genealogy), (d) the manual cross-book Rahab ref insert (lines 183-191) is textually accurate and behaves consistently with the `insertRef` helper's normal pattern, (e) all 12 refs' chapter:verse ranges and note text are accurate.
- **Coverage counts:** the required top-line summary (people/relationships/refs) must be independently grep-verifiable — every prior book's audit initially miscounted at least one of these. Actually grep-count, don't estimate. Expected: 10 people, 16 relationships, 12 refs (11 via `insertRef` + 1 manual raw insert for Rahab) — verify these yourself rather than trusting this summary.
- **Nothing gets written to the live database until Task 2** — Task 1 is pure research/documentation, producing markdown only.

---

### Task 1: Audit Ruth's People, Relationships & Refs

**Files:**
- Read: `scripts/seed-ruth.ts` (full file, 214 lines)
- Read: `lib/families.ts` (to confirm Jesse's presence in `david_family`'s member list, already confirmed by the controller: `{ name: "Jesse" }` at line 55)
- Create: `docs/superpowers/specs/2026-07-20-ruth-data-audit-findings.md`

**Interfaces:**
- Produces: a findings markdown file Task 2 reads to write the correction script.

- [ ] **Step 1: Enumerate**

Read `scripts/seed-ruth.ts` in full. List all 10 people (`key`, `name`, `alsoKnownAs`, `gender`, `description`, `tags`), all 16 relationships, and all 12 scripture refs (11 via the `insertRef` helper plus the manual raw `db.execute` cross-book ref for Rahab at lines 183-191).

- [ ] **Step 2: Fetch source text**

Use WebFetch/WebSearch to retrieve the ESV text of Ruth 1 (Elimelech's family, the move to Moab, deaths, Naomi's return, Ruth's declaration, Orpah's departure, the "Mara" name change), Ruth 2 (gleaning, Boaz's generosity), Ruth 3 (the threshing floor), and Ruth 4 (the gate redemption, marriage, Obed's birth, the closing genealogy — 4:18-22). Also fetch Matthew 1:4-5 to cross-check the Salmon/Rahab/Boaz description claims. Do not answer from memory.

- [ ] **Step 3: Cross-reference**

For each of the 10 people: verify name, alternate names, gender, and that the description doesn't contradict the text — with special attention to Naomi's "Mara" name change (exact wording and stated reason, Ruth 1:20-21) and the closing genealogy (Ruth 4:18-22: does the DB's Salmon→Boaz→Obed→Jesse chain match exactly, including whether Jesse's other sons or David are mentioned in a way the DB should reflect). For the `Judah ancestor_of` relationships: check `scripts/seed-genesis.ts` and `scripts/seed-luke-lineage.ts` (or wherever the multiple "Judah" records originate) to confirm which "Judah" `insertRelNameToLocal("Judah", "ancestor_of", ...)` resolves to by default (bare-name lookup with no `also_known_as` disambiguation) — flag a Structural gap or Incorrect finding if it's ambiguous or resolves to the wrong one. For the manual Rahab ref insert: confirm its SQL/args produce the same shape of row the `insertRef` helper would (same columns, same `INSERT OR IGNORE` semantics) and that its note text is textually accurate. For each relationship: verify it's textually supported and correctly typed. For each of the 12 refs: verify the chapter:verse range is correct and the note text accurately summarizes what's in that passage.

- [ ] **Step 4: Write findings**

Create `docs/superpowers/specs/2026-07-20-ruth-data-audit-findings.md`, one entry per finding:

```markdown
## Finding N: <short description>
- **Category:** Incorrect | Missing | Unsupported | Structural gap
- **Verse(s):** <citation>
- **Current DB state:** <what's there now — key, field, or relationship>
- **Proposed correction:** <exact new value or exact new/removed relationship>
- **Severity:** Critical | Important | Minor
```

Only write findings for actual discrepancies. At the top of the file, add: `Reviewed: <N> people, <M> relationships, <K> refs. <F> findings.` — grep-count `N`/`M`/`K` yourself against the actual file before writing this line. If you notice something worth flagging but are unsure it clears the "actual discrepancy" bar, include it anyway with your reasoning — prior books' audits initially declined real findings this way, and it's better to include a borderline observation for the controller to judge than to silently omit it.

- [ ] **Step 5: Triple-check**

Re-verify every finding against the actual fetched text once more. Then do a second full read-through of the findings list checking for contradictions.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-07-20-ruth-data-audit-findings.md
git commit -m "$(cat <<'EOF'
docs: add Ruth data audit findings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Write the Correction Script and Run a Dry-Run Only

**Files:**
- Read: `docs/superpowers/specs/2026-07-20-ruth-data-audit-findings.md` (Task 1's output)
- Read: `scripts/fix-judges-audit.ts` (for the exact DB access + dry-run pattern to reuse verbatim)
- Create: `scripts/fix-ruth-audit.ts`

**Interfaces:** None — standalone script.

This task stops after the dry-run. Do NOT execute the script for real or commit — that happens only after controller review, as a separate follow-up.

- [ ] **Step 1: Write the script**

Create `scripts/fix-ruth-audit.ts` following `scripts/fix-judges-audit.ts`'s exact pattern (same imports, same `.env.local` loading, same `DRY_RUN` gate, same fail-loud `resolveExisting`/`resolveRelationship` helpers). For each finding in the findings document, implement it as `INSERT OR IGNORE` (new person/relationship/ref), `UPDATE` (wrong field), or `DELETE` (unsupported relationship/ref), with a comment directly above each statement citing which finding it implements. If the findings document has zero findings, the script only needs to report "no corrections needed" and exit cleanly — do not invent statements to implement.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Run the dry-run and report the output**

Run: `npx tsx scripts/fix-ruth-audit.ts --dry-run`
Report the full output. If any `resolveExisting`/`resolveRelationship` call throws, STOP and report BLOCKED with the exact error rather than guessing at a fix.

**Do not proceed past this step without controller review.** Report the full dry-run output and stop.

---

### Task 3: Live Execution and Post-Correction Verification

**Files:** `scripts/fix-ruth-audit.ts` (run, not modified further unless Task 2's dry-run needed a fix first)

**Interfaces:**
- Consumes: the reviewed, approved script from Task 2.

This task only starts once Task 2's dry-run has been reviewed and approved. If Task 1 found zero findings, this task still runs the script (to confirm it reports "no corrections needed" cleanly) and still performs Step 3 below.

- [ ] **Step 1: Run the script for real**

Run: `npx tsx scripts/fix-ruth-audit.ts`
Expected: matches the dry-run's statement count, no errors.

- [ ] **Step 2: Verify live via the API**

Start the dev server (pick a free port among 3000-3004), log in with the passcode from `.env.local` (`ADMIN_PASSCODE`), pull `/api/people` and `/api/relationships` with the authenticated session cookie, and confirm the specific corrections from the findings document are actually present. Stop the dev server when done; delete any scratch cookie/JSON files.

- [ ] **Step 3: Run the curated-family chain-completeness check**

Unlike most prior books, `lib/families.ts`'s `david_family` roster (line 55) already includes `{ name: "Jesse" }`, and Jesse is one of this book's audited people (son of Obed, father of David). Read `lib/families.ts` and `components/FamilyTree.tsx`'s `resolveFamilyMembers`/`buildForest` functions, then run the same `buildForest`/`resolveFamilyMembers` chain-completeness check used in prior audits' final verification steps against the live, post-correction data for `david_family` — confirm Jesse resolves correctly and connects into the rest of the family's forest (Jesse→David and any ancestor edges this book adds, e.g. Obed→Jesse) without a disconnected-component or duplicate-name resolution problem. Also confirm none of the other 9 Ruth-audited people (Elimelech, Naomi, Mahlon, Chilion, Ruth, Orpah, Salmon, Boaz, Obed) appear unexpectedly in any other curated family's roster.

- [ ] **Step 4: Commit**

```bash
git add scripts/fix-ruth-audit.ts
git commit -m "$(cat <<'EOF'
fix: apply Ruth data audit corrections to live database

Implements every finding from
docs/superpowers/specs/2026-07-20-ruth-data-audit-findings.md
against the live Turso database. Controller reviewed the dry-run
output and script source before live execution, then independently
verified the result against a fresh live data pull, including a
buildForest chain-completeness check on the david_family curated
roster (Jesse is a member).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Self-Review Notes

- **Spec coverage:** enumeration + cross-referencing + findings (Task 1), correction script with dry-run safety (Task 2), live execution + verification (Task 3) — every section of the design spec has a task, including the explicit `david_family`/Jesse chain-completeness check called out in Task 3 Step 3 (this is the one prior-book verification step that can't be skipped as "likely clear" here).
- **Placeholder scan:** no TBDs; Task 1 points to the full file (214 lines) rather than inlining content, matching the already-accepted approach from prior books' plans. Task 2/3 explicitly handle the possible zero-findings case.
- **Type consistency:** N/A — this plan produces documentation and a standalone script, not a shared codebase interface.
