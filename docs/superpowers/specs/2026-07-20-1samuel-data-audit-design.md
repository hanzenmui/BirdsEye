# 1 Samuel People & Relationships Data Audit — Design

**Date:** 2026-07-20
**Status:** Approved

## Context

Eighth in the per-book audit series (Genesis, Exodus, Numbers, Deuteronomy, Joshua, Judges, and Ruth already merged — see their design specs for the established methodology, source, and fix-mechanism decisions, all reused unchanged here). `scripts/seed-1samuel.ts` is one of the larger, richer books audited: 22 new people spanning Hannah/Elkanah's family, Eli and his sons, Samuel, Saul's family (Kish, Jonathan, Merab, Michal, Abner), David, Goliath, the priests of Nob (Ahimelech, Abiathar, Doeg), David's early wives (Nabal, Abigail, Ahinoam), and Achish of Gath — 28 relationships, 22 scripture refs.

This book directly continues the Davidic genealogical chain the Ruth audit already verified (`Jesse parent_of David`, `Judah ancestor_of david`), and reintroduces Phinehas (Eli's son) alongside the already-seeded, unrelated Phinehas son of Eleazar — the seed file's own description already disambiguates them, worth confirming that holds.

## Scope

**In scope:**
- All 22 new people: name, alternate names, description, tags, gender.
- All 28 relationships in the file, including the four that reference pre-existing people (`Jesse parent_of David`, `Judah ancestor_of david`, `Benjamin ancestor_of saul`, `Benjamin ancestor_of kish`).
- All 22 scripture refs added by this file.

**Out of scope:**
- Re-auditing Jesse/Judah/Benjamin's own person records (owned by their originating books) — only the relationships this file adds referencing them are in scope.
- Any book other than 1 Samuel (2 Samuel will be a separate, subsequent audit pass, matching how this series has always treated each seed file as its own book).

## Methodology (unchanged from prior books)

1. Enumerate every person/relationship/ref in `scripts/seed-1samuel.ts` (full file — 301 lines, read in one pass).
2. Cross-reference against ESV, fetched live, not recalled from memory: 1 Samuel 1-3 (Hannah, Elkanah, Peninnah, Eli, Hophni, Phinehas, Samuel's birth/dedication/calling), 4 (Hophni and Phinehas's deaths, the ark captured), 9-15 (Saul's rise, Kish, Jonathan, the kingdom, Saul's rejection), 16-17 (David's anointing, Goliath), 18-20 (Jonathan's covenant, Michal, Saul's jealousy), 21-22 (Nob, Ahimelech, Doeg, Abiathar), 25 (Nabal, Abigail), 27-29 (Achish, Ziklag), 31 (Saul and Jonathan's deaths at Gilboa).
3. Prioritize: (a) Goliath's physical description (height "six cubits and a span," armor weight, weapon details) — a well-known point of ancient-manuscript variation (the Dead Sea Scrolls' 4QSam-a and the LXX give a shorter height, "four cubits and a span," than the Masoretic Text's "six cubits and a span") worth checking whether the DB's description states the MT figure as uncontested fact or should note the variant, (b) the priests-of-Nob massacre count (85 in the MT; some traditions/versions differ) and Doeg's role, (c) the David/Jesse/Judah relationship chain's consistency with what the Ruth audit already established, (d) Eli's sons' explicit disambiguation from the unrelated Phinehas son of Eleazar, (e) all 22 refs' chapter:verse ranges and note text.
4. Triple-check: verify each finding once when found, then a second full pass before presenting findings.
5. Single audit pass — 22 people is comparable to Numbers (28) and larger than most prior books except Judges (22) and Numbers, so budget accordingly but no section split needed based on prior books' precedent at this size.

## Findings report, correction & verification

Identical mechanism to prior books: findings document (`docs/superpowers/specs/2026-07-20-1samuel-data-audit-findings.md`), then `scripts/fix-1samuel-audit.ts` (same dry-run-gated pattern as `fix-ruth-audit.ts`, including reuse of its `relationshipExists()` idempotency guard where the fix touches an existing relationship, now that the live `relationships` table has a unique constraint — INSERT statements for genuinely new relationships can rely on `INSERT OR IGNORE` alone since it's now truly idempotent, but any resolve-then-conditionally-insert logic should still be written defensively). Controller reviews dry-run before live execution, then live verification via API pull plus a `buildForest` chain-completeness spot-check on any curated family this book's people intersect with — note `david_family` in `lib/families.ts` already includes many names this book introduces (Saul, Abigail, Nabal per the roster grep at line 55-58), so this check must be actually run, not assumed clear.

## Out of scope

- 2 Samuel (a separate, subsequent audit).
- Re-auditing Jesse/Judah/Benjamin's own person records (owned by their originating books).
- Any book other than 1 Samuel.
