# Matthew Lineage Gaps Data Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every person, relationship, and scripture ref in `scripts/seed-matthew-lineage.ts` against the actual biblical text (ESV, fetched live), producing a findings document, then correct the live database to match — twenty-first of the planned per-book audit series, and the first New Testament file.

**Architecture:** Single audit pass (12 new people), followed by a dry-run-safe correction script (same pattern as `scripts/fix-daniel-audit.ts`, already reviewed and proven twenty times), followed by post-correction verification.

**Tech Stack:** TypeScript, `tsx`, `@libsql/client` (Turso) for the correction script. WebFetch/WebSearch for source-text verification. No test framework (none exists in this project).

## Global Constraints

- **Source of truth:** ESV, fetched live via WebFetch/WebSearch for every claim checked — not recalled from memory, and not another translation (e.g. KJV) even where a claim implicitly assumes one.
- **In scope:** all 12 new people (Hezron, Ram, Amminadab, Abiud, Eliakim, Azor, Zadok, Achim, Eliud, Eleazar, Matthan, Jacob — Matthew-genealogy-specific keys) — including name/alsoKnownAs/description/tags/gender — all 14 relationships, and all 17 scripture refs in `scripts/seed-matthew-lineage.ts`.
- **Out of scope:** re-auditing Perez's, Nahshon's, Zerubbabel's, or Joseph's own person records (loaded via `loadExisting`/`loadExistingByAka`) — only new relationships/refs referencing them are in scope; the middle portion of Matthew's genealogy (David–Jechoniah, not touched by this file); any book/file other than this file's scope.
- **Findings categories:** exactly one of `Incorrect`, `Missing`, `Unsupported`, `Structural gap` per finding — never a compound value.
- **Priority:** (a) `ram`'s claim that Matt 1:3-4 renders him "Aram" — verify against the ESV's actual wording, not the KJV, (b) `amminadab`'s "father-in-law of Aaron, whose son Nahshon..." — check whether "whose" is misreadable as Aaron's son rather than Amminadab's, (c) each post-exilic name's "known only from this list" hedge — grep-confirm no collision elsewhere, (d) all 17 refs' chapter:verse ranges, (e) the `insertRelLocalToName` cross-seed lookup to Joseph — confirm it resolves.
- **Coverage counts:** the required top-line summary (people/relationships/refs) must be independently grep-verifiable. Expected: 12 people, 14 relationships, 17 refs — verify yourself.
- **Nothing gets written to the live database until Task 2** — Task 1 is pure research/documentation, producing markdown only.
- **Prefer direct `@libsql/client` verification scripts over the dev-server API route** for Task 3, given intermittent network issues observed in several prior books' audits.

---

### Task 1: Audit Matthew Lineage's People, Relationships & Refs

**Files:**
- Read: `scripts/seed-matthew-lineage.ts` (full file, 285 lines)
- Create: `docs/superpowers/specs/2026-07-25-matthew-lineage-data-audit-findings.md`

- [ ] **Step 1: Enumerate**

Read `scripts/seed-matthew-lineage.ts` in full. List all 12 people, all 14 relationships (including the `insertRelLocalToName` call to Joseph), and all 17 scripture refs.

- [ ] **Step 2: Fetch source text**

Use WebFetch/WebSearch to retrieve the ESV text of Ruth 4:18-22, 1 Chronicles 2:3-15, Numbers 1:7, Exodus 6:23, and Matthew 1:1-17 (full genealogy, with exact wording at 1:3-4 and 1:13-16). Do not answer from memory.

- [ ] **Step 3: Cross-reference**

For each of the 12 people: verify name, alternate names, gender, and that the description doesn't contradict the text — with special attention to `ram`'s "Aram" claim against ESV's actual "Ram" wording, and `amminadab`'s ambiguous "whose son Nahshon" pronoun. For each of the 14 relationships: verify textually supported and correctly typed, confirming `insertRelLocalToName("jacob_joseph", "parent_of", "Joseph", ...)` resolves against the live DB. For each of the 17 refs: verify chapter:verse ranges against the exact verse each name appears in.

- [ ] **Step 4: Write findings**

Create `docs/superpowers/specs/2026-07-25-matthew-lineage-data-audit-findings.md`, one entry per finding, same format as prior books:

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
git add docs/superpowers/specs/2026-07-25-matthew-lineage-data-audit-findings.md
git commit -m "$(cat <<'EOF'
docs: add Matthew lineage data audit findings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Write the Correction Script and Run a Dry-Run Only

**Files:**
- Read: `docs/superpowers/specs/2026-07-25-matthew-lineage-data-audit-findings.md` (Task 1's output)
- Read: `scripts/fix-daniel-audit.ts` (for the exact DB access + dry-run pattern to reuse verbatim)
- Create: `scripts/fix-matthew-lineage-audit.ts`

This task stops after the dry-run. Do NOT execute for real or commit — controller review happens as a separate follow-up.

- [ ] **Step 1: Write the script**

Create `scripts/fix-matthew-lineage-audit.ts` following `scripts/fix-daniel-audit.ts`'s exact pattern (same imports, `.env.local` loading, `DRY_RUN` gate, fail-loud resolver helpers). For each finding, implement as `UPDATE`/`INSERT OR IGNORE`/`DELETE` with a comment citing which finding it implements.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` — expect no output.

- [ ] **Step 3: Run the dry-run and report the output**

Run: `npx tsx scripts/fix-matthew-lineage-audit.ts --dry-run`. If any resolver throws, STOP and report BLOCKED.

**Do not proceed past this step without controller review.**

---

### Task 3: Live Execution and Post-Correction Verification

- [ ] **Step 1: Run the script for real**

Run: `npx tsx scripts/fix-matthew-lineage-audit.ts`. Expect matching statement count, no errors.

- [ ] **Step 2: Verify live via a direct DB query script**

Write a small scratch script, confirm corrections landed, delete it when done.

- [ ] **Step 3: Run the curated-family check**

Check `lib/families.ts` for any of the 12 new people, or Perez/Nahshon/Zerubbabel/Joseph, in a curated family roster. If found, run `FamilyTree.tsx`'s chain-completeness check for that family.

- [ ] **Step 4: Commit**

```bash
git add scripts/fix-matthew-lineage-audit.ts
git commit -m "$(cat <<'EOF'
fix: apply Matthew lineage data audit corrections to live database

Implements every finding from
docs/superpowers/specs/2026-07-25-matthew-lineage-data-audit-findings.md
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
