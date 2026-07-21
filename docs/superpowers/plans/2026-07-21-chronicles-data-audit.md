# Chronicles Data Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every person, relationship, and scripture ref in `scripts/seed-chronicles.ts` against the actual biblical text (ESV, fetched live), producing a findings document, then correct the live database to match — thirteenth of the planned per-book audit series.

**Architecture:** Single audit pass (13 new people), followed by a dry-run-safe correction script (same pattern as `scripts/fix-late-kings-audit.ts`, already reviewed and proven twelve times), followed by post-correction verification.

**Tech Stack:** TypeScript, `tsx`, `@libsql/client` (Turso) for the correction script. WebFetch/WebSearch for source-text verification. No test framework (none exists in this project).

## Global Constraints

- **Source of truth:** ESV, fetched live via WebFetch/WebSearch for every claim checked — not recalled from memory.
- **In scope:** all 13 new people (Abijam, Asa, Jehoshaphat, Jehoram of Judah, Amaziah, Asaph, Heman, Jeduthun, Benaiah, Jabez, Azariah son of Oded, Shemaiah, Hanani), all 20 relationships, and all 32 scripture refs in `scripts/seed-chronicles.ts`.
- **Out of scope:** re-auditing David/Solomon/Rehoboam/Joash/Ahaziah-of-Judah/Hezekiah/Uzziah/Jotham/Ahaz/Athaliah/Josiah/Korah's own person records (owned by their originating books) — only the relationships this file adds referencing them are in scope; any book other than this file's scope.
- **Findings categories:** exactly one of `Incorrect`, `Missing`, `Unsupported`, `Structural gap` per finding — never a compound value.
- **Priority:** (a) the Judah king succession chain's dates and parent-child links, (b) Heman's "grandson of Samuel" claim — verify 1 Chronicles 6:33-38's genealogy directly supports this or whether generations are elided, (c) the Jeduthun/Ethan-the-Ezrahite identification — a traditional harmonization, not an explicit textual equation; check the DB's hedge is appropriately cautious, (d) Benaiah's exploits' exact details, (e) Heman's exact sons/daughters count (1 Chr 25:5), (f) all 32 refs' chapter:verse ranges and note text, including Psalm superscription citations.
- **Coverage counts:** the required top-line summary (people/relationships/refs) must be independently grep-verifiable — every prior book's audit initially miscounted at least one of these. Actually grep-count, don't estimate. Expected: 13 people, 20 relationships, 32 refs — verify these yourself rather than trusting this summary.
- **Nothing gets written to the live database until Task 2** — Task 1 is pure research/documentation, producing markdown only.
- **Prefer direct `@libsql/client` verification scripts over the dev-server API route** for Task 3, given intermittent network issues observed in several prior books' audits.

---

### Task 1: Audit Chronicles's People, Relationships & Refs

**Files:**
- Read: `scripts/seed-chronicles.ts` (full file, 330 lines)
- Create: `docs/superpowers/specs/2026-07-21-chronicles-data-audit-findings.md`

**Interfaces:**
- Produces: a findings markdown file Task 2 reads to write the correction script.

- [ ] **Step 1: Enumerate**

Read `scripts/seed-chronicles.ts` in full. List all 13 people (`key`, `name`, `alsoKnownAs`, `gender`, `description`, `tags`), all 20 relationships, and all 32 scripture refs.

- [ ] **Step 2: Fetch source text**

Use WebFetch/WebSearch to retrieve the ESV text of 1 Kings 15 (Abijam, Asa), 2 Chronicles 13-16 (Abijah's victory, Asa's reforms and the Ethiopian battle), 1 Kings 22 and 2 Chronicles 17-20 (Jehoshaphat), 2 Kings 8 and 2 Chronicles 21 (Jehoram of Judah), 2 Kings 14 and 2 Chronicles 25 (Amaziah), 1 Chronicles 6, 15-16, 25 (the three chief musicians), 1 Chronicles 11 and 27 and 1 Kings 2:35 (Benaiah), 1 Chronicles 4:9-10 (Jabez), 2 Chronicles 15 (Azariah son of Oded), 1 Kings 12 and 2 Chronicles 12 (Shemaiah), 2 Chronicles 16:7-10 (Hanani), and the Psalm superscriptions cited (Psalms 39, 50, 62, 73, 77, 88, 89 — at minimum the opening verse/superscription of each). Do not answer from memory.

- [ ] **Step 3: Cross-reference**

For each of the 13 people: verify name, alternate names, gender, and that the description doesn't contradict the text — with special attention to Heman's "grandson of Samuel" claim (does 1 Chr 6:33-38 directly name "Joel son of Samuel" as Heman's father, or does the genealogy have more generations between them that the file's relationship note elides with "..." in a way that changes the "grandson" framing?), the Jeduthun/Ethan-the-Ezrahite identification (check 1 Chr 15:19's naming of the three cymbal-players and whether Jeduthun/Ethan are ever explicitly equated in the text, or only inferred from context — the file's "Likely the same person" hedge should be checked for whether it's the right level of caution), Benaiah's exploits (the lion in a pit on a snowy day, the Moabite champions — check if "two" is the right count and what term the ESV uses, the Egyptian's size/spear), and Heman's sons/daughters count (1 Chr 25:5). For each relationship: verify it's textually supported and correctly typed, including the relationships to the 11 pre-existing cross-seed people (especially the Judah king succession chain: Rehoboam→Abijam→Asa→Jehoshaphat→Jehoram→Ahaziah, and Joash→Amaziah→Uzziah, plus Jehoram's marriage to Athaliah). For each of the 32 refs: verify the chapter:verse range is correct and the note text accurately summarizes what's in that passage — for the Psalm refs specifically, confirm the cited psalm's superscription (or absence of one) actually supports the claimed authorship/dedication.

- [ ] **Step 4: Write findings**

Create `docs/superpowers/specs/2026-07-21-chronicles-data-audit-findings.md`, one entry per finding:

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
git add docs/superpowers/specs/2026-07-21-chronicles-data-audit-findings.md
git commit -m "$(cat <<'EOF'
docs: add Chronicles data audit findings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Write the Correction Script and Run a Dry-Run Only

**Files:**
- Read: `docs/superpowers/specs/2026-07-21-chronicles-data-audit-findings.md` (Task 1's output)
- Read: `scripts/fix-late-kings-audit.ts` (for the exact DB access + dry-run pattern to reuse verbatim)
- Create: `scripts/fix-chronicles-audit.ts`

**Interfaces:** None — standalone script.

This task stops after the dry-run. Do NOT execute the script for real or commit — that happens only after controller review, as a separate follow-up.

- [ ] **Step 1: Write the script**

Create `scripts/fix-chronicles-audit.ts` following `scripts/fix-late-kings-audit.ts`'s exact pattern (same imports, same `.env.local` loading, same `DRY_RUN` gate, same fail-loud `resolveExisting`/`resolveRelationship` helpers). For each finding in the findings document, implement it as `INSERT OR IGNORE` (new person/relationship/ref), `UPDATE` (wrong field), or `DELETE` (unsupported relationship/ref), with a comment directly above each statement citing which finding it implements. If a finding is about a relationship's own characterization (not just a description-text detail), soften both the person description and the relationship's notes field via `resolveRelationship`, per this series' established precedent (see the Late Kings of Judah audit). If the findings document has zero findings, the script only needs to report "no corrections needed" and exit cleanly — do not invent statements to implement.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Run the dry-run and report the output**

Run: `npx tsx scripts/fix-chronicles-audit.ts --dry-run`
Report the full output. If any resolver call throws, STOP and report BLOCKED with the exact error rather than guessing at a fix.

**Do not proceed past this step without controller review.** Report the full dry-run output and stop.

---

### Task 3: Live Execution and Post-Correction Verification

**Files:** `scripts/fix-chronicles-audit.ts` (run, not modified further unless Task 2's dry-run needed a fix first)

**Interfaces:**
- Consumes: the reviewed, approved script from Task 2.

This task only starts once Task 2's dry-run has been reviewed and approved. If Task 1 found zero findings, this task still runs the script (to confirm it reports "no corrections needed" cleanly) and still performs Step 3 below.

- [ ] **Step 1: Run the script for real**

Run: `npx tsx scripts/fix-chronicles-audit.ts`
Expected: matches the dry-run's statement count, no errors.

- [ ] **Step 2: Verify live via a direct DB query script**

Write a small script matching `scripts/fix-chronicles-audit.ts`'s `.env.local`/`@libsql/client` connection pattern, query the affected rows directly, and confirm the specific corrections from the findings document are actually present. Delete the scratch script when done.

- [ ] **Step 3: Run the curated-family check**

Read `lib/families.ts`'s member lists and check whether any of this book's 13 people appear in any curated family's roster — `david_family` is worth checking specifically given this file's heavy involvement with David's court (Asaph, Heman, Jeduthun, Benaiah all served under David). If any do, read `components/FamilyTree.tsx`'s `resolveFamilyMembers`/`buildForest` functions and run that chain-completeness check for the affected family. If none do, note this and skip the check.

- [ ] **Step 4: Commit**

```bash
git add scripts/fix-chronicles-audit.ts
git commit -m "$(cat <<'EOF'
fix: apply Chronicles data audit corrections to live database

Implements every finding from
docs/superpowers/specs/2026-07-21-chronicles-data-audit-findings.md
against the live Turso database. Controller reviewed the dry-run
output and script source before live execution, then independently
verified the result against a fresh live data pull, including a
curated-family roster check.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Self-Review Notes

- **Spec coverage:** enumeration + cross-referencing + findings (Task 1), correction script with dry-run safety (Task 2), live execution + verification (Task 3) — every section of the design spec has a task, including the Heman/Jeduthun genealogical-precision checks called out explicitly in Task 1 Step 3.
- **Placeholder scan:** no TBDs; Task 1 points to the full file (330 lines) rather than inlining content, matching the already-accepted approach from prior books' plans. Task 2/3 explicitly handle the possible zero-findings case, and Task 2 explicitly carries forward the two-field-softening precedent from the Late Kings audit for relationship-characterization cruxes.
- **Type consistency:** N/A — this plan produces documentation and a standalone script, not a shared codebase interface.
