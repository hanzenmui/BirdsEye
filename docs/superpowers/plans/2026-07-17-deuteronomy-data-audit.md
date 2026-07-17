# Deuteronomy Data Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every person, relationship, and scripture ref in `scripts/seed-deuteronomy.ts` against the actual Deuteronomy text (ESV, fetched live), producing a findings document, then correct the live database to match — fourth of the planned per-book audit series.

**Architecture:** Single audit pass (2 people, far smaller than any prior book), followed by a dry-run-safe correction script (same pattern as `scripts/fix-numbers-audit.ts`, already reviewed and proven three times), followed by post-correction verification.

**Tech Stack:** TypeScript, `tsx`, `@libsql/client` (Turso) for the correction script. WebFetch/WebSearch for source-text verification. No test framework (none exists in this project).

## Global Constraints

- **Source of truth:** ESV, fetched live via WebFetch/WebSearch for every claim checked — not recalled from memory.
- **In scope:** both new people (Sihon, Og), all 4 relationships, and all 8 scripture refs in `scripts/seed-deuteronomy.ts` — including the refs attached to pre-existing people (Moses, Joshua, Caleb), since the refs themselves are native to this file.
- **Out of scope:** re-auditing Moses/Joshua/Caleb's own person records (name, description, other relationships — owned by their originating books); named figures Deuteronomy mentions only in passing that this file doesn't model (Balaam/Balak, the sons of Anak, Miriam, Aaron) unless this file's own existing content asserts something about them the DB can't support; any book other than Deuteronomy.
- **Findings categories:** exactly one of `Incorrect`, `Missing`, `Unsupported`, `Structural gap` per finding — never a compound value.
- **Priority:** (a) Sihon's and Og's descriptions match the text precisely (kingdom, defeat location, aftermath, Og's "iron bed" detail), (b) the `manasseh ruler_of og` relationship is textually supported as claimed (Deut 3:13), (c) the Moses/Joshua/Caleb refs' chapter:verse ranges and note text are accurate.
- **Coverage counts:** the required top-line summary (people/relationships/refs) must be independently grep-verifiable — every prior book's audit initially miscounted at least one of these. Actually grep-count, don't estimate.
- **Nothing gets written to the live database until Task 2** — Task 1 is pure research/documentation, producing markdown only.

---

### Task 1: Audit Deuteronomy's People, Relationships & Refs

**Files:**
- Read: `scripts/seed-deuteronomy.ts` (full file, 160 lines — small enough to read in one pass)
- Create: `docs/superpowers/specs/2026-07-17-deuteronomy-data-audit-findings.md`

**Interfaces:**
- Produces: a findings markdown file Task 2 reads to write the correction script.

- [ ] **Step 1: Enumerate**

Read `scripts/seed-deuteronomy.ts` in full. List both people (`key`, `name`, `alsoKnownAs`, `gender`, `description`, `tags`), all 4 relationships, and all 8 scripture refs (including the 4 attached to `moses`/`joshua`/`caleb` via `loadExisting`).

- [ ] **Step 2: Fetch source text**

Use WebFetch/WebSearch to retrieve the ESV text of Deuteronomy 1-3 (the farewell address opening, Joshua's commissioning, Caleb's exception, Sihon/Og), Deuteronomy 31 and 34 (Moses charges Joshua, God commissions Joshua, Moses's death and Joshua's filling with the spirit of wisdom), and Numbers 21:21-35 (the original Sihon/Og narrative this file's refs also cite). Do not answer from memory.

- [ ] **Step 3: Cross-reference**

For Sihon and Og: verify name, title/kingdom, description details (defeat location, aftermath, Og's iron bed measurement and its cited source) against the fetched text. For each relationship: verify it's textually supported and correctly typed — specifically check the `manasseh ruler_of og` relationship against Deut 3:13's actual wording. For each of the 8 scripture refs: verify the chapter:verse range is correct and the note text accurately summarizes what's actually in that passage.

- [ ] **Step 4: Write findings**

Create `docs/superpowers/specs/2026-07-17-deuteronomy-data-audit-findings.md`, one entry per finding:

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
git add docs/superpowers/specs/2026-07-17-deuteronomy-data-audit-findings.md
git commit -m "$(cat <<'EOF'
docs: add Deuteronomy data audit findings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Write the Correction Script and Run a Dry-Run Only

**Files:**
- Read: `docs/superpowers/specs/2026-07-17-deuteronomy-data-audit-findings.md` (Task 1's output)
- Read: `scripts/fix-numbers-audit.ts` (for the exact DB access + dry-run pattern to reuse verbatim)
- Create: `scripts/fix-deuteronomy-audit.ts`

**Interfaces:** None — standalone script.

This task stops after the dry-run. Do NOT execute the script for real or commit — that happens only after controller review, as a separate follow-up.

- [ ] **Step 1: Write the script**

Create `scripts/fix-deuteronomy-audit.ts` following `scripts/fix-numbers-audit.ts`'s exact pattern (same imports, same `.env.local` loading, same `DRY_RUN` gate, same fail-loud `resolveExisting`/`resolveRelationship` helpers). For each finding in the findings document, implement it as `INSERT OR IGNORE` (new person/relationship/ref), `UPDATE` (wrong field), or `DELETE` (unsupported relationship/ref), with a comment directly above each statement citing which finding it implements. If the findings document has zero findings, the script only needs to report "no corrections needed" and exit cleanly — do not invent statements to implement.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Run the dry-run and report the output**

Run: `npx tsx scripts/fix-deuteronomy-audit.ts --dry-run`
Report the full output. If any `resolveExisting`/`resolveRelationship` call throws, STOP and report BLOCKED with the exact error rather than guessing at a fix.

**Do not proceed past this step without controller review.** Report the full dry-run output and stop.

---

### Task 3: Live Execution and Post-Correction Verification

**Files:** `scripts/fix-deuteronomy-audit.ts` (run, not modified further unless Task 2's dry-run needed a fix first)

**Interfaces:**
- Consumes: the reviewed, approved script from Task 2.

This task only starts once Task 2's dry-run has been reviewed and approved. If Task 1 found zero findings, this task still runs the script (to confirm it reports "no corrections needed" cleanly) and still performs Step 3 below, but Steps 1-2 will have nothing to verify beyond a clean no-op run.

- [ ] **Step 1: Run the script for real**

Run: `npx tsx scripts/fix-deuteronomy-audit.ts`
Expected: matches the dry-run's statement count, no errors.

- [ ] **Step 2: Verify live via the API**

Start the dev server (pick a free port among 3000-3004), log in with the passcode from `.env.local` (`ADMIN_PASSCODE`), pull `/api/people` and `/api/relationships` with the authenticated session cookie, and confirm the specific corrections from the findings document are actually present. Stop the dev server when done; delete any scratch cookie/JSON files.

- [ ] **Step 3: Check for curated-family overlap**

None of the 9 curated families in `lib/families.ts` are currently Deuteronomy-sourced. Confirm this is still true by reading `lib/families.ts`'s member lists and checking whether Sihon, Og, or any Deuteronomy-audited correction touches a curated family's roster. If none do, note this in the commit message and skip the `buildForest` chain-completeness check. If one does, run the same `buildForest`/`resolveFamilyMembers` chain-completeness check used in prior audits' final verification step for that family.

- [ ] **Step 4: Commit**

```bash
git add scripts/fix-deuteronomy-audit.ts
git commit -m "$(cat <<'EOF'
fix: apply Deuteronomy data audit corrections to live database

Implements every finding from
docs/superpowers/specs/2026-07-17-deuteronomy-data-audit-findings.md
against the live Turso database. Controller reviewed the dry-run
output and script source before live execution, then independently
verified the result against a fresh live data pull.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Self-Review Notes

- **Spec coverage:** enumeration + cross-referencing + findings (Task 1), correction script with dry-run safety (Task 2), live execution + verification (Task 3) — every section of the design spec has a task. The spec's explicit out-of-scope items (re-auditing Moses/Joshua/Caleb's own records, seeding new people for passing mentions) are reflected in the Global Constraints, not separate tasks (nothing to build for a non-goal).
- **Placeholder scan:** no TBDs; Task 1 points to the full file (only 160 lines) rather than inlining content, matching the already-accepted approach from prior books' plans. Task 2/3 explicitly handle the possible zero-findings case rather than assuming findings will exist, since this book's tiny scope makes a clean audit plausible.
- **Type consistency:** N/A — this plan produces documentation and a standalone script, not a shared codebase interface.
