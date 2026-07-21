# 2 Kings Data Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every person, relationship, and scripture ref in `scripts/seed-2kings.ts` against the actual 2 Kings text (ESV, fetched live), producing a findings document, then correct the live database to match — eleventh of the planned per-book audit series.

**Architecture:** Single audit pass (22 new people, comparable to 1 Samuel and Numbers), followed by a dry-run-safe correction script (same pattern as `scripts/fix-1kings-audit.ts`, already reviewed and proven ten times), followed by post-correction verification.

**Tech Stack:** TypeScript, `tsx`, `@libsql/client` (Turso) for the correction script. WebFetch/WebSearch for source-text verification. No test framework (none exists in this project).

## Global Constraints

- **Source of truth:** ESV, fetched live via WebFetch/WebSearch for every claim checked — not recalled from memory.
- **In scope:** all 22 new people, all 31 relationships, and all 22 scripture refs in `scripts/seed-2kings.ts` — including the ref citing 2 Chronicles for Zechariah son of Jehoiada (native to this file even though the citation itself is cross-book).
- **Out of scope:** re-auditing Ahab/Jezebel/Elijah/Solomon/Jonah/Jeremiah's own person records (owned by their originating books) — only the relationships this file adds referencing them are in scope; `scripts/seed-late-kings.ts` (a separate, subsequent audit); any book other than 2 Kings.
- **Findings categories:** exactly one of `Incorrect`, `Missing`, `Unsupported`, `Structural gap` per finding — never a compound value.
- **Priority:** (a) each "Not to be confused with" disambiguation pairing (Ahaziah Israel/Judah, Joram/Jehoram Israel/Judah, Jeroboam I/II, Amon king/Egyptian god, Manasseh king/son-of-Joseph, Zechariah son-of-Jehoiada/post-exilic-prophet) is textually accurate AND the two figures remain genuinely distinct in the live DB — check for accidental name-collision risk, not just prose accuracy, (b) numeric/physical details (Jehu's "seventy sons" of Ahab, the 185,000 Assyrians, Manasseh's 55-year reign, Hezekiah's 15 additional years, Josiah's age-eight accession and eighteenth-year reform, Amon's 2-year reign, Jehoiada's age at death — 130), (c) the causal chains connecting successive kings, (d) the cross-book Zechariah/2-Chronicles ref's accuracy, (e) all 22 refs' chapter:verse ranges and note text.
- **Coverage counts:** the required top-line summary (people/relationships/refs) must be independently grep-verifiable — every prior book's audit initially miscounted at least one of these. Actually grep-count, don't estimate. Expected: 22 people, 31 relationships, 22 refs — verify these yourself rather than trusting this summary.
- **Nothing gets written to the live database until Task 2** — Task 1 is pure research/documentation, producing markdown only.
- **The `relationships` table has a `UNIQUE(person_a_id, type, person_b_id)` index** (added in commit `7292aa9`) — `INSERT OR IGNORE` for relationships is genuinely idempotent.
- **If live-data verification hits a sandboxed-network limitation**, the controller can verify directly via a small script following `scripts/fix-1kings-audit.ts`'s `.env.local`/client-setup pattern — this is an acceptable fallback, not a blocker.

---

### Task 1: Audit 2 Kings's People, Relationships & Refs

**Files:**
- Read: `scripts/seed-2kings.ts` (full file, 309 lines)
- Create: `docs/superpowers/specs/2026-07-20-2kings-data-audit-findings.md`

**Interfaces:**
- Produces: a findings markdown file Task 2 reads to write the correction script.

- [ ] **Step 1: Enumerate**

Read `scripts/seed-2kings.ts` in full. List all 22 people (`key`, `name`, `alsoKnownAs`, `gender`, `description`, `tags`), all 31 relationships, and all 22 scripture refs.

- [ ] **Step 2: Fetch source text**

Use WebFetch/WebSearch to retrieve the ESV text of 2 Kings 2 (Elijah's whirlwind, Elisha's call), 4-5 (Elisha's miracles, Naaman, Gehazi), 8-11 (Jehu's revolution, Athaliah's coup, Joash's coronation), 12 (Joash's Temple repair and later apostasy), 2 Chronicles 24 (Zechariah's stoning — fuller narrative than 2 Kings has), 14 (Jeroboam II), 15 (Pekah), 17 (Hoshea, Samaria's fall), 18-20 (Hezekiah, Sennacherib, Isaiah), 21 (Manasseh, Amon), 22-23 (Josiah, Huldah). Do not answer from memory.

- [ ] **Step 3: Cross-reference**

For each of the 22 people: verify name, alternate names, gender, and that the description doesn't contradict the text — with special attention to each "Not to be confused with" pairing (verify both figures are textually distinct as claimed) and numeric/physical details (Jehu's seventy sons of Ahab 2 Kgs 10:1-7, the 185,000 Assyrians 2 Kgs 19:35, Manasseh's 55-year reign 2 Kgs 21:1, Hezekiah's 15 additional years 2 Kgs 20:6, Josiah's age eight and eighteenth-year reform 2 Kgs 22:1/22:3, Amon's 2-year reign 2 Kgs 21:19, Jehoiada's age 130 at death — check whether this detail is actually in 2 Kings or only in 2 Chronicles 24:15, since the seed file's Jehoiada description states it as fact). For each relationship: verify it's textually supported and correctly typed, including the six referencing pre-existing people (Ahab, Jezebel, Elijah, Solomon, Jonah, Jeremiah). For each of the 22 refs: verify the chapter:verse range is correct and the note text accurately summarizes what's in that passage, including the 2-Chronicles-cited Zechariah ref.

- [ ] **Step 4: Write findings**

Create `docs/superpowers/specs/2026-07-20-2kings-data-audit-findings.md`, one entry per finding:

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

Re-verify every finding against the actual fetched text once more, with particular care on the disambiguation pairs and numeric details. Then do a second full read-through of the findings list checking for contradictions.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-07-20-2kings-data-audit-findings.md
git commit -m "$(cat <<'EOF'
docs: add 2 Kings data audit findings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Write the Correction Script and Run a Dry-Run Only

**Files:**
- Read: `docs/superpowers/specs/2026-07-20-2kings-data-audit-findings.md` (Task 1's output)
- Read: `scripts/fix-1kings-audit.ts` (for the exact DB access + dry-run pattern to reuse verbatim)
- Create: `scripts/fix-2kings-audit.ts`

**Interfaces:** None — standalone script.

This task stops after the dry-run. Do NOT execute the script for real or commit — that happens only after controller review, as a separate follow-up.

- [ ] **Step 1: Write the script**

Create `scripts/fix-2kings-audit.ts` following `scripts/fix-1kings-audit.ts`'s exact pattern (same imports, same `.env.local` loading, same `DRY_RUN` gate, same fail-loud `resolveExisting`/`resolveRelationship` helpers). For each finding in the findings document, implement it as `INSERT OR IGNORE` (new person/relationship/ref), `UPDATE` (wrong field), or `DELETE` (unsupported relationship/ref), with a comment directly above each statement citing which finding it implements. If any finding involves disambiguating two same-named people, verify carefully which `also_known_as` value targets which record before writing the resolver call. If the findings document has zero findings, the script only needs to report "no corrections needed" and exit cleanly — do not invent statements to implement.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Run the dry-run and report the output**

Run: `npx tsx scripts/fix-2kings-audit.ts --dry-run`
Report the full output. If any resolver call throws, STOP and report BLOCKED with the exact error rather than guessing at a fix.

**Do not proceed past this step without controller review.** Report the full dry-run output and stop.

---

### Task 3: Live Execution and Post-Correction Verification

**Files:** `scripts/fix-2kings-audit.ts` (run, not modified further unless Task 2's dry-run needed a fix first)

**Interfaces:**
- Consumes: the reviewed, approved script from Task 2.

This task only starts once Task 2's dry-run has been reviewed and approved. If Task 1 found zero findings, this task still runs the script (to confirm it reports "no corrections needed" cleanly) and still performs Step 3 below.

- [ ] **Step 1: Run the script for real**

Run: `npx tsx scripts/fix-2kings-audit.ts`
Expected: matches the dry-run's statement count, no errors.

- [ ] **Step 2: Verify live via the API (or direct DB query if the API/dev-server route hits a network limitation)**

Start the dev server (pick a free port among 3000-3004; run `npm install` first if `node_modules` is missing in this worktree), log in with the passcode from `.env.local` (`ADMIN_PASSCODE`), pull `/api/people`, `/api/relationships`, and `/api/refs` with the authenticated session cookie, and confirm the specific corrections from the findings document are actually present. If any outbound network call from the dev server times out, fall back to a direct `@libsql/client` query script instead. Stop the dev server when done; delete any scratch cookie/JSON files.

- [ ] **Step 3: Run the curated-family check**

Read `lib/families.ts`'s member lists and check whether any of this book's 22 people appear in any curated family's roster. If none do, note this and skip the `buildForest` chain-completeness check. If any do, read `components/FamilyTree.tsx`'s `resolveFamilyMembers`/`buildForest` functions and run that chain-completeness check for the affected family.

- [ ] **Step 4: Commit**

```bash
git add scripts/fix-2kings-audit.ts
git commit -m "$(cat <<'EOF'
fix: apply 2 Kings data audit corrections to live database

Implements every finding from
docs/superpowers/specs/2026-07-20-2kings-data-audit-findings.md
against the live Turso database. Controller reviewed the dry-run
output and script source before live execution, then independently
verified the result against a fresh live data pull, including a
curated-family roster check.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Self-Review Notes

- **Spec coverage:** enumeration + cross-referencing + findings (Task 1), correction script with dry-run safety (Task 2), live execution + verification (Task 3) — every section of the design spec has a task, including the disambiguation-pair scrutiny called out explicitly in Task 1 Step 3.
- **Placeholder scan:** no TBDs; Task 1 points to the full file (309 lines) rather than inlining content, matching the already-accepted approach from prior books' plans. Task 2/3 explicitly handle the possible zero-findings case, and Task 3 Step 2 explicitly handles the sandboxed-network fallback observed in prior books' audits.
- **Type consistency:** N/A — this plan produces documentation and a standalone script, not a shared codebase interface.
