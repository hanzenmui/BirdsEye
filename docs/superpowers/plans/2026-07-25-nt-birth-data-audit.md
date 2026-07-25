# NT Birth Narrative Data Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every person, relationship, and scripture ref in `scripts/seed-nt-birth.ts` against the actual biblical text (ESV, fetched live), producing a findings document, then correct the live database to match — twenty-third of the planned per-book audit series.

**Architecture:** Single audit pass (9 new people), followed by a dry-run-safe correction script (same pattern as `scripts/fix-luke-lineage-audit.ts`), followed by post-correction verification.

**Tech Stack:** TypeScript, `tsx`, `@libsql/client` (Turso) for the correction script. WebFetch/WebSearch for source-text verification. No test framework (none exists in this project).

## Global Constraints

- **Source of truth:** ESV, fetched live via WebFetch/WebSearch — not recalled from memory. Where a description narrates an episode, check whether every detail (including names) is actually present in the cited Gospel text, since extra-biblical tradition (e.g. Josephus) is easy to conflate with scripture.
- **In scope:** all 9 new people, all 15 relationships (11 `insertRel` + 4 `insertRelByName`), all 18 refs in `scripts/seed-nt-birth.ts`.
- **Out of scope:** re-auditing David's, Abraham's, Zerubbabel's, or Boaz's own person records; any book/file other than this file's scope.
- **Findings categories:** exactly one of `Incorrect`, `Missing`, `Unsupported`, `Structural gap` per finding.
- **Priority:** (a) every direct quotation's exact ESV wording, including quiet truncation, (b) "Elijah who is to come" — verify it's Malachi 4:5's wording or Matthew 11:14's, (c) whether "Salome" appears in the Gospel accounts of John's beheading or is extra-biblical, (d) the Luke 1:36 kinship-word citation, (e) Anna's age/widowhood hedge, (f) every disambiguation hedge — grep-confirm, (g) all 18 refs' ranges.
- **Coverage counts:** grep-count yourself. Expected: 9 people, 15 relationships (11 grep-visible `insertRel` + 4 `insertRelByName`), 18 refs.
- **Nothing gets written to the live database until Task 2.**
- **Prefer direct `@libsql/client` verification scripts over the dev-server API route** for Task 3.

---

### Task 1: Audit NT Birth's People, Relationships & Refs

**Files:**
- Read: `scripts/seed-nt-birth.ts` (full file, 201 lines)
- Create: `docs/superpowers/specs/2026-07-25-nt-birth-data-audit-findings.md`

- [ ] **Step 1: Enumerate**

Read the full file. List all 9 people, all 15 relationships, all 18 refs.

- [ ] **Step 2: Fetch source text**

Use WebFetch/WebSearch to retrieve the ESV text of Luke 1 (full), Luke 2 (full), Matthew 1-2 (full), Matthew 11:14, Malachi 4:5, and Matthew 14:1-12 / Mark 6:14-29. Do not answer from memory, especially for direct quotations.

- [ ] **Step 3: Cross-reference**

For each of the 9 people: verify every direct quotation word-for-word against the ESV, check the "Elijah who is to come" attribution, check whether "Salome" is textually supported, verify Luke 1:36's kinship word, verify Anna's age hedge, grep-confirm every disambiguation hedge. For each of the 15 relationships and 18 refs: verify textual support and chapter:verse accuracy.

- [ ] **Step 4: Write findings**

Create `docs/superpowers/specs/2026-07-25-nt-birth-data-audit-findings.md`, one entry per finding, same format as prior books:

```markdown
## Finding N: <short description>
- **Category:** Incorrect | Missing | Unsupported | Structural gap
- **Verse(s):** <citation>
- **Current DB state:** <what's there now>
- **Proposed correction:** <exact new value>
- **Severity:** Critical | Important | Minor
```

At the top: `Reviewed: <N> people, <M> relationships, <K> refs. <F> findings.` — grep-count yourself.

- [ ] **Step 5: Triple-check**

Re-verify every finding once more; second full read-through for contradictions.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-07-25-nt-birth-data-audit-findings.md
git commit -m "$(cat <<'EOF'
docs: add NT birth narrative data audit findings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Write the Correction Script and Run a Dry-Run Only

**Files:**
- Read: `docs/superpowers/specs/2026-07-25-nt-birth-data-audit-findings.md`
- Read: `scripts/fix-luke-lineage-audit.ts` (for the exact DB access + dry-run pattern to reuse verbatim)
- Create: `scripts/fix-nt-birth-audit.ts`

This task stops after the dry-run. Do NOT execute for real or commit — controller review happens as a separate follow-up.

- [ ] **Step 1: Write the script** — follow `scripts/fix-luke-lineage-audit.ts`'s exact pattern.
- [ ] **Step 2: Typecheck** — `npx tsc --noEmit`, expect no output.
- [ ] **Step 3: Run the dry-run and report the output** — `npx tsx scripts/fix-nt-birth-audit.ts --dry-run`. If any resolver throws, STOP and report BLOCKED.

**Do not proceed past this step without controller review.**

---

### Task 3: Live Execution and Post-Correction Verification

- [ ] **Step 1: Run the script for real** — `npx tsx scripts/fix-nt-birth-audit.ts`. Expect matching statement count, no errors.
- [ ] **Step 2: Verify live via a direct DB query script** — confirm corrections landed, delete scratch script when done.
- [ ] **Step 3: Run the curated-family check** — `jesus_family` in `lib/families.ts` includes Joseph, Mary, Jesus, Elizabeth, Zechariah, and John the Baptist — all from this file. If any finding touches a `parent_of`/`spouse_of` relationship among them, run `FamilyTree.tsx`'s chain-completeness check for `jesus_family` specifically.
- [ ] **Step 4: Commit**

```bash
git add scripts/fix-nt-birth-audit.ts
git commit -m "$(cat <<'EOF'
fix: apply NT birth narrative data audit corrections to live database

Implements every finding from
docs/superpowers/specs/2026-07-25-nt-birth-data-audit-findings.md
against the live Turso database. Controller reviewed the dry-run
output and script source before live execution, then independently
verified the result against a fresh live data pull, including a
curated-family roster check against jesus_family.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Self-Review Notes

- **Spec coverage:** enumeration + cross-referencing + findings (Task 1), correction script with dry-run safety (Task 2), live execution + verification (Task 3) — including the jesus_family check called out explicitly since this is the first NT-series file where a curated family is directly populated.
- **Placeholder scan:** no TBDs.
- **Type consistency:** N/A — documentation and standalone script.
