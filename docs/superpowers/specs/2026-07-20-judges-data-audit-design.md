# Judges People & Relationships Data Audit — Design

**Date:** 2026-07-20
**Status:** Approved

## Context

Sixth in the per-book audit series (Genesis, Exodus, Numbers, Deuteronomy, and Joshua already merged — see their design specs for the established methodology, source, and fix-mechanism decisions, all reused unchanged here). `scripts/seed-judges.ts` is the largest book audited since Numbers: 22 new people spanning six judge narratives — Othniel/Cushan-rishathaim, Ehud/Eglon, Shamgar, Deborah/Barak/Sisera/Jabin/Jael/Heber, Gideon's family (Joash, Zebah, Zalmunna, Abimelech, Jotham), Jephthah and his daughter, and Samson's family (Manoah, Delilah) — with 23 relationships and 23 scripture refs.

Two cross-book connection points are worth flagging up front, both already noted (or precedented) by prior audits:
- **Heber's descent from Hobab** (Judg 4:11, `insertRelNameToLocal("Hobab", "ancestor_of", "heber", ...)`) — Hobab (Moses's father-in-law/brother-in-law) originates from Exodus/Numbers seeding. This audit checks the relationship's textual support, not Hobab's own record.
- **"Gilead" as Jephthah's father** (Judg 11:1) — the prior Numbers audit added a person record keyed `gilead` (son of Machir, grandson of Manasseh, from Zelophehad's genealogy, Num 26:29). Judges 11's "Gilead" is a different figure (Jephthah's father, in a different genealogical/narrative context — likely intended as a personification of the region/clan of Gilead rather than the same individual from Numbers 26). The Numbers audit's final review already confirmed `scripts/seed-judges.ts`'s "Gilead" appears only as prose in Jephthah's description, not as a `key:`-based person record, so there is currently no collision — but this audit must re-confirm that state and flag it as a Structural gap / disambiguation risk if `seed-judges.ts`'s own relationship (`insertRelNameToLocal("Gad", "ancestor_of", "jephthah", ...)`) or Jephthah's description creates ambiguity against the Numbers `gilead` record.

## Scope

**In scope:**
- All 22 new people: name, alternate names, description, tags, gender.
- All 23 relationships in the file.
- All 23 scripture refs added by this file (all attached to new-to-this-file people; unlike Joshua/Deuteronomy, this file does not add refs for pre-existing people via `loadExisting`).

**Out of scope:**
- Re-auditing Caleb's or Achsah's own person records (already owned by Genesis/Joshua) — only the two relationships this file adds referencing them (`Caleb sibling_of Othniel`, `Achsah spouse_of Othniel`) are in scope.
- Re-auditing Hobab's, Manasseh's, Gad's, or Dan's own person records — only the four relationships this file adds referencing them are in scope.
- Seeding new content to resolve the Numbers-vs-Judges "Gilead" naming situation beyond what's needed to confirm no live collision exists; if the two are legitimately different entities with no key collision, no correction is needed (matching the pattern already established for other same-name-different-person cases like the multiple "Manasseh"s and "Shimei"s).
- Any book other than Judges.

## Methodology (unchanged from prior books)

1. Enumerate every person/relationship/ref in `scripts/seed-judges.ts` (full file — 301 lines, read in one pass).
2. Cross-reference against ESV, fetched live, not recalled from memory: Judges 3 (Othniel, Ehud, Shamgar), 4-5 (Deborah, Barak, Sisera, Jabin, Jael, Heber, the Song of Deborah), 6-9 (Gideon, Joash, Zebah, Zalmunna, Abimelech, Jotham), 11-12 (Jephthah, his daughter, the Shibboleth incident), and 13-16 (Manoah, Samson, Delilah). Also fetch Joshua 15:17 (Othniel/Achsah cross-reference, already partly audited in the Joshua pass) if needed to confirm consistency, and Numbers 26:29 / the Numbers findings doc if the Gilead question requires it.
3. Prioritize: (a) whether each judge's tenure length, oppressor, and deliverance narrative match the text precisely (this book has more named numeric details — years of oppression, years of peace, casualty counts — than any prior book, a common error surface), (b) the Gilead naming situation described above, (c) whether Heber's descent from Hobab is textually supported as claimed (Judg 4:11), (d) whether Gideon's family relationships (Joash→Gideon→Abimelech/Jotham) and the Zebah/Zalmunna details match Judg 8 precisely, (e) all 23 refs' chapter:verse ranges and note text.
4. Triple-check: verify each finding once when found, then a second full pass before presenting findings.
5. Single audit pass — 22 people is comparable to Exodus (25) and smaller than Numbers (28), so no section split is needed, but this is the largest book since Numbers and should be budgeted accordingly.

## Findings report, correction & verification

Identical mechanism to prior books: findings document (`docs/superpowers/specs/2026-07-20-judges-data-audit-findings.md`), then `scripts/fix-judges-audit.ts` (same dry-run-gated pattern as `fix-joshua-audit.ts`), controller reviews dry-run before live execution, then live verification via API pull plus a `buildForest` chain-completeness spot-check on any curated family this book's people intersect with (none of the current 9 curated families are Judges-sourced, but this must be actually checked against `lib/families.ts`, not assumed).

## Out of scope

- Any book other than Judges.
- Re-auditing Caleb/Achsah/Hobab/Manasseh/Gad/Dan's own person records (owned by their originating books).
- Resolving the Gilead naming question with new content unless a live collision is actually found.
