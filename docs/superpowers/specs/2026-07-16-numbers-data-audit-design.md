# Numbers People & Relationships Data Audit — Design

**Date:** 2026-07-16
**Status:** Approved

## Context

Third of the planned per-book audit series (Genesis and Exodus already merged — see their design specs for the established methodology, source, and fix-mechanism decisions, all reused unchanged here). `scripts/seed-numbers.ts` has 28 people across 6 narrative sections (twelve tribal princes; Levitical clan heads; Korah's rebellion; Balaam narrative; Peor incident; Zelophehad and his daughters).

Note: `scripts/seed-numbers.ts` was written knowing Leviticus and some Numbers data had already been added to the live DB from another machine before this script ran, hence its use of `safeInsertPerson` (idempotent by name) rather than the plain `insertPerson` some earlier scripts use. This doesn't change the audit methodology, only confirms the existing script's own defensiveness is already appropriate.

**Not in scope for this or any near-term audit:** Leviticus has no seed script in this repository at all — its people were seeded directly against the live database from another machine, per `scripts/seed-numbers.ts`'s own context. Auditing it would require a different methodology (pulling live data by book tag with no source script to reference) and is deferred as a separate future item, not attempted here.

## Scope

**In scope:** every person and every relationship in `scripts/seed-numbers.ts`, where a relationship is in-scope only if both people originate in Numbers.

**Out of scope:** relationships crossing into people added by other books (e.g. tribal princes connecting back to Jacob's sons, already Genesis's territory); Leviticus (see above); any book other than Numbers.

## Methodology (unchanged from Genesis/Exodus)

1. Enumerate every person/relationship in `scripts/seed-numbers.ts`.
2. Cross-reference against ESV, fetched live, not recalled from memory.
3. Prioritize chain completeness — specifically trace the Levitical clan heads' connection back to Levi/Kohath (already partly seeded by Exodus), and Korah's rebellion's family connections (Korah, Dathan, Abiram, On).
4. Triple-check: verify each finding once when found, then a full second pass before presenting findings.
5. Single audit pass (28 people, comparable to Exodus's 25) — no parallel-section split needed.

## Findings report, correction & verification

Identical mechanism to Exodus: findings document (`docs/superpowers/specs/2026-07-16-numbers-data-audit-findings.md`), then `scripts/fix-numbers-audit.ts` (same dry-run-gated pattern as `fix-genesis-audit.ts`/`fix-exodus-audit.ts`), controller reviews dry-run before live execution, then live verification via API pull plus a `buildForest` chain-completeness spot-check on any curated family this book's people intersect with (none of the current 9 curated families are Numbers-sourced, so this step may simply confirm that and move on).

## Out of scope

- Leviticus (no seed script — separate future methodology needed).
- Any book other than Numbers.
- Re-auditing Genesis/Exodus-sourced people that Numbers's relationships merely reference.
