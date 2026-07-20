# Judges Data Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every person, relationship, and scripture ref in `scripts/seed-judges.ts` against the actual Judges text (ESV, fetched live), producing a findings document, then correct the live database to match — sixth of the planned per-book audit series.

**Architecture:** Single audit pass (22 new people, comparable to Exodus's 25 and smaller than Numbers's 28), followed by a dry-run-safe correction script (same pattern as `scripts/fix-joshua-audit.ts`, already reviewed and proven five times), followed by post-correction verification.

**Tech Stack:** TypeScript, `tsx`, `@libsql/client` (Turso) for the correction script. WebFetch/WebSearch for source-text verification. No test framework (none exists in this project).

## Global Constraints

- **Source of truth:** ESV, fetched live via WebFetch/WebSearch for every claim checked — not recalled from memory.
- **In scope:** all 22 new people, all 23 relationships, and all 23 scripture refs in `scripts/seed-judges.ts`.
- **Out of scope:** re-auditing Caleb/Achsah/Hobab/Manasseh/Gad/Dan's own person records (owned by their originating books) — only the relationships this file adds referencing them are in scope; seeding new content to resolve the Numbers-vs-Judges "Gilead" naming situation unless a live collision is actually found; any book other than Judges.
- **Findings categories:** exactly one of `Incorrect`, `Missing`, `Unsupported`, `Structural gap` per finding — never a compound value.
- **Priority:** (a) each judge's tenure length, oppressor, and deliverance narrative details (years of oppression/peace, casualty counts — this book has more named numeric details than any prior book, a common error surface), (b) the Gilead naming situation: confirm `scripts/seed-judges.ts`'s "Gilead" (Jephthah's father, prose-only per Judg 11:1) does not collide with the Numbers-audit-added `gilead` person record (son of Machir, Num 26:29) — check both the live DB state and whether this file's own relationship (`Gad ancestor_of jephthah`) or description creates ambiguity, (c) Heber's descent from Hobab is textually supported (Judg 4:11), (d) Gideon's family relationships (Joash→Gideon→Abimelech/Jotham) and the Zebah/Zalmunna capture-and-execution details match Judg 8 precisely, (e) all 23 refs' chapter:verse ranges and note text are accurate.
- **Coverage counts:** the required top-line summary (people/relationships/refs) must be independently grep-verifiable — every prior book's audit initially miscounted at least one of these. Actually grep-count, don't estimate.
- **Nothing gets written to the live database until Task 2** — Task 1 is pure research/documentation, producing markdown only.

---

### Task 1: Audit Judges's People, Relationships & Refs

**Files:**
- Read: `scripts/seed-judges.ts` (full file, 301 lines)
- Read: `docs/superpowers/specs/2026-07-16-numbers-data-audit-findings.md`'s Finding 7 section (for the exact `gilead` person record's key, description, and disambiguation reasoning already established)
- Create: `docs/superpowers/specs/2026-07-20-judges-data-audit-findings.md`

**Interfaces:**
- Produces: a findings markdown file Task 2 reads to write the correction script.

- [ ] **Step 1: Enumerate**

Read `scripts/seed-judges.ts` in full. List all 22 people (`key`, `name`, `alsoKnownAs`, `gender`, `description`, `tags`), all 23 relationships, and all 23 scripture refs.

- [ ] **Step 2: Fetch source text**

Use WebFetch/WebSearch to retrieve the ESV text of Judges 3 (Othniel, Ehud, Shamgar), 4-5 (Deborah, Barak, Sisera, Jabin, Jael, Heber, the Song of Deborah), 6-9 (Gideon, Joash, Zebah, Zalmunna, Abimelech, Jotham), 11-12 (Jephthah, his daughter, Shibboleth), and 13-16 (Manoah, Samson, Delilah). Also fetch Judges 11:1 specifically for the Gilead naming question. Do not answer from memory.

- [ ] **Step 3: Cross-reference**

For each of the 22 people: verify name, alternate names, gender, and that the description doesn't contradict the text — with special attention to numeric details (years of oppression/peace, casualty counts, weapon/tribute details) since this book has more of these than any prior book. For the Gilead question: read the Numbers findings doc's Finding 7 for the exact `gilead` person record already in the live DB (son of Machir, grandson of Manasseh, Num 26:29), then check `scripts/seed-judges.ts`'s Jephthah description and the `insertRelNameToLocal("Gad", "ancestor_of", "jephthah", ...)` relationship — confirm "Gilead" here is prose-only (not a `key:`-based person record in this file) and that Jephthah's tribal-origin relationship goes through Gad, not through any `gilead` key, so no live collision is created by this file. If a collision risk exists, write it up as a Structural gap finding with a specific disambiguation proposal (matching the pattern used for other same-name-different-person cases, e.g. the multiple "Manasseh"s). For each relationship: verify it's textually supported and correctly typed. For each of the 23 refs: verify the chapter:verse range is correct and the note text accurately summarizes what's in that passage.

- [ ] **Step 4: Write findings**

Create `docs/superpowers/specs/2026-07-20-judges-data-audit-findings.md`, one entry per finding:

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

Re-verify every finding against the actual fetched text once more, with particular care on any numeric detail (years, counts, measurements) since these are easy to transpose or misremember. Then do a second full read-through of the findings list checking for contradictions.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-07-20-judges-data-audit-findings.md
git commit -m "$(cat <<'EOF'
docs: add Judges data audit findings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Write the Correction Script and Run a Dry-Run Only

**Files:**
- Read: `docs/superpowers/specs/2026-07-20-judges-data-audit-findings.md` (Task 1's output)
- Read: `scripts/fix-joshua-audit.ts` (for the exact DB access + dry-run pattern to reuse verbatim)
- Create: `scripts/fix-judges-audit.ts`

**Interfaces:** None — standalone script.

This task stops after the dry-run. Do NOT execute the script for real or commit — that happens only after controller review, as a separate follow-up.

- [ ] **Step 1: Write the script**

Create `scripts/fix-judges-audit.ts` following `scripts/fix-joshua-audit.ts`'s exact pattern (same imports, same `.env.local` loading, same `DRY_RUN` gate, same fail-loud `resolveExisting`/`resolveRelationship` helpers). For each finding in the findings document, implement it as `INSERT OR IGNORE` (new person/relationship/ref), `UPDATE` (wrong field), or `DELETE` (unsupported relationship/ref), with a comment directly above each statement citing which finding it implements. If the findings document has zero findings, the script only needs to report "no corrections needed" and exit cleanly — do not invent statements to implement.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Run the dry-run and report the output**

Run: `npx tsx scripts/fix-judges-audit.ts --dry-run`
Report the full output. If any `resolveExisting`/`resolveRelationship` call throws, STOP and report BLOCKED with the exact error rather than guessing at a fix.

**Do not proceed past this step without controller review.** Report the full dry-run output and stop.

---

### Task 3: Live Execution and Post-Correction Verification

**Files:** `scripts/fix-judges-audit.ts` (run, not modified further unless Task 2's dry-run needed a fix first)

**Interfaces:**
- Consumes: the reviewed, approved script from Task 2.

This task only starts once Task 2's dry-run has been reviewed and approved. If Task 1 found zero findings, this task still runs the script (to confirm it reports "no corrections needed" cleanly) and still performs Step 3 below.

- [ ] **Step 1: Run the script for real**

Run: `npx tsx scripts/fix-judges-audit.ts`
Expected: matches the dry-run's statement count, no errors.

- [ ] **Step 2: Verify live via the API**

Start the dev server (pick a free port among 3000-3004), log in with the passcode from `.env.local` (`ADMIN_PASSCODE`), pull `/api/people` and `/api/relationships` with the authenticated session cookie, and confirm the specific corrections from the findings document are actually present. Stop the dev server when done; delete any scratch cookie/JSON files.

- [ ] **Step 3: Check for curated-family overlap**

None of the 9 curated families in `lib/families.ts` are currently Judges-sourced. Confirm this is still true by reading `lib/families.ts`'s member lists and checking whether any of the 22 Judges-audited people appears in any curated family's roster. If none do, note this in the commit message and skip the `buildForest` chain-completeness check. If one does, run the same `buildForest`/`resolveFamilyMembers` chain-completeness check used in prior audits' final verification step for that family.

- [ ] **Step 4: Commit**

```bash
git add scripts/fix-judges-audit.ts
git commit -m "$(cat <<'EOF'
fix: apply Judges data audit corrections to live database

Implements every finding from
docs/superpowers/specs/2026-07-20-judges-data-audit-findings.md
against the live Turso database. Controller reviewed the dry-run
output and script source before live execution, then independently
verified the result against a fresh live data pull.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Self-Review Notes

- **Spec coverage:** enumeration + cross-referencing + findings (Task 1), correction script with dry-run safety (Task 2), live execution + verification (Task 3) — every section of the design spec has a task, including the Gilead naming-collision check called out explicitly in Task 1 Step 3.
- **Placeholder scan:** no TBDs; Task 1 points to the full file (301 lines) rather than inlining content, matching the already-accepted approach from prior books' plans. Task 2/3 explicitly handle the possible zero-findings case.
- **Type consistency:** N/A — this plan produces documentation and a standalone script, not a shared codebase interface.
