# Joshua People & Relationships Data Audit — Design

**Date:** 2026-07-17
**Status:** Approved

## Context

Fifth in the per-book audit series (Genesis, Exodus, Numbers, and Deuteronomy already merged — see their design specs for the established methodology, source, and fix-mechanism decisions, all reused unchanged here). `scripts/seed-joshua.ts` introduces 9 new people: Rahab, Achan, Achsah, and the five Amorite kings of the Gibeon coalition (Adoni-zedek, Hoham, Piram, Japhia, Debir). It also adds 9 relationships and 15 scripture refs, including refs for pre-existing people (Joshua, Caleb, Eleazar, Phinehas) whose refs here are native to this file.

## Scope

**In scope:**
- All 9 new people: name, alternate names, description, tags, gender.
- All 9 relationships in the file.
- All 15 scripture refs added by this file, including the ones attached to pre-existing people (Joshua, Caleb, Eleazar, Phinehas) — the refs themselves are native to this file even though the people are not.

**Out of scope:**
- Re-auditing Joshua/Caleb/Eleazar/Phinehas's own person records (name, description, other relationships) — owned by whichever book originally seeded them.
- Relationships crossing into people not seeded by this file, except where this file itself asserts the relationship (e.g., `Judah ancestor_of achan`, `Caleb parent_of Achsah` — these ARE in scope since they're native to this file, even though Judah and Caleb originate elsewhere).
- Rahab's downstream lineage (marriage to Salmon, motherhood of Boaz) is asserted in her description but not modeled as a relationship in this file — flagged as a candidate finding only if the description's claim can't be reconciled with existing DB data, not as a mandate to seed new Ruth/Matthew-lineage content here.
- Achan's ancestry (Carmi, Zabdi/Zimri) similarly — flagged only if the file's own relationship (`Judah ancestor_of achan`, skipping intermediate generations named in his description) creates the same "structural gap" pattern already fixed in Genesis/Exodus/Numbers, not as a mandate to seed the full chain if the file doesn't attempt to model it.
- Any book other than Joshua.

## Methodology (unchanged from Genesis/Exodus/Numbers/Deuteronomy)

1. Enumerate every person/relationship/ref in `scripts/seed-joshua.ts` (full file — 219 lines).
2. Cross-reference against ESV, fetched live, not recalled from memory: Joshua 2 (Rahab), 6:17-25 (Jericho's fall), 7 (Achan), 10 (the five-king coalition, Gibeon, the sun standing still, Makkedah), 14-15 (Caleb, Achsah, Othniel), 19-21 (Eleazar, land allotment, Levitical cities), 22 (Phinehas and the Transjordanian altar), and 23-24 (Joshua's farewell/Shechem).
3. Prioritize: (a) whether the five kings' titles/cities and the coalition's structure match Josh 10:3 precisely, (b) whether Achan's ancestry description ("son of Carmi, of the clan of Zabdi... tribe of Judah") is consistent with the single `Judah ancestor_of achan` relationship the file actually models — same structural-gap pattern flagged in prior books, (c) whether Rahab's description's claims (marriage to Salmon, mother of Boaz) are reconcilable with the rest of the DB (does a `salmon`/`boaz` person exist already, and if so does any relationship connect them?), (d) whether all 15 refs' chapter:verse ranges and note text are accurate.
4. Triple-check: verify each finding once when found, then a second full pass before presenting findings.
5. Single audit pass — comparable in size to Exodus (25 people) and Numbers (28 people) only in ref count, but far smaller in new-person count (9), so no section split is needed.

## Findings report, correction & verification

Identical mechanism to prior books: findings document (`docs/superpowers/specs/2026-07-17-joshua-data-audit-findings.md`), then `scripts/fix-joshua-audit.ts` (same dry-run-gated pattern as `fix-deuteronomy-audit.ts`/`fix-numbers-audit.ts`), controller reviews dry-run before live execution, then live verification via API pull plus a `buildForest` chain-completeness spot-check on any curated family this book's people intersect with (none of the current 9 curated families are Joshua-sourced, so this step likely simply confirms that and moves on, matching Numbers's and Deuteronomy's outcome — but this must still be actually checked, not assumed, since Achsah is Caleb's daughter and Caleb is a curated-family root in `abraham_family` or similar).

## Out of scope

- Any book other than Joshua.
- Re-auditing Joshua/Caleb/Eleazar/Phinehas's own person records (owned by their originating books).
- Seeding new Ruth/Matthew-lineage or Achan-ancestry content beyond what this file already attempts to model, unless the file's own existing content asserts something the DB can't support.
