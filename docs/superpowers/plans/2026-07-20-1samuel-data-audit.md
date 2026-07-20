# 1 Samuel Data Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every person, relationship, and scripture ref in `scripts/seed-1samuel.ts` against the actual 1 Samuel text (ESV, fetched live), producing a findings document, then correct the live database to match — eighth of the planned per-book audit series.

**Architecture:** Single audit pass (22 new people, comparable to Judges), followed by a dry-run-safe correction script (same pattern as `scripts/fix-ruth-audit.ts`, already reviewed and proven seven times), followed by post-correction verification that must actually run the `buildForest` chain-completeness check since `david_family` already includes several of this book's people (Saul, Abigail, Nabal).

**Tech Stack:** TypeScript, `tsx`, `@libsql/client` (Turso) for the correction script. WebFetch/WebSearch for source-text verification. No test framework (none exists in this project).

## Global Constraints

- **Source of truth:** ESV, fetched live via WebFetch/WebSearch for every claim checked — not recalled from memory.
- **In scope:** all 22 new people, all 28 relationships, and all 22 scripture refs in `scripts/seed-1samuel.ts`.
- **Out of scope:** re-auditing Jesse/Judah/Benjamin's own person records (owned by their originating books) — only the relationships this file adds referencing them are in scope; 2 Samuel (a separate, subsequent audit); any book other than 1 Samuel.
- **Findings categories:** exactly one of `Incorrect`, `Missing`, `Unsupported`, `Structural gap` per finding — never a compound value.
- **Priority:** (a) Goliath's physical description (height "six cubits and a span," armor weight, weapon details) — a well-known ancient-manuscript textual variant (4QSam-a and the LXX give "four cubits and a span," shorter than the Masoretic Text's "six cubits and a span") worth checking whether the DB states the MT figure as uncontested fact or should note the variant, (b) the priests-of-Nob massacre count (85 in the MT) and Doeg's role, (c) the David/Jesse/Judah relationship chain's consistency with what the Ruth audit already established, (d) Eli's sons' explicit disambiguation from the unrelated Phinehas son of Eleazar, (e) all 22 refs' chapter:verse ranges and note text.
- **Coverage counts:** the required top-line summary (people/relationships/refs) must be independently grep-verifiable — every prior book's audit initially miscounted at least one of these. Actually grep-count, don't estimate. Expected: 22 people, 28 relationships, 22 refs — verify these yourself rather than trusting this summary.
- **Nothing gets written to the live database until Task 2** — Task 1 is pure research/documentation, producing markdown only.
- **The `relationships` table now has a `UNIQUE(person_a_id, type, person_b_id)` index** (added in commit `7292aa9`) — `INSERT OR IGNORE` for relationships is now genuinely idempotent. A `relationshipExists()` guard (as used in `fix-ruth-audit.ts`) is no longer strictly necessary for pure inserts, but is still good practice for any statement that conditionally inserts based on current state — use judgment per finding.

---

### Task 1: Audit 1 Samuel's People, Relationships & Refs

**Files:**
- Read: `scripts/seed-1samuel.ts` (full file, 301 lines)
- Read: `docs/superpowers/specs/2026-07-20-ruth-data-audit-findings.md` (for the established David/Jesse/Judah chain context, since this book's relationships continue it)
- Create: `docs/superpowers/specs/2026-07-20-1samuel-data-audit-findings.md`

**Interfaces:**
- Produces: a findings markdown file Task 2 reads to write the correction script.

- [ ] **Step 1: Enumerate**

Read `scripts/seed-1samuel.ts` in full. List all 22 people (`key`, `name`, `alsoKnownAs`, `gender`, `description`, `tags`), all 28 relationships, and all 22 scripture refs.

- [ ] **Step 2: Fetch source text**

Use WebFetch/WebSearch to retrieve the ESV text of 1 Samuel 1-3 (Hannah, Elkanah, Peninnah, Eli, Hophni, Phinehas, Samuel's birth/dedication/calling), 4 (Hophni and Phinehas's deaths), 9-15 (Saul's rise, Kish, Jonathan, the kingdom, Saul's rejection), 16-17 (David's anointing, Goliath), 18-20 (Jonathan's covenant, Michal, Saul's jealousy), 21-22 (Nob, Ahimelech, Doeg, Abiathar), 25 (Nabal, Abigail), 27-29 (Achish, Ziklag), 31 (Saul and Jonathan's deaths). Also specifically research the Goliath height textual-variant question (4QSam-a/LXX "four cubits and a span" vs. MT "six cubits and a span") via WebSearch — this is a well-documented textual-criticism topic, verify it doesn't come from memory alone. Do not answer from memory.

- [ ] **Step 3: Cross-reference**

For each of the 22 people: verify name, alternate names, gender, and that the description doesn't contradict the text — with special attention to Goliath's height/armor claims (check whether the DB states the six-cubit MT figure as flat fact, and whether that's defensible the way Numbers/Judges audits have handled other textual-tradition splits, i.e. noting genuine ambiguity rather than treating a majority reading as automatically wrong), the 85-priests-of-Nob count (1 Sam 22:18), and Eli's sons' disambiguation from Phinehas son of Eleazar (already in the DB from Exodus/Numbers — confirm the description's "not to be confused with" note is accurate). For the four relationships referencing pre-existing people (`Jesse parent_of David`, `Judah ancestor_of david`, `Benjamin ancestor_of saul`, `Benjamin ancestor_of kish`): confirm they're textually supported and consistent with how Jesse/Judah/Benjamin are already represented in the DB (read the Ruth findings doc for the Jesse/Judah context). For each relationship: verify it's textually supported and correctly typed. For each of the 22 refs: verify the chapter:verse range is correct and the note text accurately summarizes what's in that passage.

- [ ] **Step 4: Write findings**

Create `docs/superpowers/specs/2026-07-20-1samuel-data-audit-findings.md`, one entry per finding:

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
git add docs/superpowers/specs/2026-07-20-1samuel-data-audit-findings.md
git commit -m "$(cat <<'EOF'
docs: add 1 Samuel data audit findings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Write the Correction Script and Run a Dry-Run Only

**Files:**
- Read: `docs/superpowers/specs/2026-07-20-1samuel-data-audit-findings.md` (Task 1's output)
- Read: `scripts/fix-ruth-audit.ts` (for the exact DB access + dry-run pattern to reuse verbatim, including the `relationshipExists()` helper pattern if needed)
- Create: `scripts/fix-1samuel-audit.ts`

**Interfaces:** None — standalone script.

This task stops after the dry-run. Do NOT execute the script for real or commit — that happens only after controller review, as a separate follow-up.

- [ ] **Step 1: Write the script**

Create `scripts/fix-1samuel-audit.ts` following `scripts/fix-ruth-audit.ts`'s exact pattern (same imports, same `.env.local` loading, same `DRY_RUN` gate, same fail-loud `resolveExisting`/`resolveRelationship` helpers, including the `alsoKnownAs !== undefined` fix already applied there — not the pre-fix truthiness version). For each finding in the findings document, implement it as `INSERT OR IGNORE` (new person/relationship/ref — this is now genuinely idempotent thanks to the unique index), `UPDATE` (wrong field), or `DELETE` (unsupported relationship/ref), with a comment directly above each statement citing which finding it implements. If the findings document has zero findings, the script only needs to report "no corrections needed" and exit cleanly — do not invent statements to implement.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Run the dry-run and report the output**

Run: `npx tsx scripts/fix-1samuel-audit.ts --dry-run`
Report the full output. If any `resolveExisting`/`resolveRelationship` call throws, STOP and report BLOCKED with the exact error rather than guessing at a fix.

**Do not proceed past this step without controller review.** Report the full dry-run output and stop.

---

### Task 3: Live Execution and Post-Correction Verification

**Files:** `scripts/fix-1samuel-audit.ts` (run, not modified further unless Task 2's dry-run needed a fix first)

**Interfaces:**
- Consumes: the reviewed, approved script from Task 2.

This task only starts once Task 2's dry-run has been reviewed and approved. If Task 1 found zero findings, this task still runs the script (to confirm it reports "no corrections needed" cleanly) and still performs Step 3 below.

- [ ] **Step 1: Run the script for real**

Run: `npx tsx scripts/fix-1samuel-audit.ts`
Expected: matches the dry-run's statement count, no errors.

- [ ] **Step 2: Verify live via the API**

Start the dev server (pick a free port among 3000-3004; run `npm install` first if `node_modules` is missing in this worktree), log in with the passcode from `.env.local` (`ADMIN_PASSCODE`), pull `/api/people` and `/api/relationships` with the authenticated session cookie, and confirm the specific corrections from the findings document are actually present. Stop the dev server when done; delete any scratch cookie/JSON files.

- [ ] **Step 3: Run the curated-family chain-completeness check**

Read `lib/families.ts`'s `david_family` roster (around line 55-58) — it already includes `Jesse`, `David`, and (per prior grep) `Saul`, `Abigail`, `Nabal` among others. Read `components/FamilyTree.tsx`'s `resolveFamilyMembers`/`buildForest` functions, then run the same `buildForest`/`resolveFamilyMembers` chain-completeness check used in prior audits' final verification steps against the live, post-correction data for `david_family` — confirm every 1-Samuel-audited person who's a roster member (Saul, Abigail, Nabal, David, and any others matching the roster) resolves correctly with no ambiguous duplicate-name collisions, and that the family's forest doesn't show unexpected disconnection. Also confirm none of this book's other people unexpectedly appear in any other curated family's roster.

- [ ] **Step 4: Commit**

```bash
git add scripts/fix-1samuel-audit.ts
git commit -m "$(cat <<'EOF'
fix: apply 1 Samuel data audit corrections to live database

Implements every finding from
docs/superpowers/specs/2026-07-20-1samuel-data-audit-findings.md
against the live Turso database. Controller reviewed the dry-run
output and script source before live execution, then independently
verified the result against a fresh live data pull, including a
buildForest chain-completeness check on the david_family curated
roster (Saul, Abigail, Nabal, David are members).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Self-Review Notes

- **Spec coverage:** enumeration + cross-referencing + findings (Task 1), correction script with dry-run safety (Task 2), live execution + verification (Task 3) — every section of the design spec has a task, including the explicit `david_family` chain-completeness check called out in Task 3 Step 3 and the Goliath textual-variant research called out in Task 1 Step 2.
- **Placeholder scan:** no TBDs; Task 1 points to the full file (301 lines) rather than inlining content, matching the already-accepted approach from prior books' plans. Task 2/3 explicitly handle the possible zero-findings case.
- **Type consistency:** N/A — this plan produces documentation and a standalone script, not a shared codebase interface.
