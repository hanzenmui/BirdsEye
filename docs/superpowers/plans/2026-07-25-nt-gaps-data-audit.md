# NT Gaps Data Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every person, relationship, and scripture ref in `scripts/seed-nt-gaps.ts` against the actual biblical text (ESV, fetched live), producing a findings document, then correct the live database to match — twenty-sixth of the planned per-book audit series.

**Architecture:** Single audit pass (10 new people, 36 refs including 22 on pre-existing cross-seed people), followed by a dry-run-safe correction script (same pattern as `scripts/fix-nt-passion-audit.ts`), followed by post-correction verification.

**Tech Stack:** TypeScript, `tsx`, `@libsql/client` (Turso) for the correction script. WebFetch/WebSearch for source-text verification. No test framework (none exists in this project).

## Global Constraints

- **Source of truth:** ESV, fetched live via WebFetch/WebSearch — not recalled from memory. Watch specifically for near-miss wording (synonyms substituted for the ESV's actual word choice) since this file's descriptions are built almost entirely from short quoted phrases.
- **In scope:** all 10 new people, all 13 relationships, all 36 refs (14 on new people + 22 on pre-existing people) in `scripts/seed-nt-gaps.ts`.
- **Out of scope:** re-auditing Paul's, Timothy's, Silas's, Titus's, James the brother of Jesus's, Peter's, or John's own person records; any book/file other than this file's scope.
- **Findings categories:** exactly one of `Incorrect`, `Missing`, `Unsupported`, `Structural gap` per finding.
- **Priority:** (a) every direct quotation's exact ESV wording, (b) 2 Peter 1:1's "Simeon Peter" vs "Simon Peter" name-form, (c) whether Fortunatus's/Achaicus's refs cover the verse (1 Cor 16:18) that actually supports their "refreshed his spirit" description, (d) every hedge — verify accuracy, (e) all 36 refs' ranges.
- **Coverage counts:** grep-count yourself. Expected: 10 people, 13 relationships, 36 refs.
- **Nothing gets written to the live database until Task 2.**
- **Prefer direct `@libsql/client` verification scripts over the dev-server API route** for Task 3.
- **Curated-family check:** a scan of `lib/families.ts` found none of this file's 10 new people in any curated family — Task 3's family check should confirm this remains true.

---

### Task 1: Audit NT Gaps' People, Relationships & Refs

**Files:**
- Read: `scripts/seed-nt-gaps.ts` (full file, 324 lines)
- Create: `docs/superpowers/specs/2026-07-25-nt-gaps-data-audit-findings.md`

- [ ] **Step 1: Enumerate** — Read the full file. List all 10 people, all 13 relationships, all 36 refs.
- [ ] **Step 2: Fetch source text** — Use WebFetch/WebSearch to retrieve every ESV passage listed in the design spec's Methodology section 2, especially the exact wording at Eph 6:21/Col 4:7 (Tychicus), 2 Tim 4:14 (Alexander), 2 Pet 1:1 (name form), 2 John 1:1 ("elect"/"chosen"), 1 Pet 5:13 ("at"/"in" Babylon), and 1 Cor 16:17-18 (which verse mentions "refreshing"). Do not answer from memory.
- [ ] **Step 3: Cross-reference** — For each person, verify every direct quotation word-for-word against the ESV. For each relationship and ref, verify textual support and chapter:verse accuracy, specifically checking whether Fortunatus's/Achaicus's refs need to extend to v18.
- [ ] **Step 4: Write findings**

Create `docs/superpowers/specs/2026-07-25-nt-gaps-data-audit-findings.md`, one entry per finding:

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
git add docs/superpowers/specs/2026-07-25-nt-gaps-data-audit-findings.md
git commit -m "$(cat <<'EOF'
docs: add NT gaps data audit findings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Write the Correction Script and Run a Dry-Run Only

**Files:**
- Read: `docs/superpowers/specs/2026-07-25-nt-gaps-data-audit-findings.md`
- Read: `scripts/fix-nt-passion-audit.ts` (for the exact DB access + dry-run pattern to reuse verbatim, including `resolveScriptureRef` if needed for the Fortunatus/Achaicus ref-range fix)
- Create: `scripts/fix-nt-gaps-audit.ts`

This task stops after the dry-run. Do NOT execute for real or commit — controller review happens as a separate follow-up.

- [ ] **Step 1: Write the script** — follow `scripts/fix-nt-passion-audit.ts`'s exact pattern, adding a `resolveScriptureRef` helper (per `scripts/fix-isaiah-audit.ts`'s established version) if the Fortunatus/Achaicus ref-range finding requires it.
- [ ] **Step 2: Typecheck** — `npx tsc --noEmit`, expect no output.
- [ ] **Step 3: Run the dry-run and report the output** — `npx tsx scripts/fix-nt-gaps-audit.ts --dry-run`. If any resolver throws, STOP and report BLOCKED.

**Do not proceed past this step without controller review.**

---

### Task 3: Live Execution and Post-Correction Verification

- [ ] **Step 1: Run the script for real** — expect matching statement count, no errors.
- [ ] **Step 2: Verify live via a direct DB query script** — confirm corrections landed, delete scratch script when done.
- [ ] **Step 3: Run the curated-family check** — confirm none of the 10 new people appear in any `lib/families.ts` roster.
- [ ] **Step 4: Commit**

```bash
git add scripts/fix-nt-gaps-audit.ts
git commit -m "$(cat <<'EOF'
fix: apply NT gaps data audit corrections to live database

Implements every finding from
docs/superpowers/specs/2026-07-25-nt-gaps-data-audit-findings.md
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
