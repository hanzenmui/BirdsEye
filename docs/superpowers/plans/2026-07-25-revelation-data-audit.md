# Revelation Data Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every person, relationship, and scripture ref in `scripts/seed-revelation.ts` against the actual biblical text (ESV, fetched live), producing a findings document, then correct the live database to match — the thirtieth and final book in the per-book audit series.

**Architecture:** Single audit pass (3 new people, the smallest file in the series), followed by a dry-run-safe correction script (same pattern as `scripts/fix-nt-epistles-audit.ts`), followed by post-correction verification.

**Tech Stack:** TypeScript, `tsx`, `@libsql/client` (Turso) for the correction script. WebFetch/WebSearch for source-text verification. No test framework (none exists in this project).

## Global Constraints

- **Source of truth:** ESV, fetched live via WebFetch/WebSearch — not recalled from memory.
- **In scope:** all 3 new people, all 3 relationships, all 9 refs (7 on new people + 2 on the pre-existing John/Jesus) in `scripts/seed-revelation.ts`.
- **Out of scope:** re-auditing John's or Jesus's own person records; any book/file other than this file's scope.
- **Findings categories:** exactly one of `Incorrect`, `Missing`, `Unsupported`, `Structural gap` per finding.
- **Priority:** (a) Antipas's quotation against Rev 2:13, (b) Jezebel's "prophet"/"prophetess" against Rev 2:20 (both her description and her ref note), (c) the OT-Jezebel disambiguation — grep-confirm, (d) the seven churches' names/order against Rev 1:11, (e) John's closing quote against Rev 22:8, (f) all 9 refs' ranges.
- **Coverage counts:** grep-count yourself. Expected: 3 people, 3 relationships, 9 refs.
- **Nothing gets written to the live database until Task 2.**
- **Prefer direct `@libsql/client` verification scripts over the dev-server API route** for Task 3.
- **Curated-family check:** a scan of `lib/families.ts` found none of this file's 3 people in any curated family — Task 3's family check should confirm this remains true.

---

### Task 1: Audit Revelation's People, Relationships & Refs

**Files:**
- Read: `scripts/seed-revelation.ts` (full file, 163 lines)
- Create: `docs/superpowers/specs/2026-07-25-revelation-data-audit-findings.md`

- [ ] **Step 1: Enumerate** — Read the full file. List all 3 people, all 3 relationships, all 9 refs.
- [ ] **Step 2: Fetch source text** — Use WebFetch/WebSearch to retrieve the ESV text of Revelation 2:13, 2:20-25, 1:11, 22:8, 1:12-18, and 19:11-16. Do not answer from memory.
- [ ] **Step 3: Cross-reference** — Verify Antipas's and Jezebel's quotations word-for-word, the seven churches' names/order, John's closing quote, and every ref's chapter:verse accuracy. Grep-confirm the OT Jezebel disambiguation.
- [ ] **Step 4: Write findings**

Create `docs/superpowers/specs/2026-07-25-revelation-data-audit-findings.md`, one entry per finding:

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
git add docs/superpowers/specs/2026-07-25-revelation-data-audit-findings.md
git commit -m "$(cat <<'EOF'
docs: add Revelation data audit findings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Write the Correction Script and Run a Dry-Run Only

**Files:**
- Read: `docs/superpowers/specs/2026-07-25-revelation-data-audit-findings.md`
- Read: `scripts/fix-nt-epistles-audit.ts` (for the exact DB access + dry-run pattern to reuse verbatim)
- Create: `scripts/fix-revelation-audit.ts`

This task stops after the dry-run. Do NOT execute for real or commit — controller review happens as a separate follow-up.

- [ ] **Step 1: Write the script** — follow `scripts/fix-nt-epistles-audit.ts`'s exact pattern.
- [ ] **Step 2: Typecheck** — `npx tsc --noEmit`, expect no output.
- [ ] **Step 3: Run the dry-run and report the output** — `npx tsx scripts/fix-revelation-audit.ts --dry-run`. If any resolver throws, STOP and report BLOCKED.

**Do not proceed past this step without controller review.**

---

### Task 3: Live Execution and Post-Correction Verification

- [ ] **Step 1: Run the script for real** — expect matching statement count, no errors.
- [ ] **Step 2: Verify live via a direct DB query script** — confirm corrections landed, delete scratch script when done.
- [ ] **Step 3: Run the curated-family check** — confirm none of the 3 new people appear in any `lib/families.ts` roster.
- [ ] **Step 4: Commit**

```bash
git add scripts/fix-revelation-audit.ts
git commit -m "$(cat <<'EOF'
fix: apply Revelation data audit corrections to live database

Implements every finding from
docs/superpowers/specs/2026-07-25-revelation-data-audit-findings.md
against the live Turso database. Controller reviewed the dry-run
output and script source before live execution, then independently
verified the result against a fresh live data pull, including a
curated-family roster check. This is the final book in the
per-book data audit series (Genesis through Revelation).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Self-Review Notes

- **Spec coverage:** enumeration + cross-referencing + findings (Task 1), correction script with dry-run safety (Task 2), live execution + verification (Task 3).
- **Placeholder scan:** no TBDs.
- **Type consistency:** N/A — documentation and standalone script.
