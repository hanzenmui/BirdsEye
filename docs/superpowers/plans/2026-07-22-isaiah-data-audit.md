# Isaiah Data Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every person, relationship, and scripture ref in `scripts/seed-isaiah.ts` against the actual biblical text (ESV, fetched live), producing a findings document, then correct the live database to match — eighteenth of the planned per-book audit series.

**Architecture:** Single audit pass (7 new people), followed by a dry-run-safe correction script (same pattern as `scripts/fix-wisdom-audit.ts`, already reviewed and proven seventeen times), followed by post-correction verification.

**Tech Stack:** TypeScript, `tsx`, `@libsql/client` (Turso) for the correction script. WebFetch/WebSearch for source-text verification. No test framework (none exists in this project).

## Global Constraints

- **Source of truth:** ESV, fetched live via WebFetch/WebSearch for every claim checked — not recalled from memory.
- **In scope:** all 7 new people (Amoz, Uzziah, Jotham of Judah, Ahaz of Judah, Wife of Isaiah, Shear-Jashub, Maher-shalal-hash-baz) — including Uzziah, Jotham, and Ahaz's own `name`/`alsoKnownAs`/`description`/`tags`/`gender` fields, since this file is where their person records actually originate (grep-confirmed: no other `scripts/seed-*.ts` file creates person records with these names via `safeInsertPerson`) — all 9 relationships, and all 9 scripture refs in `scripts/seed-isaiah.ts`.
- **Out of scope:** re-auditing Isaiah's or Hezekiah's own person records (loaded via `loadExisting`, originating elsewhere) — only the new relationships/refs this file adds referencing them are in scope; any book other than this file's scope.
- **Findings categories:** exactly one of `Incorrect`, `Missing`, `Unsupported`, `Structural gap` per finding — never a compound value.
- **Priority:** (a) Uzziah/Jotham/Ahaz's regnal date ranges (~792–740, ~740–732, ~732–716 BC) — verify against standard scholarly chronologies, which are genuinely disputed among chronologists, and check whether the DB's specific figures match a recognized source or need a hedge, (b) the Ahaz→Hezekiah `parent_of` link via `insertRelLocalToName` — confirm it resolves correctly and is textually accurate, (c) Shear-Jashub's and Maher-shalal-hash-baz's name-meaning glosses against the text's own naming explanations, (d) "the prophetess" (Isaiah 8:3) as Isaiah's wife's title, (e) the `isaiah other ahaz_judah` relationship type choice's consistency with this codebase's established `"other"` convention, (f) all 9 refs' chapter:verse ranges and note text, including whether the four single-verse 1:1 refs (one per king/Amoz) are an accurate way to represent the shared superscription citation.
- **Coverage counts:** the required top-line summary (people/relationships/refs) must be independently grep-verifiable — every prior book's audit initially miscounted at least one of these. Actually grep-count, don't estimate. Expected: 7 people, 9 relationships, 9 refs — verify these yourself rather than trusting this summary.
- **Nothing gets written to the live database until Task 2** — Task 1 is pure research/documentation, producing markdown only.
- **Prefer direct `@libsql/client` verification scripts over the dev-server API route** for Task 3, given intermittent network issues observed in several prior books' audits.

---

### Task 1: Audit Isaiah's People, Relationships & Refs

**Files:**
- Read: `scripts/seed-isaiah.ts` (full file, 206 lines)
- Create: `docs/superpowers/specs/2026-07-22-isaiah-data-audit-findings.md`

**Interfaces:**
- Produces: a findings markdown file Task 2 reads to write the correction script.

- [ ] **Step 1: Enumerate**

Read `scripts/seed-isaiah.ts` in full. List all 7 people (`key`, `name`, `alsoKnownAs`, `gender`, `description`, `tags`), all 9 relationships (including the `insertRelLocalToName` call to Hezekiah), and all 9 scripture refs.

- [ ] **Step 2: Fetch source text**

Use WebFetch/WebSearch to retrieve the ESV text of Isaiah 1:1 (the superscription naming Amoz and all four kings), Isaiah 6 (the call vision, "in the year that King Uzziah died"), Isaiah 7 (the Ahaz/Immanuel encounter, Shear-Jashub present at the conduit), Isaiah 8:1-4 (Maher-shalal-hash-baz's birth and naming), Isaiah 8:3 ("the prophetess"), Isaiah 36-39 (Hezekiah/Sennacherib, Isaiah's counsel), 2 Kings 15-20 (the parallel royal history). Also research standard scholarly chronologies (e.g. Thiele or other recognized regnal-date reconstructions) for Uzziah/Jotham/Ahaz's reigns. Do not answer from memory.

- [ ] **Step 3: Cross-reference**

For each of the 7 people: verify name, alternate names, gender, and that the description doesn't contradict the text — with special attention to Uzziah/Jotham/Ahaz's regnal date ranges against recognized chronologies, Shear-Jashub's and Maher-shalal-hash-baz's name-meaning glosses, and "the prophetess" identification. For each of the 9 relationships: verify it's textually supported and correctly typed — specifically confirm the `insertRelLocalToName("ahaz_judah", "parent_of", "Hezekiah", ...)` call resolves against the live DB (this pattern differs from a normal `insertRel` call, since it looks up by name at runtime rather than by a pre-registered key — verify this actually succeeds rather than silently warning and skipping), and check the `isaiah other ahaz_judah` relationship type against the codebase's established `"other"` convention (already researched in the Wisdom books audit — grep `scripts/seed-*.ts` yourself to confirm current state). For each of the 9 refs: verify the chapter:verse range is correct and the note text accurately summarizes what's in that passage, including whether the four separate single-verse 1:1 refs (one each for Amoz, Uzziah, Jotham, Ahaz) accurately represent the shared superscription.

- [ ] **Step 4: Write findings**

Create `docs/superpowers/specs/2026-07-22-isaiah-data-audit-findings.md`, one entry per finding:

```markdown
## Finding N: <short description>
- **Category:** Incorrect | Missing | Unsupported | Structural gap
- **Verse(s):** <citation>
- **Current DB state:** <what's there now — key, field, or relationship>
- **Proposed correction:** <exact new value or exact new/removed relationship>
- **Severity:** Critical | Important | Minor
```

Only write findings for actual discrepancies. Reserve "Critical" strictly for structural gaps (missing people/relationships with cascading downstream effects) — every book's audit in this series except the very first has topped out at "Important" for single-field corrections. At the top of the file, add: `Reviewed: <N> people, <M> relationships, <K> refs. <F> findings.` — grep-count `N`/`M`/`K` yourself against the actual file before writing this line. If you notice something worth flagging but are unsure it clears the "actual discrepancy" bar, include it anyway with your reasoning — prior books' audits initially declined real findings this way, and it's better to include a borderline observation for the controller to judge than to silently omit it. If a finding is genuinely borderline with no single clearly-correct fix, it's acceptable to present it non-prescriptively (as the Wisdom books audit's Finding 4 did) — the controller and reviewer will resolve it together in the review step.

- [ ] **Step 5: Triple-check**

Re-verify every finding against the actual fetched text once more. Then do a second full read-through of the findings list checking for contradictions.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-07-22-isaiah-data-audit-findings.md
git commit -m "$(cat <<'EOF'
docs: add Isaiah data audit findings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Write the Correction Script and Run a Dry-Run Only

**Files:**
- Read: `docs/superpowers/specs/2026-07-22-isaiah-data-audit-findings.md` (Task 1's output)
- Read: `scripts/fix-wisdom-audit.ts` (for the exact DB access + dry-run pattern to reuse verbatim, including `resolveScriptureRef` and new-INSERT patterns if needed)
- Create: `scripts/fix-isaiah-audit.ts`

**Interfaces:** None — standalone script.

This task stops after the dry-run. Do NOT execute the script for real or commit — that happens only after controller review, as a separate follow-up.

- [ ] **Step 1: Write the script**

Create `scripts/fix-isaiah-audit.ts` following `scripts/fix-wisdom-audit.ts`'s exact pattern (same imports, same `.env.local` loading, same `DRY_RUN` gate, same fail-loud `resolveExisting`/`resolveRelationship` helpers, plus `resolveScriptureRef` or new-ref `INSERT OR IGNORE` statements if a finding requires them). For each finding in the findings document, implement it as `INSERT OR IGNORE` (new person/relationship/ref), `UPDATE` (wrong field), or `DELETE` (unsupported relationship/ref), with a comment directly above each statement citing which finding it implements. If a finding is about a relationship's own characterization (not just a description-text detail), soften both the person description and the relationship's notes field via `resolveRelationship`, per this series' established precedent. If the findings document has zero findings, the script only needs to report "no corrections needed" and exit cleanly — do not invent statements to implement. **Reminder from the Wisdom books audit:** `scripture_refs` has no unique constraint, so any new-ref `INSERT` statements are not idempotent — flag this clearly for Task 3 if this book's findings require any.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Run the dry-run and report the output**

Run: `npx tsx scripts/fix-isaiah-audit.ts --dry-run`
Report the full output. If any resolver call throws, STOP and report BLOCKED with the exact error rather than guessing at a fix.

**Do not proceed past this step without controller review.** Report the full dry-run output and stop.

---

### Task 3: Live Execution and Post-Correction Verification

**Files:** `scripts/fix-isaiah-audit.ts` (run, not modified further unless Task 2's dry-run needed a fix first)

**Interfaces:**
- Consumes: the reviewed, approved script from Task 2.

This task only starts once Task 2's dry-run has been reviewed and approved. If Task 1 found zero findings, this task still runs the script (to confirm it reports "no corrections needed" cleanly) and still performs Step 3 below.

- [ ] **Step 1: Run the script for real**

Run: `npx tsx scripts/fix-isaiah-audit.ts`
Expected: matches the dry-run's statement count, no errors. If any new-ref `INSERT` statements are present, run this exactly once and verify no duplicate rows afterward (per the Wisdom books audit's precedent — `scripture_refs` has no unique constraint).

- [ ] **Step 2: Verify live via a direct DB query script**

Write a small script matching `scripts/fix-isaiah-audit.ts`'s `.env.local`/`@libsql/client` connection pattern, query the affected rows directly, and confirm the specific corrections from the findings document are actually present. Delete the scratch script when done.

- [ ] **Step 3: Run the curated-family check**

Read `lib/families.ts`'s member lists and check whether any of this book's 7 new people, or Isaiah/Hezekiah, appear in any curated family's roster. If any do, read `components/FamilyTree.tsx`'s `resolveFamilyMembers`/`buildForest` functions and run that chain-completeness check for the affected family — pay particular attention to whether this file's `ahaz_judah parent_of Hezekiah` relationship (added via `insertRelLocalToName`) affects any curated family's `parent_of` chain, since `buildForest` follows exactly that edge type per the Wisdom books audit's finding. If none do, note this and skip the check.

- [ ] **Step 4: Commit**

```bash
git add scripts/fix-isaiah-audit.ts
git commit -m "$(cat <<'EOF'
fix: apply Isaiah data audit corrections to live database

Implements every finding from
docs/superpowers/specs/2026-07-22-isaiah-data-audit-findings.md
against the live Turso database. Controller reviewed the dry-run
output and script source before live execution, then independently
verified the result against a fresh live data pull, including a
curated-family roster check.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Self-Review Notes

- **Spec coverage:** enumeration + cross-referencing + findings (Task 1), correction script with dry-run safety (Task 2), live execution + verification (Task 3) — every section of the design spec has a task, including the regnal-date and `insertRelLocalToName` resolution checks called out explicitly in Task 1 Step 3, and the scope wrinkle (Uzziah/Jotham/Ahaz's own person records originating in this file) is explicitly called out in the Global Constraints.
- **Placeholder scan:** no TBDs; Task 1 points to the full file (206 lines) rather than inlining content, matching the already-accepted approach from prior books' plans. Task 2/3 explicitly handle the possible zero-findings case and carry forward the Wisdom books audit's non-idempotent-INSERT caution.
- **Type consistency:** N/A — this plan produces documentation and a standalone script, not a shared codebase interface.
