# Wisdom Books Data Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every person, relationship, and scripture ref in `scripts/seed-wisdom.ts` against the actual biblical text (ESV, fetched live), producing a findings document, then correct the live database to match — seventeenth of the planned per-book audit series.

**Architecture:** Single audit pass (5 new people, plus 9 refs on the pre-existing Solomon/David records), followed by a dry-run-safe correction script (same pattern as `scripts/fix-job-audit.ts`, already reviewed and proven sixteen times), followed by post-correction verification.

**Tech Stack:** TypeScript, `tsx`, `@libsql/client` (Turso) for the correction script. WebFetch/WebSearch for source-text verification. No test framework (none exists in this project).

## Global Constraints

- **Source of truth:** ESV, fetched live via WebFetch/WebSearch for every claim checked — not recalled from memory.
- **In scope:** all 5 new people (Agur, Lemuel, Mother of Lemuel, Shulamite, Daughters of Jerusalem), all 4 relationships, and all 16 scripture refs in `scripts/seed-wisdom.ts` (including the 5 new Solomon refs and 4 new David refs — the refs are in scope even though those two people's own person records are not).
- **Out of scope:** re-auditing Solomon's or David's own person records (owned by 1 Kings and 1/2 Samuel) — only the relationships/refs this file adds referencing them are in scope; any book other than this file's scope (Proverbs, Ecclesiastes, Song of Solomon).
- **Findings categories:** exactly one of `Incorrect`, `Missing`, `Unsupported`, `Structural gap` per finding — never a compound value.
- **Priority:** (a) Agur's and Lemuel's Solomon-identity hedges — verify appropriately cautious and not invented, (b) the `agur other solomon` / `lemuel other solomon` relationship type — check whether `"other"` is this codebase's actual established convention or whether grep across other seed files reveals a more specific type that should be used, (c) the Shulamite's identification and the `shulamite spouse_of solomon` relationship's textual basis, given Song of Solomon's contested actual-marriage-vs-allegory framing, (d) Solomon's Proverbs collection chapter ranges (1-9, 10-22:16, 25-29) against the text's own internal section markers, (e) the Daughters of Jerusalem refs — the description mentions 4 refrain locations (1:5, 2:7, 3:5, 5:8) but only 3 are ref'd (1:5, 2:7, 5:8) and 8:4 is mentioned in neither — check whether 3:5 and/or 8:4 should be added, (f) the 4 David Psalm refs' superscriptions/characterizations (23, 22, 51 "after Bathsheba", 110 "Messianic").
- **Coverage counts:** the required top-line summary (people/relationships/refs) must be independently grep-verifiable — every prior book's audit initially miscounted at least one of these. Actually grep-count, don't estimate. Expected: 5 people, 4 relationships, 16 refs — verify these yourself rather than trusting this summary.
- **Nothing gets written to the live database until Task 2** — Task 1 is pure research/documentation, producing markdown only.
- **Prefer direct `@libsql/client` verification scripts over the dev-server API route** for Task 3, given intermittent network issues observed in several prior books' audits.

---

### Task 1: Audit Wisdom Books' People, Relationships & Refs

**Files:**
- Read: `scripts/seed-wisdom.ts` (full file, 175 lines)
- Create: `docs/superpowers/specs/2026-07-22-wisdom-data-audit-findings.md`

**Interfaces:**
- Produces: a findings markdown file Task 2 reads to write the correction script.

- [ ] **Step 1: Enumerate**

Read `scripts/seed-wisdom.ts` in full. List all 5 people (`key`, `name`, `alsoKnownAs`, `gender`, `description`, `tags`), all 4 relationships, and all 16 scripture refs (including the 5 on `solomon` and 4 on `david`).

- [ ] **Step 2: Fetch source text**

Use WebFetch/WebSearch to retrieve the ESV text of Proverbs 1:1, 10:1, 25:1 (Solomon's collections and the Hezekiah's-men copying note), Proverbs 30 (Agur's oracle in full), Proverbs 31 (King Lemuel and his mother's teaching in full, including the wife-of-noble-character poem), Ecclesiastes 1:1 (the Preacher, son of David, king in Jerusalem), Song of Solomon 1:1 and throughout (the Shulamite's identification at 6:13, refrains at 2:7, 3:5, 5:8, 8:4, addresses to the Daughters of Jerusalem at 1:5), Psalm 22, 23, 51, 110 (full text and superscriptions). Also research standard scholarly discussion of Agur/Lemuel's identity and Song of Solomon's genre/authorship framing. Do not answer from memory.

- [ ] **Step 3: Cross-reference**

For each of the 5 people: verify name, alternate names, gender, and that the description doesn't contradict the text — with special attention to Agur's and Lemuel's Solomon-identity hedges, the Shulamite's identification and the "possibly from Shunem" gloss on 6:13, and the Daughters of Jerusalem's description ("addressed repeatedly," citing 1:5, 2:7, 3:5, 5:8 in the description text — cross-check this against which verses actually have refs). For each of the 4 relationships: verify it's textually supported and correctly typed — specifically check `"other"` as a relationship type against this codebase's established vocabulary (grep across other seed files for what types exist and how loose-authorship-adjacency relationships are typically typed elsewhere), and check the `shulamite spouse_of solomon` relationship's textual basis against Song of Solomon's own internal claims and the genre debate. For each of the 16 refs: verify the chapter:verse range is correct and the note text accurately summarizes what's in that passage — including whether the Daughters of Jerusalem's 3:5 and 8:4 refrain locations (mentioned or implied but not currently ref'd) should be added as new refs, and whether the 4 David Psalm refs' characterizations (51 "after Bathsheba", 110 "Messianic") are accurate against the Psalms' own superscriptions.

- [ ] **Step 4: Write findings**

Create `docs/superpowers/specs/2026-07-22-wisdom-data-audit-findings.md`, one entry per finding:

```markdown
## Finding N: <short description>
- **Category:** Incorrect | Missing | Unsupported | Structural gap
- **Verse(s):** <citation>
- **Current DB state:** <what's there now — key, field, or relationship>
- **Proposed correction:** <exact new value or exact new/removed relationship>
- **Severity:** Critical | Important | Minor
```

Only write findings for actual discrepancies. Reserve "Critical" strictly for structural gaps (missing people/relationships with cascading downstream effects) — every book's audit in this series except the very first has topped out at "Important" for single-field corrections; a factual error in one description field, even a self-contradictory one, is "Important" not "Critical." At the top of the file, add: `Reviewed: <N> people, <M> relationships, <K> refs. <F> findings.` — grep-count `N`/`M`/`K` yourself against the actual file before writing this line. If you notice something worth flagging but are unsure it clears the "actual discrepancy" bar, include it anyway with your reasoning — prior books' audits initially declined real findings this way, and it's better to include a borderline observation for the controller to judge than to silently omit it.

- [ ] **Step 5: Triple-check**

Re-verify every finding against the actual fetched text once more. Then do a second full read-through of the findings list checking for contradictions.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-07-22-wisdom-data-audit-findings.md
git commit -m "$(cat <<'EOF'
docs: add Wisdom books data audit findings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Write the Correction Script and Run a Dry-Run Only

**Files:**
- Read: `docs/superpowers/specs/2026-07-22-wisdom-data-audit-findings.md` (Task 1's output)
- Read: `scripts/fix-job-audit.ts` (for the exact DB access + dry-run pattern to reuse verbatim) and `scripts/fix-esther-audit.ts` (for the `resolveScriptureRef` helper pattern, needed if a ref-note-only fix or a new-ref insertion is required)
- Create: `scripts/fix-wisdom-audit.ts`

**Interfaces:** None — standalone script.

This task stops after the dry-run. Do NOT execute the script for real or commit — that happens only after controller review, as a separate follow-up.

- [ ] **Step 1: Write the script**

Create `scripts/fix-wisdom-audit.ts` following `scripts/fix-job-audit.ts`'s exact pattern (same imports, same `.env.local` loading, same `DRY_RUN` gate, same fail-loud `resolveExisting`/`resolveRelationship` helpers, plus `resolveScriptureRef` if a finding requires correcting a ref's note text directly, or a new `INSERT OR IGNORE` scripture_refs statement if a finding calls for adding a missing ref). For each finding in the findings document, implement it as `INSERT OR IGNORE` (new person/relationship/ref), `UPDATE` (wrong field), or `DELETE` (unsupported relationship/ref), with a comment directly above each statement citing which finding it implements. If a finding is about a relationship's own characterization (not just a description-text detail), soften both the person description and the relationship's notes field via `resolveRelationship`, per this series' established precedent. If the findings document has zero findings, the script only needs to report "no corrections needed" and exit cleanly — do not invent statements to implement.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Run the dry-run and report the output**

Run: `npx tsx scripts/fix-wisdom-audit.ts --dry-run`
Report the full output. If any resolver call throws, STOP and report BLOCKED with the exact error rather than guessing at a fix.

**Do not proceed past this step without controller review.** Report the full dry-run output and stop.

---

### Task 3: Live Execution and Post-Correction Verification

**Files:** `scripts/fix-wisdom-audit.ts` (run, not modified further unless Task 2's dry-run needed a fix first)

**Interfaces:**
- Consumes: the reviewed, approved script from Task 2.

This task only starts once Task 2's dry-run has been reviewed and approved. If Task 1 found zero findings, this task still runs the script (to confirm it reports "no corrections needed" cleanly) and still performs Step 3 below.

- [ ] **Step 1: Run the script for real**

Run: `npx tsx scripts/fix-wisdom-audit.ts`
Expected: matches the dry-run's statement count, no errors.

- [ ] **Step 2: Verify live via a direct DB query script**

Write a small script matching `scripts/fix-wisdom-audit.ts`'s `.env.local`/`@libsql/client` connection pattern, query the affected rows directly, and confirm the specific corrections from the findings document are actually present. Delete the scratch script when done.

- [ ] **Step 3: Run the curated-family check**

Read `lib/families.ts`'s member lists and check whether any of this book's 5 new people, or Solomon/David, appear in any curated family's roster — worth checking specifically given this file's heavy involvement with Solomon and David's court. If any do, read `components/FamilyTree.tsx`'s `resolveFamilyMembers`/`buildForest` functions and run that chain-completeness check for the affected family. If none do, note this and skip the check.

- [ ] **Step 4: Commit**

```bash
git add scripts/fix-wisdom-audit.ts
git commit -m "$(cat <<'EOF'
fix: apply Wisdom books data audit corrections to live database

Implements every finding from
docs/superpowers/specs/2026-07-22-wisdom-data-audit-findings.md
against the live Turso database. Controller reviewed the dry-run
output and script source before live execution, then independently
verified the result against a fresh live data pull, including a
curated-family roster check.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Self-Review Notes

- **Spec coverage:** enumeration + cross-referencing + findings (Task 1), correction script with dry-run safety (Task 2), live execution + verification (Task 3) — every section of the design spec has a task, including the relationship-type and Daughters-of-Jerusalem-ref-completeness checks called out explicitly in Task 1 Step 3.
- **Placeholder scan:** no TBDs; Task 1 points to the full file (175 lines) rather than inlining content, matching the already-accepted approach from prior books' plans. Task 2/3 explicitly handle the possible zero-findings case, and Task 1's finding-writing step explicitly carries forward the Job audit's severity-tier precedent (Critical reserved for structural gaps only).
- **Type consistency:** N/A — this plan produces documentation and a standalone script, not a shared codebase interface.
