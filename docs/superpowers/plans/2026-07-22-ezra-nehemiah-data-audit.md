# Ezra-Nehemiah Data Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every person, relationship, and scripture ref in `scripts/seed-ezra-nehemiah.ts` against the actual biblical text (ESV, fetched live), producing a findings document, then correct the live database to match — fourteenth of the planned per-book audit series.

**Architecture:** Single audit pass (11 new people), followed by a dry-run-safe correction script (same pattern as `scripts/fix-chronicles-audit.ts`, already reviewed and proven thirteen times), followed by post-correction verification.

**Tech Stack:** TypeScript, `tsx`, `@libsql/client` (Turso) for the correction script. WebFetch/WebSearch for source-text verification. No test framework (none exists in this project).

## Global Constraints

- **Source of truth:** ESV, fetched live via WebFetch/WebSearch for every claim checked — not recalled from memory.
- **In scope:** all 11 new people (Cyrus, Darius, Artaxerxes, Sheshbazzar, Zerubbabel, Jeshua the high priest, Ezra, Nehemiah, Sanballat, Tobiah, Geshem), all 11 relationships, and all 18 scripture refs in `scripts/seed-ezra-nehemiah.ts`.
- **Out of scope:** re-auditing Solomon's own person record (owned by 1 Kings) or Zerubbabel's fuller genealogical chain established by the Late Kings of Judah audit — only this file's own contributions are in scope; any book other than this file's scope.
- **Findings categories:** exactly one of `Incorrect`, `Missing`, `Unsupported`, `Structural gap` per finding — never a compound value.
- **Priority:** (a) timing/duration claims (Isaiah naming Cyrus "150+ years" before his birth — verify against standard datings; Darius's "sixth year" Temple completion; Ezra's "seventh year" and Nehemiah's "twentieth year" of Artaxerxes; the wall built "in 52 days"), (b) the Sheshbazzar/Zerubbabel identification question's framing accuracy, (c) the `Solomon ancestor_of Zerubbabel` relationship's textual basis and consistency with the Late Kings audit's precise chain (not a duplicate or contradiction), (d) Sanballat/Tobiah/Geshem's specific details (quoted taunts, Tobiah's Temple-room episode, the Ono plain meeting attempt), (e) all 18 refs' chapter:verse ranges and note text across six cited books.
- **Coverage counts:** the required top-line summary (people/relationships/refs) must be independently grep-verifiable — every prior book's audit initially miscounted at least one of these. Actually grep-count, don't estimate. Expected: 11 people, 11 relationships, 18 refs — verify these yourself rather than trusting this summary.
- **Nothing gets written to the live database until Task 2** — Task 1 is pure research/documentation, producing markdown only.
- **Prefer direct `@libsql/client` verification scripts over the dev-server API route** for Task 3, given intermittent network issues observed in several prior books' audits.

---

### Task 1: Audit Ezra-Nehemiah's People, Relationships & Refs

**Files:**
- Read: `scripts/seed-ezra-nehemiah.ts` (full file, 195 lines)
- Create: `docs/superpowers/specs/2026-07-22-ezra-nehemiah-data-audit-findings.md`

**Interfaces:**
- Produces: a findings markdown file Task 2 reads to write the correction script.

- [ ] **Step 1: Enumerate**

Read `scripts/seed-ezra-nehemiah.ts` in full. List all 11 people (`key`, `name`, `alsoKnownAs`, `gender`, `description`, `tags`), all 11 relationships, and all 18 scripture refs.

- [ ] **Step 2: Fetch source text**

Use WebFetch/WebSearch to retrieve the ESV text of Ezra 1 (Cyrus's decree), Isaiah 44:28-45:1 (Cyrus named by prophecy), Ezra 5-6 (Darius confirms the decree), Ezra 7 (Artaxerxes authorizes Ezra), Nehemiah 2 (Artaxerxes sends Nehemiah), Ezra 2-6 (Sheshbazzar, Zerubbabel, Jeshua, the Temple rebuilding), Haggai 1-2 and Zechariah 3-4 (the prophetic visions), Ezra 7-10 (Ezra's mission and the foreign-wife crisis), Nehemiah 1-13 (Nehemiah's wall, reforms, and opposition), Nehemiah 8 (Ezra reads the Law). Do not answer from memory.

- [ ] **Step 3: Cross-reference**

For each of the 11 people: verify name, alternate names, gender, and that the description doesn't contradict the text — with special attention to the timing/duration claims (Isaiah's "150+ years" before Cyrus's birth — research standard scholarly datings for Isaiah's ministry and Cyrus's birth/reign to check this approximation; Darius's sixth-year Temple completion, Ezra's seventh-year and Nehemiah's twentieth-year dates, the 52-day wall), the Sheshbazzar/Zerubbabel identification framing (research whether "some scholars identify... most treat as separate" accurately characterizes the actual scholarly landscape), and Sanballat/Tobiah/Geshem's specific quoted details. For each relationship: verify it's textually supported and correctly typed — specifically check the `Solomon ancestor_of Zerubbabel` relationship's textual basis (Matt 1:12-13) and whether it's consistent with (not duplicating or contradicting) the precise `Jehoiachin→Shealtiel→Zerubbabel` chain the Late Kings of Judah audit already established. For each of the 18 refs: verify the chapter:verse range is correct and the note text accurately summarizes what's in that passage.

- [ ] **Step 4: Write findings**

Create `docs/superpowers/specs/2026-07-22-ezra-nehemiah-data-audit-findings.md`, one entry per finding:

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
git add docs/superpowers/specs/2026-07-22-ezra-nehemiah-data-audit-findings.md
git commit -m "$(cat <<'EOF'
docs: add Ezra-Nehemiah data audit findings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Write the Correction Script and Run a Dry-Run Only

**Files:**
- Read: `docs/superpowers/specs/2026-07-22-ezra-nehemiah-data-audit-findings.md` (Task 1's output)
- Read: `scripts/fix-chronicles-audit.ts` (for the exact DB access + dry-run pattern to reuse verbatim)
- Create: `scripts/fix-ezra-nehemiah-audit.ts`

**Interfaces:** None — standalone script.

This task stops after the dry-run. Do NOT execute the script for real or commit — that happens only after controller review, as a separate follow-up.

- [ ] **Step 1: Write the script**

Create `scripts/fix-ezra-nehemiah-audit.ts` following `scripts/fix-chronicles-audit.ts`'s exact pattern (same imports, same `.env.local` loading, same `DRY_RUN` gate, same fail-loud `resolveExisting`/`resolveRelationship` helpers). For each finding in the findings document, implement it as `INSERT OR IGNORE` (new person/relationship/ref), `UPDATE` (wrong field), or `DELETE` (unsupported relationship/ref), with a comment directly above each statement citing which finding it implements. If a finding is about a relationship's own characterization (not just a description-text detail), soften both the person description and the relationship's notes field via `resolveRelationship`, per this series' established precedent. If the findings document has zero findings, the script only needs to report "no corrections needed" and exit cleanly — do not invent statements to implement.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Run the dry-run and report the output**

Run: `npx tsx scripts/fix-ezra-nehemiah-audit.ts --dry-run`
Report the full output. If any resolver call throws, STOP and report BLOCKED with the exact error rather than guessing at a fix.

**Do not proceed past this step without controller review.** Report the full dry-run output and stop.

---

### Task 3: Live Execution and Post-Correction Verification

**Files:** `scripts/fix-ezra-nehemiah-audit.ts` (run, not modified further unless Task 2's dry-run needed a fix first)

**Interfaces:**
- Consumes: the reviewed, approved script from Task 2.

This task only starts once Task 2's dry-run has been reviewed and approved. If Task 1 found zero findings, this task still runs the script (to confirm it reports "no corrections needed" cleanly) and still performs Step 3 below.

- [ ] **Step 1: Run the script for real**

Run: `npx tsx scripts/fix-ezra-nehemiah-audit.ts`
Expected: matches the dry-run's statement count, no errors.

- [ ] **Step 2: Verify live via a direct DB query script**

Write a small script matching `scripts/fix-ezra-nehemiah-audit.ts`'s `.env.local`/`@libsql/client` connection pattern, query the affected rows directly, and confirm the specific corrections from the findings document are actually present. Delete the scratch script when done.

- [ ] **Step 3: Run the curated-family check**

Read `lib/families.ts`'s member lists and check whether any of this book's 11 people appear in any curated family's roster. If none do, note this and skip the `buildForest` chain-completeness check. If any do, read `components/FamilyTree.tsx`'s `resolveFamilyMembers`/`buildForest` functions and run that chain-completeness check for the affected family.

- [ ] **Step 4: Commit**

```bash
git add scripts/fix-ezra-nehemiah-audit.ts
git commit -m "$(cat <<'EOF'
fix: apply Ezra-Nehemiah data audit corrections to live database

Implements every finding from
docs/superpowers/specs/2026-07-22-ezra-nehemiah-data-audit-findings.md
against the live Turso database. Controller reviewed the dry-run
output and script source before live execution, then independently
verified the result against a fresh live data pull, including a
curated-family roster check.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Self-Review Notes

- **Spec coverage:** enumeration + cross-referencing + findings (Task 1), correction script with dry-run safety (Task 2), live execution + verification (Task 3) — every section of the design spec has a task, including the Solomon/Zerubbabel relationship-consistency check called out explicitly in Task 1 Step 3.
- **Placeholder scan:** no TBDs; Task 1 points to the full file (195 lines) rather than inlining content, matching the already-accepted approach from prior books' plans. Task 2/3 explicitly handle the possible zero-findings case.
- **Type consistency:** N/A — this plan produces documentation and a standalone script, not a shared codebase interface.
