# Joshua Data Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every person, relationship, and scripture ref in `scripts/seed-joshua.ts` against the actual Joshua text (ESV, fetched live), producing a findings document, then correct the live database to match — fifth of the planned per-book audit series.

**Architecture:** Single audit pass (9 new people), followed by a dry-run-safe correction script (same pattern as `scripts/fix-deuteronomy-audit.ts`, already reviewed and proven four times), followed by post-correction verification.

**Tech Stack:** TypeScript, `tsx`, `@libsql/client` (Turso) for the correction script. WebFetch/WebSearch for source-text verification. No test framework (none exists in this project).

## Global Constraints

- **Source of truth:** ESV, fetched live via WebFetch/WebSearch for every claim checked — not recalled from memory.
- **In scope:** all 9 new people (Rahab, Achan, Achsah, Adoni-zedek, Hoham, Piram, Japhia, Debir), all 9 relationships, and all 15 scripture refs in `scripts/seed-joshua.ts` — including the refs attached to pre-existing people (Joshua, Caleb, Eleazar, Phinehas), since the refs themselves are native to this file.
- **Out of scope:** re-auditing Joshua/Caleb/Eleazar/Phinehas's own person records (name, description, other relationships — owned by their originating books); seeding new Ruth/Matthew-lineage content for Rahab's marriage to Salmon or Achan's ancestry beyond what this file already attempts to model, unless the file's own existing content asserts something the DB can't support; any book other than Joshua.
- **Findings categories:** exactly one of `Incorrect`, `Missing`, `Unsupported`, `Structural gap` per finding — never a compound value.
- **Priority:** (a) the five kings' titles/cities and coalition structure match Josh 10:3 precisely, (b) Achan's ancestry description is consistent with the single `Judah ancestor_of achan` relationship actually modeled (the same structural-gap pattern flagged in prior books), (c) Rahab's description's claims (marriage to Salmon, mother of Boaz) are reconcilable with the rest of the DB — check whether `salmon`/`boaz` person records already exist and whether any relationship connects them to Rahab, (d) all 15 refs' chapter:verse ranges and note text are accurate.
- **Coverage counts:** the required top-line summary (people/relationships/refs) must be independently grep-verifiable — every prior book's audit initially miscounted at least one of these. Actually grep-count, don't estimate.
- **Nothing gets written to the live database until Task 2** — Task 1 is pure research/documentation, producing markdown only.

---

### Task 1: Audit Joshua's People, Relationships & Refs

**Files:**
- Read: `scripts/seed-joshua.ts` (full file, 219 lines)
- Read: `scripts/seed-genesis.ts`, `scripts/seed-numbers.ts`, `scripts/seed-exodus.ts` as needed to check whether `salmon`, `boaz`, `carmi`, `zabdi`/`zimri`, or `othniel` already exist as person records (grep `key:` declarations across `scripts/seed-*.ts` rather than reading each file fully)
- Create: `docs/superpowers/specs/2026-07-17-joshua-data-audit-findings.md`

**Interfaces:**
- Produces: a findings markdown file Task 2 reads to write the correction script.

- [ ] **Step 1: Enumerate**

Read `scripts/seed-joshua.ts` in full. List all 9 people (`key`, `name`, `alsoKnownAs`, `gender`, `description`, `tags`), all 9 relationships, and all 15 scripture refs (including the 8 attached to `joshua_ex`/`caleb_ex`/`eleazar_ex`/`phinehas_ex` via `loadExisting`).

- [ ] **Step 2: Fetch source text**

Use WebFetch/WebSearch to retrieve the ESV text of Joshua 2 (Rahab), 6:17-25 (Jericho's fall), 7 (Achan), 10 (the five-king coalition, Gibeon, Makkedah), 14-15 (Caleb, Achsah, Othniel), 19-21 (Eleazar, land allotment, Levitical cities), 22 (Phinehas and the Transjordanian altar), and 23-24 (Joshua's farewell, Shechem). Do not answer from memory.

- [ ] **Step 3: Cross-reference**

For each of the 9 people: verify name, alternate names, gender, and that the description doesn't contradict the text — with special attention to the five kings' cities/titles against Josh 10:3, and Achan's stated ancestry ("son of Carmi, of the clan of Zabdi... tribe of Judah," Josh 7:1) against what the file's single `Judah ancestor_of achan` relationship actually models. For Rahab: grep `scripts/seed-*.ts` for existing `salmon`/`boaz` person records; if either exists, check whether any relationship connects them to Rahab, and flag a finding only if the description's genealogical claim is left entirely unsupported by any relationship (the same structural-gap pattern used in Genesis/Exodus/Numbers, not a mandate to seed new Salmon/Boaz content if neither exists). For each relationship: verify it's textually supported and correctly typed. For each of the 15 refs: verify the chapter:verse range is correct and the note text accurately summarizes what's in that passage.

- [ ] **Step 4: Write findings**

Create `docs/superpowers/specs/2026-07-17-joshua-data-audit-findings.md`, one entry per finding:

```markdown
## Finding N: <short description>
- **Category:** Incorrect | Missing | Unsupported | Structural gap
- **Verse(s):** <citation>
- **Current DB state:** <what's there now — key, field, or relationship>
- **Proposed correction:** <exact new value or exact new/removed relationship>
- **Severity:** Critical | Important | Minor
```

Only write findings for actual discrepancies. At the top of the file, add: `Reviewed: <N> people, <M> relationships, <K> refs. <F> findings.` — grep-count `N`/`M`/`K` yourself against the actual file before writing this line. If you notice something worth flagging but are unsure it clears the "actual discrepancy" bar, include it anyway with your reasoning — prior books' audits initially declined real findings this way, and it's better to include a borderline observation for the controller to judge than to silently omit it. A low- or zero-finding outcome is plausible and acceptable if the text genuinely supports everything in the file — don't invent findings to fill space.

- [ ] **Step 5: Triple-check**

Re-verify every finding against the actual fetched text once more. Then do a second full read-through of the findings list checking for contradictions.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-07-17-joshua-data-audit-findings.md
git commit -m "$(cat <<'EOF'
docs: add Joshua data audit findings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Write the Correction Script and Run a Dry-Run Only

**Files:**
- Read: `docs/superpowers/specs/2026-07-17-joshua-data-audit-findings.md` (Task 1's output)
- Read: `scripts/fix-deuteronomy-audit.ts` (for the exact DB access + dry-run pattern to reuse verbatim)
- Create: `scripts/fix-joshua-audit.ts`

**Interfaces:** None — standalone script.

This task stops after the dry-run. Do NOT execute the script for real or commit — that happens only after controller review, as a separate follow-up.

- [ ] **Step 1: Write the script**

Create `scripts/fix-joshua-audit.ts` following `scripts/fix-deuteronomy-audit.ts`'s exact pattern (same imports, same `.env.local` loading, same `DRY_RUN` gate, same fail-loud `resolveExisting`/`resolveRelationship` helpers). For each finding in the findings document, implement it as `INSERT OR IGNORE` (new person/relationship/ref), `UPDATE` (wrong field), or `DELETE` (unsupported relationship/ref), with a comment directly above each statement citing which finding it implements. If the findings document has zero findings, the script only needs to report "no corrections needed" and exit cleanly — do not invent statements to implement.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Run the dry-run and report the output**

Run: `npx tsx scripts/fix-joshua-audit.ts --dry-run`
Report the full output. If any `resolveExisting`/`resolveRelationship` call throws, STOP and report BLOCKED with the exact error rather than guessing at a fix.

**Do not proceed past this step without controller review.** Report the full dry-run output and stop.

---

### Task 3: Live Execution and Post-Correction Verification

**Files:** `scripts/fix-joshua-audit.ts` (run, not modified further unless Task 2's dry-run needed a fix first)

**Interfaces:**
- Consumes: the reviewed, approved script from Task 2.

This task only starts once Task 2's dry-run has been reviewed and approved. If Task 1 found zero findings, this task still runs the script (to confirm it reports "no corrections needed" cleanly) and still performs Step 3 below.

- [ ] **Step 1: Run the script for real**

Run: `npx tsx scripts/fix-joshua-audit.ts`
Expected: matches the dry-run's statement count, no errors.

- [ ] **Step 2: Verify live via the API**

Start the dev server (pick a free port among 3000-3004), log in with the passcode from `.env.local` (`ADMIN_PASSCODE`), pull `/api/people` and `/api/relationships` with the authenticated session cookie, and confirm the specific corrections from the findings document are actually present. Stop the dev server when done; delete any scratch cookie/JSON files.

- [ ] **Step 3: Check for curated-family overlap**

None of the 9 curated families in `lib/families.ts` are currently Joshua-sourced, but Achsah is Caleb's daughter and Caleb is referenced in at least one curated family — actually check this, don't assume. Read `lib/families.ts`'s member lists and confirm whether Rahab, Achan, Achsah, or any of the five kings appears in any curated family's roster. If none do, note this in the commit message and skip the `buildForest` chain-completeness check. If one does, run the same `buildForest`/`resolveFamilyMembers` chain-completeness check used in prior audits' final verification step for that family.

- [ ] **Step 4: Commit**

```bash
git add scripts/fix-joshua-audit.ts
git commit -m "$(cat <<'EOF'
fix: apply Joshua data audit corrections to live database

Implements every finding from
docs/superpowers/specs/2026-07-17-joshua-data-audit-findings.md
against the live Turso database. Controller reviewed the dry-run
output and script source before live execution, then independently
verified the result against a fresh live data pull.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Self-Review Notes

- **Spec coverage:** enumeration + cross-referencing + findings (Task 1), correction script with dry-run safety (Task 2), live execution + verification (Task 3) — every section of the design spec has a task. The spec's explicit out-of-scope items (re-auditing pre-existing people's own records, not inventing Ruth/Matthew-lineage or Achan-ancestry content) are reflected in the Global Constraints, not separate tasks.
- **Placeholder scan:** no TBDs; Task 1 points to the full file (219 lines) rather than inlining content, matching the already-accepted approach from prior books' plans. Task 2/3 explicitly handle the possible zero-findings case.
- **Type consistency:** N/A — this plan produces documentation and a standalone script, not a shared codebase interface.
