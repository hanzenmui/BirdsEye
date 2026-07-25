# Daniel Data Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every person, relationship, and scripture ref in `scripts/seed-daniel.ts` against the actual biblical text (ESV, fetched live), producing a findings document, then correct the live database to match — twentieth of the planned per-book audit series, and the last Old Testament book in the series.

**Architecture:** Single audit pass (6 new people), followed by a dry-run-safe correction script (same pattern as `scripts/fix-prophets-audit.ts`, already reviewed and proven nineteen times), followed by post-correction verification.

**Tech Stack:** TypeScript, `tsx`, `@libsql/client` (Turso) for the correction script. WebFetch/WebSearch for source-text verification. No test framework (none exists in this project).

## Global Constraints

- **Source of truth:** ESV, fetched live via WebFetch/WebSearch for every claim checked — not recalled from memory.
- **In scope:** all 6 new people (Daniel, Hananiah, Mishael, Azariah, Belshazzar, Darius the Mede) — including name/alsoKnownAs/description/tags/gender — all 9 relationships, and all 7 scripture refs in `scripts/seed-daniel.ts`.
- **Out of scope:** re-auditing Nebuchadnezzar's own person record (owned by 2 Kings, loaded via `loadExisting`) — only the new relationships/ref this file adds referencing him are in scope; any book other than this file's scope.
- **Findings categories:** exactly one of `Incorrect`, `Missing`, `Unsupported`, `Structural gap` per finding — never a compound value.
- **Priority:** (a) Belshazzar's genealogy claim ("son of Nabonidus... Daniel calls him Nebuchadnezzar's son, likely in a dynastic sense") — verify both the text's repeated "son of Nebuchadnezzar" language and the standard historical resolution, (b) Darius the Mede's "historical identity is debated" hedge — verify it reflects the real scholarly question accurately, (c) the fiery furnace "fourth... like a son of the gods" wording against Dan 3:25, (d) the four young men's Babylonian-renaming claims (Dan 1:7), (e) both `insertRelByName` cross-seed lookups to Nebuchadnezzar — confirm they actually resolve rather than silently warning and skipping, (f) all 7 refs' chapter:verse ranges, especially the two whole-book-spanning refs and the Belshazzar/Darius chapter-5/6 boundary split.
- **Coverage counts:** the required top-line summary (people/relationships/refs) must be independently grep-verifiable — every prior book's audit initially miscounted at least one of these. Actually grep-count, don't estimate. Expected: 6 people, 9 relationships, 7 refs — verify these yourself rather than trusting this summary.
- **Nothing gets written to the live database until Task 2** — Task 1 is pure research/documentation, producing markdown only.
- **Prefer direct `@libsql/client` verification scripts over the dev-server API route** for Task 3, given intermittent network issues observed in several prior books' audits.

---

### Task 1: Audit Daniel's People, Relationships & Refs

**Files:**
- Read: `scripts/seed-daniel.ts` (full file, 166 lines)
- Create: `docs/superpowers/specs/2026-07-25-daniel-data-audit-findings.md`

**Interfaces:**
- Produces: a findings markdown file Task 2 reads to write the correction script.

- [ ] **Step 1: Enumerate**

Read `scripts/seed-daniel.ts` in full. List all 6 people (`key`, `name`, `alsoKnownAs`, `gender`, `description`, `tags`), all 9 relationships (including the 2 `insertRelByName` calls to Nebuchadnezzar), and all 7 scripture refs (including the 1 guarded ref to Nebuchadnezzar).

- [ ] **Step 2: Fetch source text**

Use WebFetch/WebSearch to retrieve the ESV text of Daniel 1 (the four young men, food test, taking to Babylon), Daniel 2 (statue dream), Daniel 3 (golden image, fiery furnace, "fourth... like a son of the gods"), Daniel 4 (Nebuchadnezzar's tree dream and madness), Daniel 5 (Belshazzar's feast, temple vessels, handwriting on the wall, his death, transfer of kingdom — especially the repeated "son of Nebuchadnezzar" language at 5:2, 5:11, 5:18-22), Daniel 6 (Darius's decree, lions' den), and a summary pass of Daniel 7-12 (apocalyptic visions) for Daniel's own description claims. Also research the standard historical/scholarly resolution of Belshazzar's actual parentage (Nabonidus) and the "Darius the Mede" identity question. Do not answer from memory.

- [ ] **Step 3: Cross-reference**

For each of the 6 people: verify name, alternate names, gender, and that the description doesn't contradict the text — with special attention to Belshazzar's genealogy claim (text says "son of Nebuchadnezzar" but historically he was Nabonidus's son/co-regent — check the DB's hedge is accurate and appropriately worded) and Darius the Mede's "historical identity is debated" hedge. For each of the 9 relationships: verify it's textually supported and correctly typed — specifically confirm both `insertRelByName("Nebuchadnezzar", ...)` calls actually resolve against the live DB rather than silently warning and skipping (check console output/DB state, don't assume success). For each of the 7 refs: verify the chapter:verse range is correct and the note text accurately summarizes what's in that passage, including whether Daniel's own 1:1-12:13 whole-book ref and Nebuchadnezzar's 1:1-4:37 ref are accurate, and whether the Belshazzar 5:1-5:30 / Darius 5:31-6:28 split lands on the correct verse boundary (Dan 5:30-31 is the actual narrative hinge).

- [ ] **Step 4: Write findings**

Create `docs/superpowers/specs/2026-07-25-daniel-data-audit-findings.md`, one entry per finding:

```markdown
## Finding N: <short description>
- **Category:** Incorrect | Missing | Unsupported | Structural gap
- **Verse(s):** <citation>
- **Current DB state:** <what's there now — key, field, or relationship>
- **Proposed correction:** <exact new value or exact new/removed relationship>
- **Severity:** Critical | Important | Minor
```

Only write findings for actual discrepancies. Reserve "Critical" strictly for structural gaps (missing people/relationships with cascading downstream effects) — every book's audit in this series except the very first has topped out at "Important" for single-field corrections. At the top of the file, add: `Reviewed: <N> people, <M> relationships, <K> refs. <F> findings.` — grep-count `N`/`M`/`K` yourself against the actual file before writing this line. If you notice something worth flagging but are unsure it clears the "actual discrepancy" bar, include it anyway with your reasoning. If a finding is genuinely borderline with no single clearly-correct fix, present it non-prescriptively (per the Wisdom books audit's Finding 4 precedent).

- [ ] **Step 5: Triple-check**

Re-verify every finding against the actual fetched text once more. Then do a second full read-through of the findings list checking for contradictions.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-07-25-daniel-data-audit-findings.md
git commit -m "$(cat <<'EOF'
docs: add Daniel data audit findings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Write the Correction Script and Run a Dry-Run Only

**Files:**
- Read: `docs/superpowers/specs/2026-07-25-daniel-data-audit-findings.md` (Task 1's output)
- Read: `scripts/fix-prophets-audit.ts` (for the exact DB access + dry-run pattern to reuse verbatim)
- Create: `scripts/fix-daniel-audit.ts`

**Interfaces:** None — standalone script.

This task stops after the dry-run. Do NOT execute the script for real or commit — that happens only after controller review, as a separate follow-up.

- [ ] **Step 1: Write the script**

Create `scripts/fix-daniel-audit.ts` following `scripts/fix-prophets-audit.ts`'s exact pattern (same imports, same `.env.local` loading, same `DRY_RUN` gate, same fail-loud resolver helpers, plus new-ref `INSERT OR IGNORE` statements if a finding requires them). For each finding, implement it as `INSERT OR IGNORE` (new person/relationship/ref), `UPDATE` (wrong field), or `DELETE` (unsupported relationship/ref), with a comment directly above each statement citing which finding it implements. If the findings document has zero findings, the script only needs to report "no corrections needed" and exit cleanly. **Reminder:** `scripture_refs` has no unique constraint, so any new-ref `INSERT` statements are not idempotent — flag this clearly for Task 3 if this book's findings require any.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Run the dry-run and report the output**

Run: `npx tsx scripts/fix-daniel-audit.ts --dry-run`
Report the full output. If any resolver call throws, STOP and report BLOCKED with the exact error rather than guessing at a fix.

**Do not proceed past this step without controller review.** Report the full dry-run output and stop.

---

### Task 3: Live Execution and Post-Correction Verification

**Files:** `scripts/fix-daniel-audit.ts` (run, not modified further unless Task 2's dry-run needed a fix first)

**Interfaces:**
- Consumes: the reviewed, approved script from Task 2.

This task only starts once Task 2's dry-run has been reviewed and approved. If Task 1 found zero findings, this task still runs the script (to confirm it reports "no corrections needed" cleanly) and still performs Step 3 below.

- [ ] **Step 1: Run the script for real**

Run: `npx tsx scripts/fix-daniel-audit.ts`
Expected: matches the dry-run's statement count, no errors. If any new-ref `INSERT` statements are present, run this exactly once and verify no duplicate rows afterward.

- [ ] **Step 2: Verify live via a direct DB query script**

Write a small script matching `scripts/fix-daniel-audit.ts`'s `.env.local`/`@libsql/client` connection pattern, query the affected rows directly, and confirm the specific corrections from the findings document are actually present. Delete the scratch script when done.

- [ ] **Step 3: Run the curated-family check**

Read `lib/families.ts`'s member lists and check whether any of this book's 6 new people, or Nebuchadnezzar, appear in any curated family's roster. If any do, read `components/FamilyTree.tsx`'s `resolveFamilyMembers`/`buildForest` functions and run that chain-completeness check for the affected family. If none do, note this and skip the check.

- [ ] **Step 4: Commit**

```bash
git add scripts/fix-daniel-audit.ts
git commit -m "$(cat <<'EOF'
fix: apply Daniel data audit corrections to live database

Implements every finding from
docs/superpowers/specs/2026-07-25-daniel-data-audit-findings.md
against the live Turso database. Controller reviewed the dry-run
output and script source before live execution, then independently
verified the result against a fresh live data pull, including a
curated-family roster check.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Self-Review Notes

- **Spec coverage:** enumeration + cross-referencing + findings (Task 1), correction script with dry-run safety (Task 2), live execution + verification (Task 3) — every section of the design spec has a task, including the Belshazzar genealogy and `insertRelByName` resolution checks called out explicitly in Task 1 Step 3.
- **Placeholder scan:** no TBDs; Task 1 points to the full file (166 lines) rather than inlining content. Task 2/3 explicitly handle the possible zero-findings case and carry forward the non-idempotent-INSERT caution.
- **Type consistency:** N/A — this plan produces documentation and a standalone script, not a shared codebase interface.
