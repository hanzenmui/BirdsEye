# 1 Kings Data Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every person, relationship, and scripture ref in `scripts/seed-1kings.ts` against the actual 1 Kings text (ESV, fetched live), producing a findings document, then correct the live database to match — tenth of the planned per-book audit series.

**Architecture:** Single audit pass (13 new people), followed by a dry-run-safe correction script (same pattern as `scripts/fix-2samuel-audit.ts`, already reviewed and proven nine times), followed by post-correction verification.

**Tech Stack:** TypeScript, `tsx`, `@libsql/client` (Turso) for the correction script. WebFetch/WebSearch for source-text verification. No test framework (none exists in this project).

## Global Constraints

- **Source of truth:** ESV, fetched live via WebFetch/WebSearch for every claim checked — not recalled from memory.
- **In scope:** all 13 new people, all 18 relationships, and all 13 scripture refs in `scripts/seed-1kings.ts`.
- **Out of scope:** re-auditing David/Bathsheba/Nathan/Judah's own person records (owned by their originating books) — only the relationships this file adds referencing them are in scope; any book other than 1 Kings.
- **Findings categories:** exactly one of `Incorrect`, `Missing`, `Unsupported`, `Structural gap` per finding — never a compound value.
- **Priority:** (a) numeric/physical details (Solomon's 700 wives/300 concubines, the Queen of Sheba's 120 talents of gold, the twelve pieces of Ahijah's torn cloak, the twenty towns given to Hiram and their "Cabul" naming, the count of prophets Obadiah hid), (b) Jezebel's father Ethbaal and her title matching 1 Kgs 16:31 precisely, (c) the Rehoboam/Jeroboam split's causal sequence and Ahijah's role, (d) Elijah's Carmel/Horeb/Naboth narrative details, (e) all 13 refs' chapter:verse ranges and note text.
- **Coverage counts:** the required top-line summary (people/relationships/refs) must be independently grep-verifiable — every prior book's audit initially miscounted at least one of these. Actually grep-count, don't estimate. Expected: 13 people, 18 relationships, 13 refs — verify these yourself rather than trusting this summary.
- **Nothing gets written to the live database until Task 2** — Task 1 is pure research/documentation, producing markdown only.
- **The `relationships` table has a `UNIQUE(person_a_id, type, person_b_id)` index** (added in commit `7292aa9`) — `INSERT OR IGNORE` for relationships is genuinely idempotent.
- **If live-data verification hits a sandboxed-network limitation**, the controller can verify directly via a small script following `scripts/fix-2samuel-audit.ts`'s `.env.local`/client-setup pattern rather than the app's API — this is an acceptable fallback, not a blocker.

---

### Task 1: Audit 1 Kings's People, Relationships & Refs

**Files:**
- Read: `scripts/seed-1kings.ts` (full file, 223 lines)
- Read: `docs/superpowers/specs/2026-07-20-2samuel-data-audit-findings.md` (for context on already-established David/Bathsheba/Nathan records this book's relationships reference)
- Create: `docs/superpowers/specs/2026-07-20-1kings-data-audit-findings.md`

**Interfaces:**
- Produces: a findings markdown file Task 2 reads to write the correction script.

- [ ] **Step 1: Enumerate**

Read `scripts/seed-1kings.ts` in full. List all 13 people (`key`, `name`, `alsoKnownAs`, `gender`, `description`, `tags`), all 18 relationships, and all 13 scripture refs.

- [ ] **Step 2: Fetch source text**

Use WebFetch/WebSearch to retrieve the ESV text of 1 Kings 1-2 (Adonijah's bid, Solomon's coronation), 3-11 (Solomon's wisdom, the Temple, Hiram, the Queen of Sheba, Solomon's wives and decline), 12 (the kingdom's split), 11:26-40 and 14:1-18 (Ahijah's prophecies), 16-22 (Ahab, Jezebel, Elijah, Obadiah, Naboth, Ben-hadad). Do not answer from memory.

- [ ] **Step 3: Cross-reference**

For each of the 13 people: verify name, alternate names, gender, and that the description doesn't contradict the text — with special attention to numeric/physical details (Solomon's wife/concubine counts 1 Kgs 11:3; the Queen of Sheba's gold amount 1 Kgs 10:10; Ahijah's torn cloak "twelve pieces" 1 Kgs 11:30; Hiram's twenty towns and the "Cabul" name 1 Kgs 9:11-13; Obadiah hiding "by fifties in a cave" 1 Kgs 18:4), Jezebel's father Ethbaal and title (1 Kgs 16:31), and the Rehoboam/Jeroboam split's causal sequence (1 Kgs 12) and Ahijah's role (1 Kgs 11:29-31). For each relationship: verify it's textually supported and correctly typed, including the four referencing pre-existing people (David, Bathsheba, Nathan, Judah). For each of the 13 refs: verify the chapter:verse range is correct and the note text accurately summarizes what's in that passage.

- [ ] **Step 4: Write findings**

Create `docs/superpowers/specs/2026-07-20-1kings-data-audit-findings.md`, one entry per finding:

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

Re-verify every finding against the actual fetched text once more, with particular care on any numeric detail. Then do a second full read-through of the findings list checking for contradictions.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-07-20-1kings-data-audit-findings.md
git commit -m "$(cat <<'EOF'
docs: add 1 Kings data audit findings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Write the Correction Script and Run a Dry-Run Only

**Files:**
- Read: `docs/superpowers/specs/2026-07-20-1kings-data-audit-findings.md` (Task 1's output)
- Read: `scripts/fix-2samuel-audit.ts` (for the exact DB access + dry-run pattern to reuse verbatim)
- Create: `scripts/fix-1kings-audit.ts`

**Interfaces:** None — standalone script.

This task stops after the dry-run. Do NOT execute the script for real or commit — that happens only after controller review, as a separate follow-up.

- [ ] **Step 1: Write the script**

Create `scripts/fix-1kings-audit.ts` following `scripts/fix-2samuel-audit.ts`'s exact pattern (same imports, same `.env.local` loading, same `DRY_RUN` gate, same fail-loud `resolveExisting`/`resolveRelationship` helpers). For each finding in the findings document, implement it as `INSERT OR IGNORE` (new person/relationship/ref), `UPDATE` (wrong field), or `DELETE` (unsupported relationship/ref), with a comment directly above each statement citing which finding it implements. If the findings document has zero findings, the script only needs to report "no corrections needed" and exit cleanly — do not invent statements to implement.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Run the dry-run and report the output**

Run: `npx tsx scripts/fix-1kings-audit.ts --dry-run`
Report the full output. If any resolver call throws, STOP and report BLOCKED with the exact error rather than guessing at a fix.

**Do not proceed past this step without controller review.** Report the full dry-run output and stop.

---

### Task 3: Live Execution and Post-Correction Verification

**Files:** `scripts/fix-1kings-audit.ts` (run, not modified further unless Task 2's dry-run needed a fix first)

**Interfaces:**
- Consumes: the reviewed, approved script from Task 2.

This task only starts once Task 2's dry-run has been reviewed and approved. If Task 1 found zero findings, this task still runs the script (to confirm it reports "no corrections needed" cleanly) and still performs Step 3 below.

- [ ] **Step 1: Run the script for real**

Run: `npx tsx scripts/fix-1kings-audit.ts`
Expected: matches the dry-run's statement count, no errors.

- [ ] **Step 2: Verify live via the API (or direct DB query if the API/dev-server route hits a network limitation)**

Start the dev server (pick a free port among 3000-3004; run `npm install` first if `node_modules` is missing in this worktree), log in with the passcode from `.env.local` (`ADMIN_PASSCODE`), pull `/api/people`, `/api/relationships`, and `/api/refs` with the authenticated session cookie, and confirm the specific corrections from the findings document are actually present. If any outbound network call from the dev server times out, fall back to a direct `@libsql/client` query script instead. Stop the dev server when done; delete any scratch cookie/JSON files.

- [ ] **Step 3: Run the curated-family chain-completeness check**

Read `lib/families.ts`'s member lists and check whether any of this book's 13 people (Adonijah, Solomon, Hiram, Queen of Sheba, Rehoboam, Jeroboam, Ahijah, Elijah, Ahab, Jezebel, Obadiah, Naboth, Ben-hadad) appear in any curated family's roster — Solomon is a known `david_family` member (already verified in the 1/2 Samuel audits' family checks) and Adonijah may also be present; check the actual current roster, don't assume. If any roster members are affected, read `components/FamilyTree.tsx`'s `resolveFamilyMembers`/`buildForest` functions and run that same chain-completeness check against the live, post-correction data for the affected family. If none are affected beyond what's already been verified clean in prior audits, note this and skip the full re-check.

- [ ] **Step 4: Commit**

```bash
git add scripts/fix-1kings-audit.ts
git commit -m "$(cat <<'EOF'
fix: apply 1 Kings data audit corrections to live database

Implements every finding from
docs/superpowers/specs/2026-07-20-1kings-data-audit-findings.md
against the live Turso database. Controller reviewed the dry-run
output and script source before live execution, then independently
verified the result against a fresh live data pull, including a
curated-family roster check.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Self-Review Notes

- **Spec coverage:** enumeration + cross-referencing + findings (Task 1), correction script with dry-run safety (Task 2), live execution + verification (Task 3) — every section of the design spec has a task, including the curated-family check called out in Task 3 Step 3.
- **Placeholder scan:** no TBDs; Task 1 points to the full file (223 lines) rather than inlining content, matching the already-accepted approach from prior books' plans. Task 2/3 explicitly handle the possible zero-findings case, and Task 3 Step 2 explicitly handles the sandboxed-network fallback observed in prior books' audits.
- **Type consistency:** N/A — this plan produces documentation and a standalone script, not a shared codebase interface.
