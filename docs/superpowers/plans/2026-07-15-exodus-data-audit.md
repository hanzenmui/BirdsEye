# Exodus Data Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every person and Exodus-native relationship in `scripts/seed-exodus.ts` against the actual Exodus text (ESV, fetched live), producing a findings document, then correct the live database to match — second of the planned per-book audit series.

**Architecture:** Single audit pass (Exodus is small enough — 25 people — not to need Genesis's 4-parallel-section split), followed by a dry-run-safe correction script (same pattern as `scripts/fix-genesis-audit.ts`, already reviewed and proven), followed by post-correction verification.

**Tech Stack:** TypeScript, `tsx`, `@libsql/client` (Turso) for the correction script. WebFetch/WebSearch for source-text verification. No test framework (none exists in this project).

## Global Constraints

- **Source of truth:** ESV, fetched live via WebFetch/WebSearch for every claim checked — not recalled from memory.
- **In scope:** every person in `scripts/seed-exodus.ts`, and every relationship where **both** people originate in Exodus.
- **Out of scope:** relationships crossing into Genesis-seeded people (e.g. Levi, Jacob) — those people's own accuracy was already covered by the Genesis audit; any book other than Exodus.
- **Findings categories:** exactly one of `Incorrect`, `Missing`, `Unsupported`, `Structural gap` per finding (a compound value like "Incorrect / Unsupported" was caught and had to be fixed in the Genesis audit — don't repeat that). Each finding: category, verse citation(s), current DB state, proposed correction, severity (`Critical`/`Important`/`Minor`).
- **Priority:** genealogical chain completeness (no gaps in `parent_of` chains) is the highest-value finding category — specifically trace Levi → Kohath → Amram → Moses/Aaron/Miriam, and Aaron's line (Nadab, Abihu, Eleazar, Ithamar).
- **Coverage counts:** the required top-line summary (people/relationships/refs) must be independently grep-verifiable — every section of the Genesis audit initially miscounted its relationship total and had to be corrected after review. Actually grep-count, don't estimate.
- **Nothing gets written to the live database until Task 2** — Task 1 is pure research/documentation, producing markdown only.

---

### Task 1: Audit Exodus's People & Relationships

**Files:**
- Read: `scripts/seed-exodus.ts` lines 92-204 (people: Levi's descendants, Moses/Aaron/Miriam, Moses' family, Pharaoh's household, Aaron's family, key Exodus figures, Egyptians — read this range directly for exact current field values)
- Read: `scripts/seed-exodus.ts` lines 206-251 (relationships)
- Read: `scripts/seed-exodus.ts` lines 253-330 (scripture refs)
- Create: `docs/superpowers/specs/2026-07-15-exodus-data-audit-findings.md`

**Interfaces:**
- Produces: a findings markdown file Task 2 reads to write the correction script.

- [ ] **Step 1: Enumerate**

Read `scripts/seed-exodus.ts` lines 92-204 in full. List every person (`key`, `name`, `alsoKnownAs`, `gender`, `description`, `tags`). Then read lines 206-251 for every relationship, and lines 253-330 for every scripture ref.

- [ ] **Step 2: Fetch source text**

Use WebFetch/WebSearch to retrieve the ESV text of Exodus 2 (Moses' birth, Pharaoh's daughter), 4 (Zipporah, Gershom), 6:14-27 (Levi's genealogy through Moses/Aaron), 18 (Jethro), 28-29 (Aaron's sons ordained), and any other chapters the enumerated people/relationships reference. Do not answer from memory.

- [ ] **Step 3: Cross-reference and trace chains**

For each person: verify name, alternate names, gender, and that the description doesn't contradict the text. For each relationship: verify it's textually supported and correctly typed. Specifically trace Levi → Kohath → Amram → Moses/Aaron/Miriam (Exodus 6:16-20) and Aaron → Nadab/Abihu/Eleazar/Ithamar (Exodus 6:23, 28:1) end-to-end in the current DB data, noting any missing intermediate names — this is the class of bug the Genesis audit found repeatedly (a chain that looks complete at a glance but has a gap breaking tree rendering).

- [ ] **Step 4: Write findings**

Create `docs/superpowers/specs/2026-07-15-exodus-data-audit-findings.md`, one entry per finding:

```markdown
## Finding N: <short description>
- **Category:** Incorrect | Missing | Unsupported | Structural gap
- **Verse(s):** <citation>
- **Current DB state:** <what's there now — key, field, or relationship>
- **Proposed correction:** <exact new value or exact new/removed relationship>
- **Severity:** Critical | Important | Minor
```

Only write findings for actual discrepancies. At the top of the file, add: `Reviewed: <N> people, <M> relationships, <K> refs. <F> findings.` — grep-count `N`/`M`/`K` yourself against the actual file ranges above before writing this line.

- [ ] **Step 5: Triple-check**

Re-verify every finding against the actual fetched text once more. Then do a second full read-through of the findings list checking for contradictions.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-07-15-exodus-data-audit-findings.md
git commit -m "$(cat <<'EOF'
docs: add Exodus data audit findings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Write the Correction Script and Run a Dry-Run Only

**Files:**
- Read: `docs/superpowers/specs/2026-07-15-exodus-data-audit-findings.md` (Task 1's output)
- Read: `scripts/fix-genesis-audit.ts` (for the exact DB access + dry-run pattern to reuse verbatim: `@libsql/client`, `.env.local` loading, `DRY_RUN` flag, `resolveExisting`/`resolveRelationship` fail-loud helpers, `run()` wrapper)
- Create: `scripts/fix-exodus-audit.ts`

**Interfaces:** None — standalone script.

This task stops after the dry-run. Do NOT execute the script for real or commit — that happens only after controller review, as a separate follow-up.

- [ ] **Step 1: Write the script**

Create `scripts/fix-exodus-audit.ts` following `scripts/fix-genesis-audit.ts`'s exact pattern (same imports, same `.env.local` loading, same `DRY_RUN` gate via `process.argv.includes("--dry-run")`, same fail-loud `resolveExisting`/`resolveRelationship` helpers that throw on zero or ambiguous matches). For each finding in the findings document, implement it as `INSERT OR IGNORE` (new person/relationship/ref), `UPDATE` (wrong field), or `DELETE` (unsupported relationship/person), with a comment directly above each statement citing which finding it implements.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Run the dry-run and report the output**

Run: `npx tsx scripts/fix-exodus-audit.ts --dry-run`
Report the full output. If any `resolveExisting`/`resolveRelationship` call throws, STOP and report BLOCKED with the exact error rather than guessing at a fix.

**Do not proceed past this step without controller review.** Report the full dry-run output and stop.

---

### Task 3: Live Execution and Post-Correction Verification

**Files:** `scripts/fix-exodus-audit.ts` (run, not modified further unless Task 2's dry-run needed a fix first)

**Interfaces:**
- Consumes: the reviewed, approved script from Task 2.

This task only starts once Task 2's dry-run has been reviewed and approved.

- [ ] **Step 1: Run the script for real**

Run: `npx tsx scripts/fix-exodus-audit.ts`
Expected: matches the dry-run's statement count, no errors.

- [ ] **Step 2: Verify live via the API**

Start the dev server (pick a free port among 3000-3004), log in with the passcode from `.env.local` (`ADMIN_PASSCODE`), pull `/api/people` and `/api/relationships` with the authenticated session cookie, and confirm the specific corrections from the findings document are actually present (e.g. any newly-added person exists exactly once, any corrected field/relationship matches the proposed correction). Stop the dev server when done; delete any scratch cookie/JSON files.

- [ ] **Step 3: Chain-completeness check for `moses_family`**

Using the live data pulled in Step 2, write a small throwaway `tsx` script that imports `resolveFamilyMembers` (from `lib/families.ts`) and `buildForest` (from `components/FamilyTree.tsx`), resolves `moses_family`'s member set, and confirms the resulting forest has no unexpected disconnected singleton that a chain gap would explain (cross-reference against the findings document — if a person is a legitimate singleton by design, e.g. a spouse or in-law, note that rather than treating it as a bug, the same way the Genesis audit's Task 7 did). Delete the throwaway script when done.

- [ ] **Step 4: Commit**

```bash
git add scripts/fix-exodus-audit.ts
git commit -m "$(cat <<'EOF'
fix: apply Exodus data audit corrections to live database

Implements every finding from
docs/superpowers/specs/2026-07-15-exodus-data-audit-findings.md
against the live Turso database. Controller reviewed the dry-run
output and script source before live execution, then independently
verified the result against a fresh live data pull, including a
buildForest chain-completeness check for moses_family.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Self-Review Notes

- **Spec coverage:** enumeration + cross-referencing + findings (Task 1), correction script with dry-run safety (Task 2), live execution + verification (Task 3) — every section of the design spec has a task.
- **Placeholder scan:** no TBDs; Task 1 points to exact line ranges (the implementer must read the live file fresh) rather than inlining content, matching the Genesis plan's already-accepted approach for this same kind of research task.
- **Type consistency:** N/A — this plan produces documentation and a standalone script, not a shared codebase interface.
