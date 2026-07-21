# Late Kings of Judah Data Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every person, relationship, and scripture ref in `scripts/seed-late-kings.ts` against the actual biblical text (ESV, fetched live), producing a findings document, then correct the live database to match — twelfth of the planned per-book audit series.

**Architecture:** Single audit pass (5 new people, one of the smallest books in this series), followed by a dry-run-safe correction script (same pattern as `scripts/fix-2kings-audit.ts`, already reviewed and proven eleven times), followed by post-correction verification.

**Tech Stack:** TypeScript, `tsx`, `@libsql/client` (Turso) for the correction script. WebFetch/WebSearch for source-text verification. No test framework (none exists in this project).

## Global Constraints

- **Source of truth:** ESV, fetched live via WebFetch/WebSearch for every claim checked — not recalled from memory.
- **In scope:** all 5 new people (Jehoahaz, Jehoiakim, Jehoiachin, Zedekiah, Shealtiel), all 13 relationships, and all 15 scripture refs in `scripts/seed-late-kings.ts`.
- **Out of scope:** re-auditing Josiah/Nebuchadnezzar/Zerubbabel/Jeremiah's own person records (owned by their originating books) — only the relationships this file adds referencing them are in scope; any book other than this file's scope.
- **Findings categories:** exactly one of `Incorrect`, `Missing`, `Unsupported`, `Structural gap` per finding — never a compound value.
- **Priority:** (a) each king's name-change correctly attributed to the correct foreign king (Eliakim→Jehoiakim by Pharaoh Neco; Mattaniah→Zedekiah by Nebuchadnezzar), (b) reign lengths and dates (Jehoahaz's 3 months, Jehoiachin's 3 months, Zedekiah's ~11 years, Jehoiachin's 37 years in prison before release), (c) the sibling relationships among Josiah's sons being textually supported, (d) the Shealtiel/Zerubbabel Matthew-genealogy bridge, given the well-documented tension between Matthew 1:12 (Shealtiel as Jeconiah's son, Zerubbabel as Shealtiel's son) and 1 Chronicles 3:17-19 (which lists Pedaiah, not Shealtiel, as Zerubbabel's father, with Shealtiel as an uncle) — check whether the DB states the Matthew genealogy as flatly settled or acknowledges the tension, (e) all 15 refs' chapter:verse ranges and note text across five different books (2 Kings, 2 Chronicles, Jeremiah, Matthew, Ezra, 1 Chronicles).
- **Coverage counts:** the required top-line summary (people/relationships/refs) must be independently grep-verifiable — every prior book's audit initially miscounted at least one of these. Actually grep-count, don't estimate. Expected: 5 people, 13 relationships, 15 refs — verify these yourself rather than trusting this summary.
- **Nothing gets written to the live database until Task 2** — Task 1 is pure research/documentation, producing markdown only.
- **If live-data verification hits a sandboxed-network limitation** (observed intermittently in several prior books' audits, including connection failures during 2 Kings), prefer direct `@libsql/client` verification scripts over the dev-server API route from the start — this is an acceptable primary approach for this book, not just a fallback.

---

### Task 1: Audit Late Kings of Judah's People, Relationships & Refs

**Files:**
- Read: `scripts/seed-late-kings.ts` (full file, 204 lines)
- Create: `docs/superpowers/specs/2026-07-21-late-kings-data-audit-findings.md`

**Interfaces:**
- Produces: a findings markdown file Task 2 reads to write the correction script.

- [ ] **Step 1: Enumerate**

Read `scripts/seed-late-kings.ts` in full. List all 5 people (`key`, `name`, `alsoKnownAs`, `gender`, `description`, `tags`), all 13 relationships, and all 15 scripture refs.

- [ ] **Step 2: Fetch source text**

Use WebFetch/WebSearch to retrieve the ESV text of 2 Kings 23:31-34 (Jehoahaz), 23:34-24:7 (Jehoiakim), 24:8-17 and 25:27-30 (Jehoiachin), 24:17-25:7 (Zedekiah), 2 Chronicles 36 (parallel account), Jeremiah 22:10-12 (Jehoahaz), Jeremiah 36 (Jehoiakim burning the scroll), Jeremiah 52 (Zedekiah's capture), Matthew 1:11-12 (Jeconiah/Shealtiel), Ezra 3:2 and 1 Chronicles 3:17-19 (Shealtiel/Zerubbabel/Pedaiah). Do not answer from memory.

- [ ] **Step 3: Cross-reference**

For each of the 5 people: verify name, alternate names (each king has multiple — check all are textually attested), gender, and that the description doesn't contradict the text — with special attention to each name-change's correct foreign-king attribution, reign lengths/dates, and the Shealtiel/Zerubbabel/Pedaiah genealogical tension (does the DB state Matthew's Shealtiel→Zerubbabel link as uncontested fact, when 1 Chronicles 3:17-19 gives a different father for Zerubbabel? If so, this may warrant a finding similar to how the Ruth/Judges audits handled other genuine textual/genealogical cruxes — soften rather than assert certainty, or note the tension). For each relationship: verify it's textually supported and correctly typed, including the four referencing pre-existing people (Josiah, Nebuchadnezzar, Zerubbabel, Jeremiah). For each of the 15 refs: verify the chapter:verse range is correct and the note text accurately summarizes what's in that passage, across all five cited books.

- [ ] **Step 4: Write findings**

Create `docs/superpowers/specs/2026-07-21-late-kings-data-audit-findings.md`, one entry per finding:

```markdown
## Finding N: <short description>
- **Category:** Incorrect | Missing | Unsupported | Structural gap
- **Verse(s):** <citation>
- **Current DB state:** <what's there now — key, field, or relationship>
- **Proposed correction:** <exact new value or exact new/removed relationship>
- **Severity:** Critical | Important | Minor
```

Only write findings for actual discrepancies. At the top of the file, add: `Reviewed: <N> people, <M> relationships, <K> refs. <F> findings.` — grep-count `N`/`M`/`K` yourself against the actual file before writing this line. If you notice something worth flagging but are unsure it clears the "actual discrepancy" bar, include it anyway with your reasoning — prior books' audits initially declined real findings this way, and it's better to include a borderline observation for the controller to judge than to silently omit it. A low- or zero-finding outcome is plausible and acceptable — don't invent findings to fill space.

- [ ] **Step 5: Triple-check**

Re-verify every finding against the actual fetched text once more. Then do a second full read-through of the findings list checking for contradictions.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-07-21-late-kings-data-audit-findings.md
git commit -m "$(cat <<'EOF'
docs: add Late Kings of Judah data audit findings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Write the Correction Script and Run a Dry-Run Only

**Files:**
- Read: `docs/superpowers/specs/2026-07-21-late-kings-data-audit-findings.md` (Task 1's output)
- Read: `scripts/fix-2kings-audit.ts` (for the exact DB access + dry-run pattern to reuse verbatim)
- Create: `scripts/fix-late-kings-audit.ts`

**Interfaces:** None — standalone script.

This task stops after the dry-run. Do NOT execute the script for real or commit — that happens only after controller review, as a separate follow-up.

- [ ] **Step 1: Write the script**

Create `scripts/fix-late-kings-audit.ts` following `scripts/fix-2kings-audit.ts`'s exact pattern (same imports, same `.env.local` loading, same `DRY_RUN` gate, same fail-loud `resolveExisting`/`resolveRelationship` helpers). For each finding in the findings document, implement it as `INSERT OR IGNORE` (new person/relationship/ref), `UPDATE` (wrong field), or `DELETE` (unsupported relationship/ref), with a comment directly above each statement citing which finding it implements. If the findings document has zero findings, the script only needs to report "no corrections needed" and exit cleanly — do not invent statements to implement.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Run the dry-run and report the output**

Run: `npx tsx scripts/fix-late-kings-audit.ts --dry-run`
Report the full output. If any resolver call throws, STOP and report BLOCKED with the exact error rather than guessing at a fix.

**Do not proceed past this step without controller review.** Report the full dry-run output and stop.

---

### Task 3: Live Execution and Post-Correction Verification

**Files:** `scripts/fix-late-kings-audit.ts` (run, not modified further unless Task 2's dry-run needed a fix first)

**Interfaces:**
- Consumes: the reviewed, approved script from Task 2.

This task only starts once Task 2's dry-run has been reviewed and approved. If Task 1 found zero findings, this task still runs the script (to confirm it reports "no corrections needed" cleanly) and still performs Step 3 below.

- [ ] **Step 1: Run the script for real**

Run: `npx tsx scripts/fix-late-kings-audit.ts`
Expected: matches the dry-run's statement count, no errors.

- [ ] **Step 2: Verify live via a direct DB query script**

Write a small script matching `scripts/fix-late-kings-audit.ts`'s `.env.local`/`@libsql/client` connection pattern, query the affected rows directly, and confirm the specific corrections from the findings document are actually present. Delete the scratch script when done. (The dev-server API route may also be used if preferred, but direct DB query is the primary approach for this book per the Global Constraints.)

- [ ] **Step 3: Run the curated-family check**

Read `lib/families.ts`'s member lists and check whether any of this book's 5 people (Jehoahaz, Jehoiakim, Jehoiachin, Zedekiah, Shealtiel) appear in any curated family's roster. If none do, note this and skip the `buildForest` chain-completeness check. If any do, read `components/FamilyTree.tsx`'s `resolveFamilyMembers`/`buildForest` functions and run that check for the affected family.

- [ ] **Step 4: Commit**

```bash
git add scripts/fix-late-kings-audit.ts
git commit -m "$(cat <<'EOF'
fix: apply Late Kings of Judah data audit corrections to live database

Implements every finding from
docs/superpowers/specs/2026-07-21-late-kings-data-audit-findings.md
against the live Turso database. Controller reviewed the dry-run
output and script source before live execution, then independently
verified the result against a fresh live data pull, including a
curated-family roster check.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Self-Review Notes

- **Spec coverage:** enumeration + cross-referencing + findings (Task 1), correction script with dry-run safety (Task 2), live execution + verification (Task 3) — every section of the design spec has a task, including the Shealtiel/Zerubbabel genealogical-tension check called out explicitly in Task 1 Step 3.
- **Placeholder scan:** no TBDs; Task 1 points to the full file (204 lines) rather than inlining content, matching the already-accepted approach from prior books' plans. Task 2/3 explicitly handle the possible zero-findings case, and Task 3 Step 2 makes direct DB verification the default given recent intermittent network issues.
- **Type consistency:** N/A — this plan produces documentation and a standalone script, not a shared codebase interface.
