# Exodus People & Relationships Data Audit — Design

**Date:** 2026-07-15
**Status:** Approved

## Context

Second of the planned per-book audit series (Genesis was first — see `docs/superpowers/specs/2026-07-09-genesis-data-audit-design.md` for the established methodology, source, and fix-mechanism decisions, all reused unchanged here). `scripts/seed-exodus.ts` is much smaller than Genesis: 25 people across 7 narrative sections (Levi's descendants; Moses, Aaron, Miriam; Moses' family; Pharaoh's household; Aaron's family; key Exodus figures; Egyptians), versus Genesis's 68 people across 9 sections.

## Scope

**In scope:** every person and every relationship in `scripts/seed-exodus.ts`, where a relationship is in-scope only if both people originate in Exodus. Scripture refs are in scope for spot-checking, lower priority than person/relationship accuracy — same rule as Genesis.

**Out of scope:** relationships crossing into people added by other books (e.g. Levi/Kohath connect back to Genesis-seeded ancestors — that cross-book edge is Genesis's territory, already audited); any book other than Exodus.

## Methodology (unchanged from Genesis)

1. Enumerate every person/relationship in `scripts/seed-exodus.ts`.
2. Cross-reference against ESV, fetched live (WebFetch/WebSearch), not recalled from memory.
3. Prioritize chain completeness — specifically trace Levi → Kohath → Amram → Moses/Aaron/Miriam, and Aaron's line (Nadab, Abihu, Eleazar, Ithamar and their marriages/succession) end-to-end.
4. Triple-check: verify each finding once when found, then a full second pass before presenting findings.

Given the much smaller scope (25 people vs. 68), this is done as a **single audit pass**, not split into multiple parallel sections the way Genesis was — no consolidation step is needed since there's only one findings document.

## Findings report

Same format as Genesis: `docs/superpowers/specs/2026-07-15-exodus-data-audit-findings.md`, with Category (`Incorrect`/`Missing`/`Unsupported`/`Structural gap`), verse citation(s), current DB state, proposed correction, and severity (`Critical`/`Important`/`Minor`) per finding. Same collision-check requirement for any newly-proposed person key (check against Exodus's own existing keys and, since Exodus already reuses some Genesis people via `loadGenesisIds`, against Genesis's key list too).

## Correction & verification

Same mechanism as Genesis: `scripts/fix-exodus-audit.ts`, same DB-access pattern, `--dry-run` flag, controller reviews dry-run output before live execution (explicit separate step, not silently bundled). After running: re-pull live data and re-run the same chain-completeness check technique used in the Genesis audit's Task 7 and the subsequent lineage-consistency pass (via `buildForest`/`resolveFamilyMembers` for `moses_family`, the one curated family sourced primarily from Exodus).

## Out of scope

- Any book other than Exodus.
- Re-auditing Genesis-sourced people that Exodus's relationships merely reference (e.g. Levi, Jacob) — their own accuracy was already covered by the Genesis audit.
