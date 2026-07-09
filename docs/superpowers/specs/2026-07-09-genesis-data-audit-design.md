# Genesis People & Relationships Data Audit — Design

**Date:** 2026-07-09
**Status:** Approved

## Context

`scripts/seed-genesis.ts` seeded the live Turso database with Genesis's people, relationships, and scripture references. A visible bug surfaced this data's reliability: Enoch (son of Cain) and Lamech (of Seth's line) render as disconnected nodes floating next to Eve in the "Adam's Family" tree view, because their `parent_of` chains back to Adam/Eve are incomplete within the current dataset — a structural gap, not merely a display bug. Given that discovery, and given prior data-authoring already introduced at least one caught bug this session (several canonical figures' `alsoKnownAs` fields silently breaking family-roster resolution), a full audit of Genesis's data is warranted before trusting any of the 7 curated families that draw from it.

This is the first of what will be a series of per-book audits (Genesis first, since it's where the bug was found and where most of the current Family Tree Categories feature draws its data). Other books are explicitly out of scope for this spec and will get their own future audit passes using the same methodology.

## Scope

**In scope:** every person and every relationship in `scripts/seed-genesis.ts`, where a relationship is in-scope only if **both** people originate in Genesis. Scripture references (`insertRef` calls) are in scope for spot-checking (correct book/chapter/verse) but are lower priority than person/relationship accuracy.

**Out of scope:**
- Relationships where one person is Genesis-native but the other is added by a later book's seed script (e.g. a Matthew-lineage or Luke-lineage script referencing "Abraham" by name). These get reviewed when that other book's own audit pass happens.
- Any book other than Genesis.
- The tree-line-simplification work (separate spec, `2026-07-09-tree-line-simplification-design.md`).

## Methodology

1. **Enumerate.** Read `scripts/seed-genesis.ts` in full and list every `insertPerson`/`safeInsertPerson` call (person fields: name, `alsoKnownAs`, gender, description, tags) and every `insertRel`/`insertRelByName` call (relationship: person A, type, person B).
2. **Cross-reference against source text.** For each person and relationship, verify against the actual Genesis text — ESV, fetched live via web lookup (WebFetch/WebSearch), not recalled from training-data memory. This is the same failure mode that produced the resolver bug earlier this session (assuming instead of verifying), and it's the reason this audit exists.
3. **Prioritize chain completeness.** Specifically trace these named genealogical chains end-to-end and confirm no gaps: Cain's line (Gen 4:17-24), Seth's line to Noah (Gen 5), the Table of Nations (Gen 10), Shem's line to Abraham (Gen 11:10-32), Abraham's family (Gen 11-25, including Hagar/Ishmael and Keturah's sons), Isaac's family (Gen 25-28), Jacob's family (Gen 29-35, all 12 sons plus Dinah), Esau's Edomite line (Gen 36), and Joseph's family (Gen 37-50). A broken link anywhere in one of these chains is what produces a disconnected node in the tree — this is the highest-value category of finding.
4. **Triple-check.** Verify each finding against the actual verse text once when found. Before presenting the findings list, do a second complete pass over it checking for internal contradictions, and re-confirm any finding that depends on a discovery made later in the pass (a corrected relationship earlier in the list might change what "complete" means for a chain reviewed after it).

## Findings report

Output: a written document, `docs/superpowers/specs/2026-07-09-genesis-data-audit-findings.md`, produced during implementation (not part of this design doc — the design specifies the *process*, the findings document is the *product* of running that process).

Each finding includes:
- **Category** — `Incorrect` (wrong name/relationship-type/gender/description claim), `Missing` (something the text supports that isn't in the DB), `Unsupported` (something in the DB not backed by the text or by clearly-labeled extra-biblical tradition), or `Structural gap` (a chain break causing a disconnected-node rendering bug, independent of whether the individual links involved are each individually correct).
- **Verse citation(s).**
- **Current DB state.**
- **Proposed correction.**
- **Severity** — Critical (materially wrong or misleading data), Important (structural gap affecting tree rendering), Minor (incomplete alternate-name coverage, prose polish, missing tag).

## Correction mechanism

A new script, `scripts/fix-genesis-audit.ts`, following the same DB-access pattern already used by the seed scripts (`@libsql/client`, `.env.local` credentials). Unlike the seed scripts (which use `INSERT OR IGNORE` and therefore cannot fix data already in the live database), this script uses `UPDATE` for wrong person fields, `DELETE`/`INSERT` for wrong relationships, `INSERT` for approved missing people/relationships, and `DELETE` for approved-for-removal unsupported entries.

Because this is the one step in the process that mutates the live, already-in-use database, the implementation plan must make running it an explicit, separate, clearly-labeled step — not bundled silently into a larger task — even though this spec does not require pausing for interactive confirmation before executing it.

## Verification

After the correction script runs:
1. Re-fetch live `people`/`relationships` data (the same technique used earlier this session to validate `lib/families.ts` against live data — an authenticated `/api/people` and `/api/relationships` pull).
2. Re-run a structural check confirming every person in each of the Genesis-sourced curated families (Adam's, Noah's, Abraham's, Isaac's, Jacob's, Joseph's) now connects into a single tree per family with no unexplained disconnected singletons — specifically confirming Enoch and Lamech no longer float next to Eve, or, if they remain structurally disconnected because the connecting chain is intentionally outside a given family's curated member list (a `lib/families.ts` roster-scope decision, not a data-correctness one), that this is a deliberate, understood outcome rather than a bug.
3. Where feasible, a live visual check of the affected views.
