# NT Ministry Data Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every person, relationship, and scripture ref in `scripts/seed-nt-ministry.ts` against the actual biblical text (ESV, fetched live), producing a findings document, then correct the live database to match — twenty-fourth of the planned per-book audit series.

**Architecture:** Single audit pass (21 new people, second-largest narrative file after Prophets), followed by a dry-run-safe correction script (same pattern as `scripts/fix-nt-birth-audit.ts`), followed by post-correction verification.

**Tech Stack:** TypeScript, `tsx`, `@libsql/client` (Turso) for the correction script. WebFetch/WebSearch for source-text verification. No test framework (none exists in this project).

## Global Constraints

- **Source of truth:** ESV, fetched live via WebFetch/WebSearch — not recalled from memory. This file's density of direct quotations makes exact wording the primary risk area.
- **In scope:** all 21 new people, all 26 relationships (10 `insertRel` + 15 `insertRelByName` + 1 `insertRelNameToLocal`), all 34 refs in `scripts/seed-nt-ministry.ts`.
- **Out of scope:** re-auditing Jesus's own person record (originating in `seed-nt-birth.ts`); any book/file other than this file's scope.
- **Findings categories:** exactly one of `Incorrect`, `Missing`, `Unsupported`, `Structural gap` per finding.
- **Priority:** (a) every direct quotation's exact ESV wording, including front-truncation that misrepresents where quoted speech begins, (b) parenthetical translation glosses against the ESV's own rendering, (c) every disambiguation/epithet hedge — verse-confirm, (d) all 34 refs' ranges.
- **Coverage counts:** grep-count yourself. Expected: 21 people, 26 relationships (10 `insertRel` + 15 `insertRelByName` + 1 `insertRelNameToLocal`), 34 refs.
- **Nothing gets written to the live database until Task 2.**
- **Prefer direct `@libsql/client` verification scripts over the dev-server API route** for Task 3.
- **Curated-family check:** a scan of `lib/families.ts` found none of this file's 21 people in any curated family — Task 3's family check should confirm this remains true rather than skip it outright, in case a finding somehow changes that.

---

### Task 1: Audit NT Ministry's People, Relationships & Refs

**Files:**
- Read: `scripts/seed-nt-ministry.ts` (full file, 299 lines)
- Create: `docs/superpowers/specs/2026-07-25-nt-ministry-data-audit-findings.md`

- [ ] **Step 1: Enumerate** — Read the full file. List all 21 people, all 26 relationships, all 34 refs.
- [ ] **Step 2: Fetch source text** — Use WebFetch/WebSearch to retrieve every ESV passage listed in the design spec's Methodology section 2. Do not answer from memory, especially for direct quotations.
- [ ] **Step 3: Cross-reference** — For each person, verify every direct quotation word-for-word, every translation gloss, every disambiguation hedge. For each relationship and ref, verify textual support and chapter:verse accuracy.
- [ ] **Step 4: Write findings**

Create `docs/superpowers/specs/2026-07-25-nt-ministry-data-audit-findings.md`, one entry per finding:

```markdown
## Finding N: <short description>
- **Category:** Incorrect | Missing | Unsupported | Structural gap
- **Verse(s):** <citation>
- **Current DB state:** <what's there now>
- **Proposed correction:** <exact new value>
- **Severity:** Critical | Important | Minor
```

At the top: `Reviewed: <N> people, <M> relationships, <K> refs. <F> findings.` — grep-count yourself.

- [ ] **Step 5: Triple-check** — Re-verify every finding once more; second full read-through for contradictions.
- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-07-25-nt-ministry-data-audit-findings.md
git commit -m "$(cat <<'EOF'
docs: add NT ministry data audit findings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Write the Correction Script and Run a Dry-Run Only

**Files:**
- Read: `docs/superpowers/specs/2026-07-25-nt-ministry-data-audit-findings.md`
- Read: `scripts/fix-nt-birth-audit.ts` (for the exact DB access + dry-run pattern to reuse verbatim)
- Create: `scripts/fix-nt-ministry-audit.ts`

This task stops after the dry-run. Do NOT execute for real or commit — controller review happens as a separate follow-up.

- [ ] **Step 1: Write the script** — follow `scripts/fix-nt-birth-audit.ts`'s exact pattern.
- [ ] **Step 2: Typecheck** — `npx tsc --noEmit`, expect no output.
- [ ] **Step 3: Run the dry-run and report the output** — `npx tsx scripts/fix-nt-ministry-audit.ts --dry-run`. If any resolver throws, STOP and report BLOCKED.

**Do not proceed past this step without controller review.**

---

### Task 3: Live Execution and Post-Correction Verification

- [ ] **Step 1: Run the script for real** — expect matching statement count, no errors.
- [ ] **Step 2: Verify live via a direct DB query script** — confirm corrections landed, delete scratch script when done.
- [ ] **Step 3: Run the curated-family check** — confirm none of the 21 new people appear in any `lib/families.ts` roster (expected, per the design spec's pre-scan).
- [ ] **Step 4: Commit**

```bash
git add scripts/fix-nt-ministry-audit.ts
git commit -m "$(cat <<'EOF'
fix: apply NT ministry data audit corrections to live database

Implements every finding from
docs/superpowers/specs/2026-07-25-nt-ministry-data-audit-findings.md
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
