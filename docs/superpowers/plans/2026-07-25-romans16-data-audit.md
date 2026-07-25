# Romans 16 Data Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every person, relationship, and scripture ref in `scripts/seed-romans16.ts` against the actual biblical text (ESV, fetched live), producing a findings document, then correct the live database to match — twenty-eighth of the planned per-book audit series.

**Architecture:** Single audit pass (22 new people, near-entirely quote-driven descriptions), followed by a dry-run-safe correction script (same pattern as `scripts/fix-acts-audit.ts`), followed by post-correction verification.

**Tech Stack:** TypeScript, `tsx`, `@libsql/client` (Turso) for the correction script. WebFetch/WebSearch for source-text verification. No test framework (none exists in this project).

## Global Constraints

- **Source of truth:** ESV, fetched live via WebFetch/WebSearch — not recalled from memory. Treat every quoted phrase in this file as suspect: research uncovered a systemic pattern where this file's quotes resemble the NIV rather than the ESV.
- **In scope:** all 22 new people, all 26 relationships (25 `insertRel` + 1 `insertRelLocalToName`), all 24 refs in `scripts/seed-romans16.ts`.
- **Out of scope:** re-auditing Paul's or Rufus's own person records; Phoebe's, Priscilla's, Aquila's, Andronicus's, Junia's, Tertius's, or Gaius of Corinth's own records (covered in `scripts/seed-nt-epistles.ts`, not this file — confirmed by grep, not a gap here); any book/file other than this file's scope.
- **Findings categories:** exactly one of `Incorrect`, `Missing`, `Unsupported`, `Structural gap` per finding.
- **Priority:** (a) every direct quotation's exact ESV wording — verse-confirm every single one, not a sample, (b) whether Tryphena's/Tryphosa's "worked hard in the Lord" phrase is actually theirs or Persis's, (c) Erastus's title against Romans 16:23, (d) all 24 refs' ranges.
- **Coverage counts:** grep-count yourself. Expected: 22 people, 26 relationships, 24 refs.
- **Nothing gets written to the live database until Task 2.**
- **Prefer direct `@libsql/client` verification scripts over the dev-server API route** for Task 3.
- **Curated-family check:** a scan of `lib/families.ts` found none of this file's 22 people in any curated family — Task 3's family check should confirm this remains true.

---

### Task 1: Audit Romans 16's People, Relationships & Refs

**Files:**
- Read: `scripts/seed-romans16.ts` (full file, 376 lines)
- Create: `docs/superpowers/specs/2026-07-25-romans16-data-audit-findings.md`

- [ ] **Step 1: Enumerate** — Read the full file. List all 22 people, all 26 relationships, all 24 refs.
- [ ] **Step 2: Fetch source text** — Use WebFetch/WebSearch to retrieve the complete ESV text of Romans 16:1-16 and 16:21-23, verse by verse. Do not answer from memory.
- [ ] **Step 3: Cross-reference** — For every one of the 22 people, verify every direct quotation word-for-word against the ESV verse it cites — given the systemic pattern already discovered, check every quote, not a sample. Specifically confirm whether "worked hard in the Lord" belongs to Tryphena/Tryphosa or to Persis in the actual text.
- [ ] **Step 4: Write findings**

Create `docs/superpowers/specs/2026-07-25-romans16-data-audit-findings.md`, one entry per finding:

```markdown
## Finding N: <short description>
- **Category:** Incorrect | Missing | Unsupported | Structural gap
- **Verse(s):** <citation>
- **Current DB state:** <what's there now>
- **Proposed correction:** <exact new value>
- **Severity:** Critical | Important | Minor
```

At the top: `Reviewed: <N> people, <M> relationships, <K> refs. <F> findings.` — grep-count yourself.

- [ ] **Step 5: Triple-check** — Re-verify every finding once more; re-check every quoted phrase in the file a second time against the fetched ESV text.
- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-07-25-romans16-data-audit-findings.md
git commit -m "$(cat <<'EOF'
docs: add Romans 16 data audit findings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Write the Correction Script and Run a Dry-Run Only

**Files:**
- Read: `docs/superpowers/specs/2026-07-25-romans16-data-audit-findings.md`
- Read: `scripts/fix-acts-audit.ts` (for the exact DB access + dry-run pattern to reuse verbatim)
- Create: `scripts/fix-romans16-audit.ts`

This task stops after the dry-run. Do NOT execute for real or commit — controller review happens as a separate follow-up.

- [ ] **Step 1: Write the script** — follow `scripts/fix-acts-audit.ts`'s exact pattern.
- [ ] **Step 2: Typecheck** — `npx tsc --noEmit`, expect no output.
- [ ] **Step 3: Run the dry-run and report the output** — `npx tsx scripts/fix-romans16-audit.ts --dry-run`. If any resolver throws, STOP and report BLOCKED.

**Do not proceed past this step without controller review.**

---

### Task 3: Live Execution and Post-Correction Verification

- [ ] **Step 1: Run the script for real** — expect matching statement count, no errors.
- [ ] **Step 2: Verify live via a direct DB query script** — confirm corrections landed, delete scratch script when done.
- [ ] **Step 3: Run the curated-family check** — confirm none of the 22 new people appear in any `lib/families.ts` roster.
- [ ] **Step 4: Commit**

```bash
git add scripts/fix-romans16-audit.ts
git commit -m "$(cat <<'EOF'
fix: apply Romans 16 data audit corrections to live database

Implements every finding from
docs/superpowers/specs/2026-07-25-romans16-data-audit-findings.md
against the live Turso database. Controller reviewed the dry-run
output and script source before live execution, then independently
verified the result against a fresh live data pull, including a
curated-family roster check.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Self-Review Notes

- **Spec coverage:** enumeration + cross-referencing + findings (Task 1), correction script with dry-run safety (Task 2), live execution + verification (Task 3).
- **Placeholder scan:** no TBDs.
- **Type consistency:** N/A — documentation and standalone script.
