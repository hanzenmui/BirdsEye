# Job Data Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every person, relationship, and scripture ref in `scripts/seed-job.ts` against the actual biblical text (ESV, fetched live), producing a findings document, then correct the live database to match — sixteenth of the planned per-book audit series.

**Architecture:** Single audit pass (5 new people), followed by a dry-run-safe correction script (same pattern as `scripts/fix-esther-audit.ts`, already reviewed and proven fifteen times), followed by post-correction verification.

**Tech Stack:** TypeScript, `tsx`, `@libsql/client` (Turso) for the correction script. WebFetch/WebSearch for source-text verification. No test framework (none exists in this project).

## Global Constraints

- **Source of truth:** ESV, fetched live via WebFetch/WebSearch for every claim checked — not recalled from memory.
- **In scope:** all 5 new people (Job, Eliphaz, Bildad, Zophar, Elihu), all 6 relationships, and all 10 scripture refs in `scripts/seed-job.ts`.
- **Out of scope:** any book other than this file's scope. The historical-vs-parable genre debate over Job is out of scope unless a specific checkable claim in the DB's description bears on it.
- **Findings categories:** exactly one of `Incorrect`, `Missing`, `Unsupported`, `Structural gap` per finding — never a compound value.
- **Priority:** (a) Job's numeric wealth claims (7,000 sheep, 3,000 camels, 500 yoke of oxen, ten children) and their ch. 42 restoration figures, (b) each friend's geographic origin/title (Eliphaz the Temanite, Bildad the Shuhite, Zophar the Naamathite) and Elihu's fuller genealogy (son of Barachel the Buzite, of the family of Ram), (c) the claim that God rebukes only the three friends, not Elihu, at the end (Job 42:7-9), (d) the claim that "Zophar only speaks twice... implying Job's responses silenced him" — check whether this is textually supportable as stated, (e) each speech's chapter-range attribution, with particular attention to Bildad's unusually short third speech (ch. 25) and whether the DB's clean 25:1-6 range needs a hedge, (f) all 10 refs' chapter:verse ranges and note text.
- **Coverage counts:** the required top-line summary (people/relationships/refs) must be independently grep-verifiable — every prior book's audit initially miscounted at least one of these. Actually grep-count, don't estimate. Expected: 5 people, 6 relationships, 10 refs — verify these yourself rather than trusting this summary.
- **Nothing gets written to the live database until Task 2** — Task 1 is pure research/documentation, producing markdown only.
- **Prefer direct `@libsql/client` verification scripts over the dev-server API route** for Task 3, given intermittent network issues observed in several prior books' audits.

---

### Task 1: Audit Job's People, Relationships & Refs

**Files:**
- Read: `scripts/seed-job.ts` (full file, 128 lines)
- Create: `docs/superpowers/specs/2026-07-22-job-data-audit-findings.md`

**Interfaces:**
- Produces: a findings markdown file Task 2 reads to write the correction script.

- [ ] **Step 1: Enumerate**

Read `scripts/seed-job.ts` in full. List all 5 people (`key`, `name`, `alsoKnownAs`, `gender`, `description`, `tags`), all 6 relationships, and all 10 scripture refs.

- [ ] **Step 2: Fetch source text**

Use WebFetch/WebSearch to retrieve the ESV text of Job 1-2 (Job's character, wealth, the wager, the losses), Job 2:11-13 (the friends' arrival), Job 4-5, 15, 22 (Eliphaz's three speeches), Job 8, 18, 25 (Bildad's three speeches), Job 11, 20 (Zophar's two speeches), Job 32-37 (Elihu's speeches, including his self-introduction/genealogy in 32:2), Job 38-41 (God's speech), Job 42 (the rebuke, restoration, and exact numeric figures). Do not answer from memory.

- [ ] **Step 3: Cross-reference**

For each of the 5 people: verify name, alternate names, gender, and that the description doesn't contradict the text — with special attention to Job's numeric wealth claims and their ch. 42 restoration figures, each friend's geographic origin/title, Elihu's fuller genealogy (32:2, son of Barachel the Buzite, of the family of Ram), the claim that God rebukes only the three friends and not Elihu (42:7-9 — check the verse's exact wording for who is named), and the "Zophar only speaks twice, implying Job's responses silenced him" claim (check whether ch. 27 or later chapters contain any third Zophar speech, or an unattributed speech some traditions assign to him). For each of the 6 relationships: verify it's textually supported and correctly typed. For each of the 10 refs: verify the chapter:verse range is correct and the note text accurately summarizes what's in that passage — pay particular attention to whether Bildad's third-speech range (25:1-6) is clean or whether it should account for the following chapters' complex attribution.

- [ ] **Step 4: Write findings**

Create `docs/superpowers/specs/2026-07-22-job-data-audit-findings.md`, one entry per finding:

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
git add docs/superpowers/specs/2026-07-22-job-data-audit-findings.md
git commit -m "$(cat <<'EOF'
docs: add Job data audit findings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Write the Correction Script and Run a Dry-Run Only

**Files:**
- Read: `docs/superpowers/specs/2026-07-22-job-data-audit-findings.md` (Task 1's output)
- Read: `scripts/fix-esther-audit.ts` (for the exact DB access + dry-run pattern to reuse verbatim, including the `resolveScriptureRef` helper if a ref-note fix is needed)
- Create: `scripts/fix-job-audit.ts`

**Interfaces:** None — standalone script.

This task stops after the dry-run. Do NOT execute the script for real or commit — that happens only after controller review, as a separate follow-up.

- [ ] **Step 1: Write the script**

Create `scripts/fix-job-audit.ts` following `scripts/fix-esther-audit.ts`'s exact pattern (same imports, same `.env.local` loading, same `DRY_RUN` gate, same fail-loud `resolveExisting`/`resolveRelationship` helpers, and `resolveScriptureRef` if a finding requires correcting a ref's note text directly). For each finding in the findings document, implement it as `INSERT OR IGNORE` (new person/relationship/ref), `UPDATE` (wrong field), or `DELETE` (unsupported relationship/ref), with a comment directly above each statement citing which finding it implements. If a finding is about a relationship's own characterization (not just a description-text detail), soften both the person description and the relationship's notes field via `resolveRelationship`, per this series' established precedent. If the findings document has zero findings, the script only needs to report "no corrections needed" and exit cleanly — do not invent statements to implement.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Run the dry-run and report the output**

Run: `npx tsx scripts/fix-job-audit.ts --dry-run`
Report the full output. If any resolver call throws, STOP and report BLOCKED with the exact error rather than guessing at a fix.

**Do not proceed past this step without controller review.** Report the full dry-run output and stop.

---

### Task 3: Live Execution and Post-Correction Verification

**Files:** `scripts/fix-job-audit.ts` (run, not modified further unless Task 2's dry-run needed a fix first)

**Interfaces:**
- Consumes: the reviewed, approved script from Task 2.

This task only starts once Task 2's dry-run has been reviewed and approved. If Task 1 found zero findings, this task still runs the script (to confirm it reports "no corrections needed" cleanly) and still performs Step 3 below.

- [ ] **Step 1: Run the script for real**

Run: `npx tsx scripts/fix-job-audit.ts`
Expected: matches the dry-run's statement count, no errors.

- [ ] **Step 2: Verify live via a direct DB query script**

Write a small script matching `scripts/fix-job-audit.ts`'s `.env.local`/`@libsql/client` connection pattern, query the affected rows directly, and confirm the specific corrections from the findings document are actually present. Delete the scratch script when done.

- [ ] **Step 3: Run the curated-family check**

Read `lib/families.ts`'s member lists and check whether any of this book's 5 people appear in any curated family's roster. If none do, note this and skip the `buildForest` chain-completeness check. If any do, read `components/FamilyTree.tsx`'s `resolveFamilyMembers`/`buildForest` functions and run that chain-completeness check for the affected family.

- [ ] **Step 4: Commit**

```bash
git add scripts/fix-job-audit.ts
git commit -m "$(cat <<'EOF'
fix: apply Job data audit corrections to live database

Implements every finding from
docs/superpowers/specs/2026-07-22-job-data-audit-findings.md
against the live Turso database. Controller reviewed the dry-run
output and script source before live execution, then independently
verified the result against a fresh live data pull, including a
curated-family roster check.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Self-Review Notes

- **Spec coverage:** enumeration + cross-referencing + findings (Task 1), correction script with dry-run safety (Task 2), live execution + verification (Task 3) — every section of the design spec has a task, including the Elihu-not-rebuked and Zophar-two-speeches checks called out explicitly in Task 1 Step 3.
- **Placeholder scan:** no TBDs; Task 1 points to the full file (128 lines) rather than inlining content, matching the already-accepted approach from prior books' plans. Task 2/3 explicitly handle the possible zero-findings case.
- **Type consistency:** N/A — this plan produces documentation and a standalone script, not a shared codebase interface.
