# Numbers Data Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every person and Numbers-native relationship in `scripts/seed-numbers.ts` against the actual Numbers text (ESV, fetched live), producing a findings document, then correct the live database to match — third of the planned per-book audit series.

**Architecture:** Single audit pass (28 people, comparable to Exodus), followed by a dry-run-safe correction script (same pattern as `scripts/fix-genesis-audit.ts`/`scripts/fix-exodus-audit.ts`, already reviewed and proven twice), followed by post-correction verification.

**Tech Stack:** TypeScript, `tsx`, `@libsql/client` (Turso) for the correction script. WebFetch/WebSearch for source-text verification. No test framework (none exists in this project).

## Global Constraints

- **Source of truth:** ESV, fetched live via WebFetch/WebSearch for every claim checked — not recalled from memory.
- **In scope:** every person in `scripts/seed-numbers.ts`, and every relationship where **both** people originate in Numbers.
- **Out of scope:** relationships crossing into Genesis/Exodus-seeded people; Leviticus entirely (no seed script exists for it in this repo — deferred to a future, differently-scoped effort); any book other than Numbers.
- **Findings categories:** exactly one of `Incorrect`, `Missing`, `Unsupported`, `Structural gap` per finding — never a compound value.
- **Priority:** genealogical/family chain completeness — specifically trace the Levitical clan heads' connection to Levi/Kohath, and Korah's rebellion's family (Korah, Dathan, Abiram, On, and their fathers).
- **Coverage counts:** the required top-line summary (people/relationships/refs) must be independently grep-verifiable — every prior book's audit initially miscounted at least one of these and had to be corrected after review. Actually grep-count, don't estimate.
- **Nothing gets written to the live database until Task 2** — Task 1 is pure research/documentation, producing markdown only.

---

### Task 1: Audit Numbers's People & Relationships

**Files:**
- Read: `scripts/seed-numbers.ts` lines 99-246 (people: twelve tribal princes, Levitical clan heads, Korah's rebellion, Balaam narrative, Peor incident, Zelophehad and his daughters — read this range directly for exact current field values)
- Read: `scripts/seed-numbers.ts` lines 248-298 (relationships)
- Read: `scripts/seed-numbers.ts` lines 300-365 (scripture refs)
- Create: `docs/superpowers/specs/2026-07-16-numbers-data-audit-findings.md`

**Interfaces:**
- Produces: a findings markdown file Task 2 reads to write the correction script.

- [ ] **Step 1: Enumerate**

Read `scripts/seed-numbers.ts` lines 99-246 in full. List every person (`key`, `name`, `alsoKnownAs`, `gender`, `description`, `tags`). Then read lines 248-298 for every relationship, and lines 300-365 for every scripture ref.

- [ ] **Step 2: Fetch source text**

Use WebFetch/WebSearch to retrieve the ESV text of Numbers 1-2 and 7 (the twelve tribal princes, one per tribe), 3-4 (Levitical clan heads — Gershon, Kohath, Merari and their sons), 16-17 (Korah's rebellion — Korah, Dathan, Abiram, On, their fathers), 22-24 (Balaam and Balak), 25 (the Peor incident — Phinehas, Zimri, Cozbi), and 26-27/36 (Zelophehad and his five daughters). Do not answer from memory.

- [ ] **Step 3: Cross-reference and trace chains**

For each person: verify name, alternate names, gender, and that the description doesn't contradict the text. For each relationship: verify it's textually supported and correctly typed. Specifically trace the Levitical clan heads (Gershon/Kohath/Merari and their listed sons, Numbers 3:17-20) back to Levi, and Korah's rebellion's family connections (Korah's father Izhar, Dathan/Abiram's father Eliab, per Numbers 16:1) end-to-end in the current DB data, noting any missing intermediate names.

- [ ] **Step 4: Write findings**

Create `docs/superpowers/specs/2026-07-16-numbers-data-audit-findings.md`, one entry per finding:

```markdown
## Finding N: <short description>
- **Category:** Incorrect | Missing | Unsupported | Structural gap
- **Verse(s):** <citation>
- **Current DB state:** <what's there now — key, field, or relationship>
- **Proposed correction:** <exact new value or exact new/removed relationship>
- **Severity:** Critical | Important | Minor
```

Only write findings for actual discrepancies. At the top of the file, add: `Reviewed: <N> people, <M> relationships, <K> refs. <F> findings.` — grep-count `N`/`M`/`K` yourself against the actual file ranges above before writing this line. If you notice something worth flagging but are unsure it clears the "actual discrepancy" bar, include it anyway with your reasoning — a prior book's audit initially declined to file a real, ultimately-confirmed finding this way, and it's better to include a borderline observation for the controller to judge than to silently omit it.

- [ ] **Step 5: Triple-check**

Re-verify every finding against the actual fetched text once more. Then do a second full read-through of the findings list checking for contradictions.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-07-16-numbers-data-audit-findings.md
git commit -m "$(cat <<'EOF'
docs: add Numbers data audit findings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Write the Correction Script and Run a Dry-Run Only

**Files:**
- Read: `docs/superpowers/specs/2026-07-16-numbers-data-audit-findings.md` (Task 1's output)
- Read: `scripts/fix-exodus-audit.ts` (for the exact DB access + dry-run pattern to reuse verbatim)
- Create: `scripts/fix-numbers-audit.ts`

**Interfaces:** None — standalone script.

This task stops after the dry-run. Do NOT execute the script for real or commit — that happens only after controller review, as a separate follow-up.

- [ ] **Step 1: Write the script**

Create `scripts/fix-numbers-audit.ts` following `scripts/fix-exodus-audit.ts`'s exact pattern (same imports, same `.env.local` loading, same `DRY_RUN` gate, same fail-loud `resolveExisting`/`resolveRelationship` helpers). For each finding in the findings document, implement it as `INSERT OR IGNORE` (new person/relationship/ref), `UPDATE` (wrong field), or `DELETE` (unsupported relationship/person), with a comment directly above each statement citing which finding it implements.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Run the dry-run and report the output**

Run: `npx tsx scripts/fix-numbers-audit.ts --dry-run`
Report the full output. If any `resolveExisting`/`resolveRelationship` call throws, STOP and report BLOCKED with the exact error rather than guessing at a fix.

**Do not proceed past this step without controller review.** Report the full dry-run output and stop.

---

### Task 3: Live Execution and Post-Correction Verification

**Files:** `scripts/fix-numbers-audit.ts` (run, not modified further unless Task 2's dry-run needed a fix first)

**Interfaces:**
- Consumes: the reviewed, approved script from Task 2.

This task only starts once Task 2's dry-run has been reviewed and approved.

- [ ] **Step 1: Run the script for real**

Run: `npx tsx scripts/fix-numbers-audit.ts`
Expected: matches the dry-run's statement count, no errors.

- [ ] **Step 2: Verify live via the API**

Start the dev server (pick a free port among 3000-3004), log in with the passcode from `.env.local` (`ADMIN_PASSCODE`), pull `/api/people` and `/api/relationships` with the authenticated session cookie, and confirm the specific corrections from the findings document are actually present. Stop the dev server when done; delete any scratch cookie/JSON files.

- [ ] **Step 3: Check for curated-family overlap**

None of the 9 curated families in `lib/families.ts` are currently Numbers-sourced (Adam's, Noah's, Abraham's, Isaac's, Jacob's, Joseph's, Moses', David's, Jesus' Family — all from Genesis, Exodus, or the NT). Confirm this is still true by reading `lib/families.ts`'s member lists and checking whether any Numbers-audited person (e.g. a tribal prince, a Levitical clan head, Korah, Balaam, Phinehas, Zelophehad's daughters) appears in any family's roster. If none do, note this in the commit message and skip the `buildForest` chain-completeness check (there's no curated family to check). If one does, run the same `buildForest`/`resolveFamilyMembers` chain-completeness check used in the Genesis and Exodus audits' final verification step for that family.

- [ ] **Step 4: Commit**

```bash
git add scripts/fix-numbers-audit.ts
git commit -m "$(cat <<'EOF'
fix: apply Numbers data audit corrections to live database

Implements every finding from
docs/superpowers/specs/2026-07-16-numbers-data-audit-findings.md
against the live Turso database. Controller reviewed the dry-run
output and script source before live execution, then independently
verified the result against a fresh live data pull.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Self-Review Notes

- **Spec coverage:** enumeration + cross-referencing + findings (Task 1), correction script with dry-run safety (Task 2), live execution + verification (Task 3) — every section of the design spec has a task. The spec's explicit Leviticus exclusion is reflected in the Global Constraints, not a separate task (there's nothing to build for an explicit non-goal).
- **Placeholder scan:** no TBDs; Task 1 points to exact line ranges rather than inlining content, matching the already-accepted approach from the Genesis and Exodus plans.
- **Type consistency:** N/A — this plan produces documentation and a standalone script, not a shared codebase interface.
