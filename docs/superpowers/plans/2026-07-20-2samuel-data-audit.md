# 2 Samuel Data Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every person, relationship, and scripture ref in `scripts/seed-2samuel.ts` against the actual 2 Samuel text (ESV, fetched live), producing a findings document, then correct the live database to match — ninth of the planned per-book audit series.

**Architecture:** Single audit pass (17 new people), followed by a dry-run-safe correction script (same pattern as `scripts/fix-1samuel-audit.ts`, already reviewed and proven eight times), followed by post-correction verification that must actually run the `buildForest` chain-completeness check since `david_family` already includes Bathsheba and likely other names this book adds relationships for.

**Tech Stack:** TypeScript, `tsx`, `@libsql/client` (Turso) for the correction script. WebFetch/WebSearch for source-text verification. No test framework (none exists in this project).

## Global Constraints

- **Source of truth:** ESV, fetched live via WebFetch/WebSearch for every claim checked — not recalled from memory.
- **In scope:** all 17 new people, all 30 relationships, and all 20 scripture refs in `scripts/seed-2samuel.ts`.
- **Out of scope:** re-auditing Saul/Jonathan/Abner/David/Ahinoam's own person records (owned by their originating books) — only the relationships this file adds referencing them are in scope; any book other than 2 Samuel.
- **Findings categories:** exactly one of `Incorrect`, `Missing`, `Unsupported`, `Structural gap` per finding — never a compound value.
- **Priority:** (a) the Ish-bosheth/Esh-baal and Mephibosheth/Merib-baal dual-naming convention is stated accurately (a genuine scribal "bosheth"-for-"baal" substitution, not just an alternate spelling), (b) the "David sibling_of Zeruiah" relationship's actual textual basis — confirm whether 2 Samuel itself supports this or whether it requires the 1 Chronicles 2:16 cross-reference, and that the citation used is accurate, (c) the Bathsheba/David/Uriah/Nathan sequence and Solomon's birth-order among Bathsheba's sons, (d) Absalom's physical description (hair weight — check the ESV's actual unit, likely "shekels," not necessarily "pounds") and the revolt's key relationship turns, (e) all 20 refs' chapter:verse ranges and note text.
- **Coverage counts:** the required top-line summary (people/relationships/refs) must be independently grep-verifiable — every prior book's audit initially miscounted at least one of these. Actually grep-count, don't estimate. Expected: 17 people, 30 relationships, 20 refs — verify these yourself rather than trusting this summary.
- **Nothing gets written to the live database until Task 2** — Task 1 is pure research/documentation, producing markdown only.
- **The `relationships` table has a `UNIQUE(person_a_id, type, person_b_id)` index** (added in commit `7292aa9`) — `INSERT OR IGNORE` for relationships is genuinely idempotent.
- **If live-data verification hits a sandboxed-network limitation** (observed during 1 Samuel's Task 3 review for some subagents), the controller can verify directly via a small script following `scripts/fix-1samuel-audit.ts`'s `.env.local`/client-setup pattern rather than the app's API — this is an acceptable fallback, not a blocker.

---

### Task 1: Audit 2 Samuel's People, Relationships & Refs

**Files:**
- Read: `scripts/seed-2samuel.ts` (full file, 268 lines)
- Read: `docs/superpowers/specs/2026-07-20-1samuel-data-audit-findings.md` (for context on already-established Saul/David/Jonathan/Abner/Ahinoam records this book's relationships reference)
- Create: `docs/superpowers/specs/2026-07-20-2samuel-data-audit-findings.md`

**Interfaces:**
- Produces: a findings markdown file Task 2 reads to write the correction script.

- [ ] **Step 1: Enumerate**

Read `scripts/seed-2samuel.ts` in full. List all 17 people (`key`, `name`, `alsoKnownAs`, `gender`, `description`, `tags`), all 30 relationships, and all 20 scripture refs.

- [ ] **Step 2: Fetch source text**

Use WebFetch/WebSearch to retrieve the ESV text of 2 Samuel 2-4 (Ish-bosheth, Abner's defection and death), 6 (Obed-edom, the ark), 7 (Nathan's covenant), 8-9 (Zadok, Mephibosheth restored), 11-12 (Bathsheba, Uriah, Nathan's confrontation), 13 (Amnon, Tamar, Absalom's revenge), 15-18 (Absalom's revolt, Ahithophel, Hushai, Shimei). Also fetch 1 Chronicles 2:16 for the "Zeruiah is David's sister" claim. Do not answer from memory.

- [ ] **Step 3: Cross-reference**

For each of the 17 people: verify name, alternate names, gender, and that the description doesn't contradict the text — with special attention to the Ish-bosheth/Esh-baal and Mephibosheth/Merib-baal naming (is the DB's framing of this as a name-substitution convention accurate, or does it need adjustment?), Absalom's hair-weight unit (ESV wording — likely "two hundred shekels," not "five pounds" as a bare unit; check whether the seed description's "five pounds" is a reasonable modern-equivalent gloss or should cite the ESV's actual unit), and Solomon's position among Bathsheba's named sons (2 Sam 5:14 / 1 Chr 3:5 lists Shammua, Shobab, Nathan, Solomon — check against the seed file's "Solomon, Shimea, Shobab, and Nathan" ordering and naming, since "Shimea" vs. "Shammua" may be a spelling variant worth checking, not an error). For the "David sibling_of Zeruiah" relationship: confirm whether 2 Samuel itself ever states this or whether the citation should point to 1 Chronicles 2:16 instead. For each relationship: verify it's textually supported and correctly typed, including the many referencing pre-existing 1-Samuel-seeded people. For each of the 20 refs: verify the chapter:verse range is correct and the note text accurately summarizes what's in that passage.

- [ ] **Step 4: Write findings**

Create `docs/superpowers/specs/2026-07-20-2samuel-data-audit-findings.md`, one entry per finding:

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
git add docs/superpowers/specs/2026-07-20-2samuel-data-audit-findings.md
git commit -m "$(cat <<'EOF'
docs: add 2 Samuel data audit findings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Write the Correction Script and Run a Dry-Run Only

**Files:**
- Read: `docs/superpowers/specs/2026-07-20-2samuel-data-audit-findings.md` (Task 1's output)
- Read: `scripts/fix-1samuel-audit.ts` (for the exact DB access + dry-run pattern to reuse verbatim, including its `resolveScriptureRef` helper if a ref needs updating, and the corrected `alsoKnownAs !== undefined` disambiguation logic)
- Create: `scripts/fix-2samuel-audit.ts`

**Interfaces:** None — standalone script.

This task stops after the dry-run. Do NOT execute the script for real or commit — that happens only after controller review, as a separate follow-up.

- [ ] **Step 1: Write the script**

Create `scripts/fix-2samuel-audit.ts` following `scripts/fix-1samuel-audit.ts`'s exact pattern (same imports, same `.env.local` loading, same `DRY_RUN` gate, same fail-loud `resolveExisting`/`resolveRelationship` helpers). For each finding in the findings document, implement it as `INSERT OR IGNORE` (new person/relationship/ref), `UPDATE` (wrong field), or `DELETE` (unsupported relationship/ref), with a comment directly above each statement citing which finding it implements. If the findings document has zero findings, the script only needs to report "no corrections needed" and exit cleanly — do not invent statements to implement.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Run the dry-run and report the output**

Run: `npx tsx scripts/fix-2samuel-audit.ts --dry-run`
Report the full output. If any resolver call throws, STOP and report BLOCKED with the exact error rather than guessing at a fix.

**Do not proceed past this step without controller review.** Report the full dry-run output and stop.

---

### Task 3: Live Execution and Post-Correction Verification

**Files:** `scripts/fix-2samuel-audit.ts` (run, not modified further unless Task 2's dry-run needed a fix first)

**Interfaces:**
- Consumes: the reviewed, approved script from Task 2.

This task only starts once Task 2's dry-run has been reviewed and approved. If Task 1 found zero findings, this task still runs the script (to confirm it reports "no corrections needed" cleanly) and still performs Step 3 below.

- [ ] **Step 1: Run the script for real**

Run: `npx tsx scripts/fix-2samuel-audit.ts`
Expected: matches the dry-run's statement count, no errors.

- [ ] **Step 2: Verify live via the API (or direct DB query if the API/dev-server route hits a network limitation)**

Start the dev server (pick a free port among 3000-3004; run `npm install` first if `node_modules` is missing in this worktree), log in with the passcode from `.env.local` (`ADMIN_PASSCODE`), pull `/api/people`, `/api/relationships`, and `/api/refs` with the authenticated session cookie, and confirm the specific corrections from the findings document are actually present. If any outbound network call from the dev server times out (a sandboxed-environment limitation observed previously, not a data problem), fall back to a direct `@libsql/client` query script (matching `scripts/fix-2samuel-audit.ts`'s connection setup) to verify the same rows instead. Stop the dev server when done; delete any scratch cookie/JSON files.

- [ ] **Step 3: Run the curated-family chain-completeness check**

Read `lib/families.ts`'s `david_family` roster and confirm which of this book's people are members (Bathsheba is already known to be one — check the actual current roster for others, don't assume). Read `components/FamilyTree.tsx`'s `resolveFamilyMembers`/`buildForest` functions, then run that same chain-completeness check against the live, post-correction data for `david_family` — confirm every 2-Samuel-audited roster member resolves correctly with no ambiguous duplicate-name collisions (note: this book introduces a second "Tamar" — `tamar_david` — the seed file's own description already disambiguates her from Tamar wife of Judah and Tamar mother of Absalom's daughter; confirm the family-roster resolution doesn't get confused by this). Also confirm none of this book's other people unexpectedly appear in any other curated family's roster.

- [ ] **Step 4: Commit**

```bash
git add scripts/fix-2samuel-audit.ts
git commit -m "$(cat <<'EOF'
fix: apply 2 Samuel data audit corrections to live database

Implements every finding from
docs/superpowers/specs/2026-07-20-2samuel-data-audit-findings.md
against the live Turso database. Controller reviewed the dry-run
output and script source before live execution, then independently
verified the result against a fresh live data pull, including a
buildForest chain-completeness check on the david_family curated
roster.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Self-Review Notes

- **Spec coverage:** enumeration + cross-referencing + findings (Task 1), correction script with dry-run safety (Task 2), live execution + verification (Task 3) — every section of the design spec has a task, including the explicit `david_family`/Tamar-disambiguation chain-completeness check called out in Task 3 Step 3.
- **Placeholder scan:** no TBDs; Task 1 points to the full file (268 lines) rather than inlining content, matching the already-accepted approach from prior books' plans. Task 2/3 explicitly handle the possible zero-findings case, and Task 3 Step 2 explicitly handles the sandboxed-network fallback observed in 1 Samuel's audit.
- **Type consistency:** N/A — this plan produces documentation and a standalone script, not a shared codebase interface.
