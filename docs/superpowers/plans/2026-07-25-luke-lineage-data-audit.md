# Luke Lineage Data Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every person, relationship, and scripture ref in `scripts/seed-luke-lineage.ts` against the actual biblical text (ESV, fetched live), producing a findings document, then correct the live database to match — twenty-second of the planned per-book audit series.

**Architecture:** Single audit pass (38 new people, the largest file in the series), followed by a dry-run-safe correction script (same pattern as `scripts/fix-matthew-lineage-audit.ts`), followed by post-correction verification.

**Tech Stack:** TypeScript, `tsx`, `@libsql/client` (Turso) for the correction script. WebFetch/WebSearch for source-text verification. No test framework (none exists in this project).

## Global Constraints

- **Source of truth:** ESV, fetched live via WebFetch/WebSearch — not recalled from memory, and not another translation even where a claim implicitly assumes one.
- **In scope:** all 38 new people (name/alsoKnownAs/description/tags/gender), all 40 relationships (39 via standard helpers + 1 raw-SQL Heli→Joseph), and all 41 refs (39 via standard helper + 2 raw-SQL: John the Baptist, Jesus) in `scripts/seed-luke-lineage.ts`.
- **Out of scope:** re-auditing David's, Shealtiel's, or Zerubbabel's own person records; Luke 3:32-38 (not touched by this file); any book/file other than this file's scope.
- **Findings categories:** exactly one of `Incorrect`, `Missing`, `Unsupported`, `Structural gap` per finding.
- **Priority:** (a) exact name spelling and chain order for all 38 names, verse by verse, both directions, (b) `matthias_luke_upper`/`matthias_luke_lower`'s name spelling against ESV Luke 3:25-26, (c) Neri's description and the Neri→Shealtiel relationship note's "Matthew says son of Jehoiachin" claim against Matt 1:12's actual wording, (d) every disambiguation hedge — grep-confirm the referenced figure exists elsewhere, (e) all 41 refs' chapter:verse ranges, (f) the 2 raw-SQL additions for correctness.
- **Coverage counts:** grep-count yourself. Expected: 38 people, 40 relationships (39 grep-visible + 1 raw), 41 refs (39 grep-visible + 2 raw).
- **Nothing gets written to the live database until Task 2.**
- **Prefer direct `@libsql/client` verification scripts over the dev-server API route** for Task 3.

---

### Task 1: Audit Luke Lineage's People, Relationships & Refs

**Files:**
- Read: `scripts/seed-luke-lineage.ts` (full file, 676 lines)
- Create: `docs/superpowers/specs/2026-07-25-luke-lineage-data-audit-findings.md`

- [ ] **Step 1: Enumerate**

Read the full file. List all 38 people, all 40 relationships, all 41 refs.

- [ ] **Step 2: Fetch source text**

Use WebFetch/WebSearch to retrieve the complete ESV text of Luke 3:23-31 and 3:24-27 verse by verse, Matthew 1:11-12, 1 Chronicles 3:5, and Luke 3:1-22. Do not answer from memory — this chain is long and error-prone to recall.

- [ ] **Step 3: Cross-reference**

Walk the full 38-name chain twice (once in the text's own Jesus-to-David order, once in the DB's David-to-Jesus `parent_of` order) checking every name's spelling against the ESV verse it's cited at, with particular attention to the two "Matthias" entries (verify against ESV Luke 3:25-26's actual spelling) and Neri's "Matthew says son of Jehoiachin" claim (verify against Matt 1:12's actual wording). Grep-confirm every disambiguation hedge references a real DB record.

- [ ] **Step 4: Write findings**

Create `docs/superpowers/specs/2026-07-25-luke-lineage-data-audit-findings.md`, one entry per finding, same format as prior books:

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

Re-verify every finding once more; re-walk the full name chain a second time end to end.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-07-25-luke-lineage-data-audit-findings.md
git commit -m "$(cat <<'EOF'
docs: add Luke lineage data audit findings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Write the Correction Script and Run a Dry-Run Only

**Files:**
- Read: `docs/superpowers/specs/2026-07-25-luke-lineage-data-audit-findings.md`
- Read: `scripts/fix-matthew-lineage-audit.ts` (for the exact DB access + dry-run pattern to reuse verbatim)
- Create: `scripts/fix-luke-lineage-audit.ts`

This task stops after the dry-run. Do NOT execute for real or commit — controller review happens as a separate follow-up.

- [ ] **Step 1: Write the script**

Follow `scripts/fix-matthew-lineage-audit.ts`'s exact pattern. If a finding spans multiple fields on the same person, or touches multiple people's descriptions plus scripture_refs notes for one root cause (e.g. a misspelled name propagated through cross-references), implement each affected row as its own `run(...)` call with its own citation, all grouped under one comment block explaining the shared root cause.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` — expect no output.

- [ ] **Step 3: Run the dry-run and report the output**

Run: `npx tsx scripts/fix-luke-lineage-audit.ts --dry-run`. If any resolver throws, STOP and report BLOCKED.

**Do not proceed past this step without controller review.**

---

### Task 3: Live Execution and Post-Correction Verification

- [ ] **Step 1: Run the script for real**

Run: `npx tsx scripts/fix-luke-lineage-audit.ts`. Expect matching statement count, no errors.

- [ ] **Step 2: Verify live via a direct DB query script**

Write a small scratch script, confirm corrections landed, delete it when done.

- [ ] **Step 3: Run the curated-family check**

Check `lib/families.ts` for any of the 38 new people, or David/Shealtiel/Zerubbabel, in a curated family roster. `jesus_family` includes Joseph (aka "husband of Mary") — note whether this file's Heli→Joseph relationship affects that family's chain-completeness, even though no finding here should require touching that relationship.

- [ ] **Step 4: Commit**

```bash
git add scripts/fix-luke-lineage-audit.ts
git commit -m "$(cat <<'EOF'
fix: apply Luke lineage data audit corrections to live database

Implements every finding from
docs/superpowers/specs/2026-07-25-luke-lineage-data-audit-findings.md
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
