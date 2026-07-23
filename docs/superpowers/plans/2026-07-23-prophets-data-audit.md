# Prophets Data Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every person, relationship, and scripture ref in `scripts/seed-prophets.ts` against the actual biblical text (ESV, fetched live), producing a findings document, then correct the live database to match — nineteenth of the planned per-book audit series.

**Architecture:** Single audit pass (18 new people — the largest book in this series so far by people count), worked through in two natural groups (major prophets, then minor prophets) to manage the volume of distinct claims, followed by a dry-run-safe correction script (same pattern as `scripts/fix-isaiah-audit.ts`, already reviewed and proven eighteen times), followed by post-correction verification.

**Tech Stack:** TypeScript, `tsx`, `@libsql/client` (Turso) for the correction script. WebFetch/WebSearch for source-text verification. No test framework (none exists in this project).

## Global Constraints

- **Source of truth:** ESV, fetched live via WebFetch/WebSearch for every claim checked — not recalled from memory.
- **In scope:** all 18 new people (Jeremiah, Baruch, Ebed-melech, Pashhur son of Immer, Ezekiel, Hosea, Gomer, Joel, Amos, Obadiah, Jonah, Micah, Nahum, Habakkuk, Zephaniah, Haggai, Zechariah the post-exilic prophet, Malachi), all 13 relationships (including the four `insertRelByName` cross-seed links and the three `insertRelByAkaToName` Jeroboam-II-disambiguated links), and all 20 scripture refs (including the single new ref added to the pre-existing `isaiah` person).
- **Out of scope:** re-auditing Isaiah's, Josiah's, Nebuchadnezzar's, Zerubbabel's, Jeshua's, or Jeroboam II's own person records (owned by their originating books) — only the relationships/refs this file adds referencing them are in scope; any book other than this file's scope.
- **Findings categories:** exactly one of `Incorrect`, `Missing`, `Unsupported`, `Structural gap` per finding — never a compound value.
- **Priority:** (a) every specific date claim across all 18 people — verify each against standard chronologies, (b) name-meaning glosses for symbolic names (Gomer's children, Pashhur's renaming) against the text's own translations, (c) the Zephaniah four-generation genealogy claim against Zeph 1:1's actual chain, (d) the Jeroboam-II-disambiguation relationships — confirm they resolve against Jeroboam II specifically, not Jeroboam I, (e) all NT-citation claims (there are at least 8 distinct ones across this file) — verify each is an accurate, correctly-attributed NT citation, (f) all 20 refs' chapter:verse ranges and note text, especially whole-book refs' total-chapter-count accuracy.
- **Coverage counts:** the required top-line summary (people/relationships/refs) must be independently grep-verifiable — every prior book's audit initially miscounted at least one of these. Actually grep-count, don't estimate. Expected: 18 people, 13 relationships, 20 refs — verify these yourself rather than trusting this summary.
- **Nothing gets written to the live database until Task 2** — Task 1 is pure research/documentation, producing markdown only.
- **Prefer direct `@libsql/client` verification scripts over the dev-server API route** for Task 3, given intermittent network issues observed in several prior books' audits.

---

### Task 1: Audit Prophets' People, Relationships & Refs

**Files:**
- Read: `scripts/seed-prophets.ts` (full file, 314 lines)
- Create: `docs/superpowers/specs/2026-07-23-prophets-data-audit-findings.md`

**Interfaces:**
- Produces: a findings markdown file Task 2 reads to write the correction script.

- [ ] **Step 1: Enumerate**

Read `scripts/seed-prophets.ts` in full. List all 18 people (`key`, `name`, `alsoKnownAs`, `gender`, `description`, `tags`), all 13 relationships (noting which helper function creates each: `insertRel`, `insertRelByName`, or `insertRelByAkaToName`), and all 20 scripture refs.

- [ ] **Step 2: Fetch source text**

This book is large — work through it in two groups. **Major prophets:** Jeremiah 1 (call, superscription naming Hilkiah/Anathoth), Jeremiah 36 (Baruch's scroll), Jeremiah 38-39 (Ebed-melech's rescue), Jeremiah 20 (Pashhur), Jeremiah 31:31-34 (New Covenant), Ezekiel 1 (call vision, Buzi, Chebar canal), Ezekiel 4 (the 430 days sign), Ezekiel 24 (his wife's death). **Minor prophets:** Hosea 1-3 (Gomer, the children's symbolic names, 6:6), Joel 2:28-32, Amos 1:1 and 7:10-17 (Amaziah's expulsion), Obadiah 1 (full 21 verses), Jonah 1-4 and 2 Kings 14:25, Micah 5:2 and 6:8, Nahum 1:1, Habakkuk 1-3 (2:4), Zephaniah 1:1 (the genealogy), Haggai 1-2, Zechariah 1:1, 3, 9:9, 11:12-13, 12:10, 14:4, Malachi 3:1 and 4:5-6. Also research standard scholarly chronologies for every dated figure. Do not answer from memory.

- [ ] **Step 3: Cross-reference**

For each of the 18 people: verify name, alternate names, gender, and that the description doesn't contradict the text — with special attention to every date claim (verify against recognized chronologies), name-meaning glosses (Gomer's three children, Pashhur's "Magor-Missabib" renaming), the Zephaniah genealogy claim, and every NT-citation claim (fetch the actual NT verse to confirm the citation is real and accurately characterized, not just the OT source verse). For each of the 13 relationships: verify it's textually supported and correctly typed — specifically verify the three `insertRelByAkaToName("Jeroboam", "Jeroboam II king of Israel", ...)` calls resolve against Jeroboam II and not Jeroboam I (check by reading the helper's lookup logic and confirming the `alsoKnownAs` string used is specific enough), and verify the four `insertRelByName` cross-seed links (Josiah/Jeremiah, Nebuchadnezzar/Jeremiah, Zerubbabel/Haggai, Zerubbabel/Zechariah, Jeshua/Haggai, Jeshua/Zechariah — six total calls via that helper, some listed together) are textually supported. For each of the 20 refs: verify the chapter:verse range is correct (especially each whole-book ref's final chapter:verse against the actual last verse of that book) and the note text accurately summarizes the book's content.

- [ ] **Step 4: Write findings**

Create `docs/superpowers/specs/2026-07-23-prophets-data-audit-findings.md`, one entry per finding:

```markdown
## Finding N: <short description>
- **Category:** Incorrect | Missing | Unsupported | Structural gap
- **Verse(s):** <citation>
- **Current DB state:** <what's there now — key, field, or relationship>
- **Proposed correction:** <exact new value or exact new/removed relationship>
- **Severity:** Critical | Important | Minor
```

Only write findings for actual discrepancies. Reserve "Critical" strictly for structural gaps (missing people/relationships with cascading downstream effects) — every book's audit in this series except the very first has topped out at "Important" for single-field corrections. At the top of the file, add: `Reviewed: <N> people, <M> relationships, <K> refs. <F> findings.` — grep-count `N`/`M`/`K` yourself against the actual file before writing this line. If you notice something worth flagging but are unsure it clears the "actual discrepancy" bar, include it anyway with your reasoning — prior books' audits initially declined real findings this way, and it's better to include a borderline observation for the controller to judge than to silently omit it. If a finding is genuinely borderline with no single clearly-correct fix, it's acceptable to present it non-prescriptively (as recent books' audits have done successfully) — the controller and reviewer will resolve it together in the review step.

- [ ] **Step 5: Triple-check**

Re-verify every finding against the actual fetched text once more. Then do a second full read-through of the findings list checking for contradictions.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-07-23-prophets-data-audit-findings.md
git commit -m "$(cat <<'EOF'
docs: add Prophets data audit findings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Write the Correction Script and Run a Dry-Run Only

**Files:**
- Read: `docs/superpowers/specs/2026-07-23-prophets-data-audit-findings.md` (Task 1's output)
- Read: `scripts/fix-isaiah-audit.ts` (for the exact DB access + dry-run pattern to reuse verbatim, including `resolveScriptureRef` and new-ref-`INSERT` patterns if needed)
- Create: `scripts/fix-prophets-audit.ts`

**Interfaces:** None — standalone script.

This task stops after the dry-run. Do NOT execute the script for real or commit — that happens only after controller review, as a separate follow-up.

- [ ] **Step 1: Write the script**

Create `scripts/fix-prophets-audit.ts` following `scripts/fix-isaiah-audit.ts`'s exact pattern (same imports, same `.env.local` loading, same `DRY_RUN` gate, same fail-loud `resolveExisting`/`resolveRelationship` helpers, plus `resolveScriptureRef` or new-ref `INSERT OR IGNORE` statements if a finding requires them). For each finding in the findings document, implement it as `INSERT OR IGNORE` (new person/relationship/ref), `UPDATE` (wrong field), or `DELETE` (unsupported relationship/ref), with a comment directly above each statement citing which finding it implements. If a finding is about a relationship's own characterization (not just a description-text detail), soften both the person description and the relationship's notes field via `resolveRelationship`, per this series' established precedent. If the findings document has zero findings, the script only needs to report "no corrections needed" and exit cleanly — do not invent statements to implement. **Reminder from the Wisdom books and Isaiah audits:** `scripture_refs` has no unique constraint, so any new-ref `INSERT` statements are not idempotent — flag this clearly for Task 3 if this book's findings require any.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Run the dry-run and report the output**

Run: `npx tsx scripts/fix-prophets-audit.ts --dry-run`
Report the full output. If any resolver call throws, STOP and report BLOCKED with the exact error rather than guessing at a fix.

**Do not proceed past this step without controller review.** Report the full dry-run output and stop.

---

### Task 3: Live Execution and Post-Correction Verification

**Files:** `scripts/fix-prophets-audit.ts` (run, not modified further unless Task 2's dry-run needed a fix first)

**Interfaces:**
- Consumes: the reviewed, approved script from Task 2.

This task only starts once Task 2's dry-run has been reviewed and approved. If Task 1 found zero findings, this task still runs the script (to confirm it reports "no corrections needed" cleanly) and still performs Step 3 below.

- [ ] **Step 1: Run the script for real**

Run: `npx tsx scripts/fix-prophets-audit.ts`
Expected: matches the dry-run's statement count, no errors. If any new-ref `INSERT` statements are present, run this exactly once and verify no duplicate rows afterward (per the Wisdom books and Isaiah audits' precedent — `scripture_refs` has no unique constraint).

- [ ] **Step 2: Verify live via a direct DB query script**

Write a small script matching `scripts/fix-prophets-audit.ts`'s `.env.local`/`@libsql/client` connection pattern, query the affected rows directly, and confirm the specific corrections from the findings document are actually present. Delete the scratch script when done.

- [ ] **Step 3: Run the curated-family check**

Read `lib/families.ts`'s member lists and check whether any of this book's 18 new people, or Isaiah/Josiah/Nebuchadnezzar/Zerubbabel/Jeshua/Jeroboam II, appear in any curated family's roster. If any do, read `components/FamilyTree.tsx`'s `resolveFamilyMembers`/`buildForest` functions and run that chain-completeness check for the affected family, paying particular attention to whether `parent_of` edges are involved (per the established finding that `buildForest` only follows that edge type). If none do, note this and skip the check.

- [ ] **Step 4: Commit**

```bash
git add scripts/fix-prophets-audit.ts
git commit -m "$(cat <<'EOF'
fix: apply Prophets data audit corrections to live database

Implements every finding from
docs/superpowers/specs/2026-07-23-prophets-data-audit-findings.md
against the live Turso database. Controller reviewed the dry-run
output and script source before live execution, then independently
verified the result against a fresh live data pull, including a
curated-family roster check.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Self-Review Notes

- **Spec coverage:** enumeration + cross-referencing + findings (Task 1), correction script with dry-run safety (Task 2), live execution + verification (Task 3) — every section of the design spec has a task, including the Jeroboam-II-disambiguation and NT-citation checks called out explicitly in Task 1 Step 3.
- **Placeholder scan:** no TBDs; Task 1 points to the full file (314 lines) rather than inlining content, matching the already-accepted approach from prior books' plans, and explicitly organizes the large people count into two research groups rather than leaving the implementer to structure it ad hoc. Task 2/3 explicitly handle the possible zero-findings case and carry forward the non-idempotent-INSERT caution.
- **Type consistency:** N/A — this plan produces documentation and a standalone script, not a shared codebase interface.
