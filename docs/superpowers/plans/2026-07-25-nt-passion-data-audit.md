# NT Passion Data Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every person, relationship, and scripture ref in `scripts/seed-nt-passion.ts` against the actual biblical text (ESV, fetched live), producing a findings document, then correct the live database to match — twenty-fifth of the planned per-book audit series.

**Architecture:** Single audit pass (10 new people), followed by a dry-run-safe correction script (same pattern as `scripts/fix-nt-ministry-audit.ts`), followed by post-correction verification.

**Tech Stack:** TypeScript, `tsx`, `@libsql/client` (Turso) for the correction script. WebFetch/WebSearch for source-text verification. No test framework (none exists in this project).

## Global Constraints

- **Source of truth:** ESV, fetched live via WebFetch/WebSearch — not recalled from memory. Where the ESV's primary text differs from a well-known alternate translation (e.g. the "Hebrew"/"Aramaic" choice at John 19:20), match the ESV's primary text, not the footnote or another translation's wording.
- **In scope:** all 10 new people, all 17 relationships (4 `insertRel` + 10 `insertRelByName` + 1 `insertRelLocalToAka` + 2 `insertRelNameToLocal`), all 17 refs in `scripts/seed-nt-passion.ts`.
- **Out of scope:** re-auditing Jesus's, John the Baptist's, Peter's, James son of Zebedee's, Nicodemus's, or Herod the Great's own person records; any book/file other than this file's scope.
- **Findings categories:** exactly one of `Incorrect`, `Missing`, `Unsupported`, `Structural gap` per finding.
- **Priority:** (a) every direct quotation's exact ESV wording, (b) the cross inscription's language list against ESV John 19:20's primary text, (c) Acts 12:23's exact wording, (d) every disambiguation hedge — verse/grep-confirm, (e) all 17 refs' ranges.
- **Coverage counts:** grep-count yourself. Expected: 10 people, 17 relationships, 17 refs.
- **Nothing gets written to the live database until Task 2.**
- **Prefer direct `@libsql/client` verification scripts over the dev-server API route** for Task 3.
- **Curated-family check:** a scan of `lib/families.ts` found none of this file's 10 people in any curated family — Task 3's family check should confirm this remains true.

---

### Task 1: Audit NT Passion's People, Relationships & Refs

**Files:**
- Read: `scripts/seed-nt-passion.ts` (full file, 228 lines)
- Create: `docs/superpowers/specs/2026-07-25-nt-passion-data-audit-findings.md`

- [ ] **Step 1: Enumerate** — Read the full file. List all 10 people, all 17 relationships, all 17 refs.
- [ ] **Step 2: Fetch source text** — Use WebFetch/WebSearch to retrieve every ESV passage listed in the design spec's Methodology section 2, including John 19:19-20's exact language list and any footnote. Do not answer from memory.
- [ ] **Step 3: Cross-reference** — For each person, verify every direct quotation word-for-word, the cross-inscription language list, and every disambiguation hedge. For each relationship and ref, verify textual support and chapter:verse accuracy.
- [ ] **Step 4: Write findings**

Create `docs/superpowers/specs/2026-07-25-nt-passion-data-audit-findings.md`, one entry per finding:

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
git add docs/superpowers/specs/2026-07-25-nt-passion-data-audit-findings.md
git commit -m "$(cat <<'EOF'
docs: add NT passion data audit findings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Write the Correction Script and Run a Dry-Run Only

**Files:**
- Read: `docs/superpowers/specs/2026-07-25-nt-passion-data-audit-findings.md`
- Read: `scripts/fix-nt-ministry-audit.ts` (for the exact DB access + dry-run pattern to reuse verbatim)
- Create: `scripts/fix-nt-passion-audit.ts`

This task stops after the dry-run. Do NOT execute for real or commit — controller review happens as a separate follow-up.

- [ ] **Step 1: Write the script** — follow `scripts/fix-nt-ministry-audit.ts`'s exact pattern.
- [ ] **Step 2: Typecheck** — `npx tsc --noEmit`, expect no output.
- [ ] **Step 3: Run the dry-run and report the output** — `npx tsx scripts/fix-nt-passion-audit.ts --dry-run`. If any resolver throws, STOP and report BLOCKED.

**Do not proceed past this step without controller review.**

---

### Task 3: Live Execution and Post-Correction Verification

- [ ] **Step 1: Run the script for real** — expect matching statement count, no errors.
- [ ] **Step 2: Verify live via a direct DB query script** — confirm corrections landed, delete scratch script when done.
- [ ] **Step 3: Run the curated-family check** — confirm none of the 10 new people appear in any `lib/families.ts` roster.
- [ ] **Step 4: Commit**

```bash
git add scripts/fix-nt-passion-audit.ts
git commit -m "$(cat <<'EOF'
fix: apply NT passion data audit corrections to live database

Implements every finding from
docs/superpowers/specs/2026-07-25-nt-passion-data-audit-findings.md
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
