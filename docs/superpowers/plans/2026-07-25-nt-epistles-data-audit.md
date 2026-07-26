# NT Epistles Data Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every person, relationship, and scripture ref in `scripts/seed-nt-epistles.ts` against the actual biblical text (ESV, fetched live), producing a findings document, then correct the live database to match — twenty-ninth of the planned per-book audit series, and the largest file audited so far by people count.

**Architecture:** Single audit pass (28 new people), followed by a dry-run-safe correction script (same pattern as `scripts/fix-romans16-audit.ts`), followed by post-correction verification.

**Tech Stack:** TypeScript, `tsx`, `@libsql/client` (Turso) for the correction script. WebFetch/WebSearch for source-text verification. No test framework (none exists in this project).

## Global Constraints

- **Source of truth:** ESV, fetched live via WebFetch/WebSearch — not recalled from memory. This file shares source verses with the already-audited `seed-romans16.ts`, where a systemic NIV-vs-ESV mismatch was found — treat every quote here as equally suspect.
- **In scope:** all 28 new people, all 27 relationships (26 `insertRel` + 1 `insertRelNameToLocal`), all 36 refs in `scripts/seed-nt-epistles.ts`.
- **Out of scope:** re-auditing Paul's, Timothy's, James the brother of Jesus's, John the Apostle's, or Peter's own person records; any book/file other than this file's scope.
- **Findings categories:** exactly one of `Incorrect`, `Missing`, `Unsupported`, `Structural gap` per finding.
- **Priority:** (a) Andronicus's/Junia's "outstanding among the apostles" vs. ESV's actual "well known to the apostles" (Rom 16:7) — a significant, well-known translation crux; fix the quote in all 4 locations (2 descriptions + 2 ref notes) while treating the "apostle" tag/interpretation as a separate judgment call for the controller, (b) Phoebe's "benefactor"/"patron" (Rom 16:1-2), (c) Euodia's/Syntyche's "contended at his side"/"labored side by side" (Phil 4:2-3), (d) Epaphras's "dear"/"beloved" and "agonizing"/"struggling" (Col 1:7, 4:12-13), (e) Demas's "having loved"/"in love with" (2 Tim 4:10, in both his description and ref note), (f) every other quotation's exact wording, (g) all 36 refs' ranges.
- **Coverage counts:** grep-count yourself. Expected: 28 people, 27 relationships, 36 refs.
- **Nothing gets written to the live database until Task 2.**
- **Prefer direct `@libsql/client` verification scripts over the dev-server API route** for Task 3.
- **Curated-family check:** a scan of `lib/families.ts` found none of this file's 28 people in any curated family — Task 3's family check should confirm this remains true.

---

### Task 1: Audit NT Epistles' People, Relationships & Refs

**Files:**
- Read: `scripts/seed-nt-epistles.ts` (full file, 463 lines)
- Create: `docs/superpowers/specs/2026-07-25-nt-epistles-data-audit-findings.md`

- [ ] **Step 1: Enumerate** — Read the full file. List all 28 people, all 27 relationships, all 36 refs.
- [ ] **Step 2: Fetch source text** — Use WebFetch/WebSearch to retrieve every ESV passage listed in the design spec's Methodology section 2, especially Romans 16:7's exact wording and the Colossians/2 Timothy passages for Epaphras and Demas. Do not answer from memory.
- [ ] **Step 3: Cross-reference** — For each person, verify every direct quotation word-for-word against the ESV, including quotes that also appear duplicated in a relationship note or scripture_refs note (fix must cover every location, not just the person's own description).
- [ ] **Step 4: Write findings**

Create `docs/superpowers/specs/2026-07-25-nt-epistles-data-audit-findings.md`, one entry per finding:

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
git add docs/superpowers/specs/2026-07-25-nt-epistles-data-audit-findings.md
git commit -m "$(cat <<'EOF'
docs: add NT epistles data audit findings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Write the Correction Script and Run a Dry-Run Only

**Files:**
- Read: `docs/superpowers/specs/2026-07-25-nt-epistles-data-audit-findings.md`
- Read: `scripts/fix-romans16-audit.ts` (for the exact DB access + dry-run pattern to reuse verbatim)
- Create: `scripts/fix-nt-epistles-audit.ts`

This task stops after the dry-run. Do NOT execute for real or commit — controller review happens as a separate follow-up.

- [ ] **Step 1: Write the script** — follow `scripts/fix-romans16-audit.ts`'s exact pattern; use `resolveScriptureRef` (per `scripts/fix-isaiah-audit.ts`'s established version) for the Andronicus/Junia/Demas ref-note corrections.
- [ ] **Step 2: Typecheck** — `npx tsc --noEmit`, expect no output.
- [ ] **Step 3: Run the dry-run and report the output** — `npx tsx scripts/fix-nt-epistles-audit.ts --dry-run`. If any resolver throws, STOP and report BLOCKED.

**Do not proceed past this step without controller review.**

---

### Task 3: Live Execution and Post-Correction Verification

- [ ] **Step 1: Run the script for real** — expect matching statement count, no errors.
- [ ] **Step 2: Verify live via a direct DB query script** — confirm corrections landed, delete scratch script when done.
- [ ] **Step 3: Run the curated-family check** — confirm none of the 28 new people appear in any `lib/families.ts` roster.
- [ ] **Step 4: Commit**

```bash
git add scripts/fix-nt-epistles-audit.ts
git commit -m "$(cat <<'EOF'
fix: apply NT epistles data audit corrections to live database

Implements every finding from
docs/superpowers/specs/2026-07-25-nt-epistles-data-audit-findings.md
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
