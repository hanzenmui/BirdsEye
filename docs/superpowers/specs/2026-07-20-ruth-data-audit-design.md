# Ruth People & Relationships Data Audit — Design

**Date:** 2026-07-20
**Status:** Approved

## Context

Seventh in the per-book audit series (Genesis, Exodus, Numbers, Deuteronomy, Joshua, and Judges already merged — see their design specs for the established methodology, source, and fix-mechanism decisions, all reused unchanged here). `scripts/seed-ruth.ts` is a small, tightly-focused book: 10 new people (Naomi's family — Elimelech, Naomi, Mahlon, Chilion; Ruth and Orpah; Boaz's lineage — Salmon, Boaz, Obed, Jesse), 16 relationships, and 12 scripture refs. This book sits directly in the Davidic/messianic genealogical chain (Ruth 4:18-22: Perez → Hezron → Ram → Amminadab → Nahshon → Salmon → Boaz → Obed → Jesse → David) and directly connects to two people already audited in prior books: Rahab (Joshua audit — the Joshua audit already confirmed a `Rahab spouse_of Salmon` relationship exists, seeded by this very file) and Nahshon (Numbers audit — a `Nahshon parent_of Salmon` relationship this file adds).

## Scope

**In scope:**
- All 10 new people: name, alternate names, description, tags, gender.
- All 16 relationships in the file, including the two that reference pre-existing people (`Nahshon parent_of Salmon`, `Rahab spouse_of Salmon`) and the two `Judah ancestor_of` relationships (Elimelech, Boaz).
- All 12 scripture refs added by this file, including the cross-book ref this file adds directly to Rahab's existing record (lines 183-191, a manual `db.execute` outside the `insertRef` helper — worth double-checking it behaves identically to the helper's pattern).

**Out of scope:**
- Re-auditing Rahab's or Nahshon's own person records (owned by Joshua and Numbers respectively) — only the two relationships this file adds referencing them are in scope.
- Re-auditing the wider Perez→Hezron→Ram→Amminadab→Nahshon chain (owned by whichever earlier book seeded it) — only confirming `Nahshon parent_of Salmon` correctly continues that chain, not auditing the chain's own earlier links.
- The unnamed "nearer kinsman" (Ruth 4:1, Hebrew "peloni almoni," an intentionally anonymous figure in the text) — his absence from the DB is expected and correct, not a finding, unless the file's own content asserts something about him that requires a record.
- Any book other than Ruth.

## Methodology (unchanged from prior books)

1. Enumerate every person/relationship/ref in `scripts/seed-ruth.ts` (full file — 214 lines, read in one pass).
2. Cross-reference against ESV, fetched live, not recalled from memory: Ruth 1 (Elimelech's family, the move to Moab, deaths, Naomi's return, Ruth's declaration, Orpah's departure), Ruth 2 (gleaning, Boaz's generosity), Ruth 3 (the threshing floor), Ruth 4 (the gate redemption, marriage, Obed's birth, the closing genealogy). Also fetch Numbers 1:7/2:3 or wherever Nahshon is introduced (to confirm the `Nahshon parent_of Salmon` link is textually placed correctly) and re-confirm Matthew 1:4-5's genealogy wording for the Salmon/Rahab/Boaz chain, since this file's descriptions cite both Ruth 4 and Matthew 1.
3. Prioritize: (a) Naomi's name-change to "Mara" and its stated reason match Ruth 1:20-21 precisely, (b) the full genealogical chain in Ruth 4:18-22 (Salmon→Boaz→Obed→Jesse) matches exactly, including any detail about Jesse's other sons or David's position, (c) the "Judah ancestor_of" relationships for Elimelech and Boaz are consistent with how "Judah" is disambiguated elsewhere in the DB (multiple "Judah" person records exist — the patriarch and "Judah son of Joseph" from Luke's genealogy — confirm the relationship targets the correct one), (d) the manual cross-book Rahab ref insert (lines 183-191) is textually accurate and doesn't diverge from the `insertRef` helper's normal behavior in a way that matters, (e) all 12 refs' chapter:verse ranges and note text are accurate.
4. Triple-check: verify each finding once when found, then a second full pass before presenting findings.
5. Single audit pass — this is one of the smaller books audited (10 people, comparable to Deuteronomy's 2 and Joshua's 8, well below Judges's 22), so no section split is needed.

## Findings report, correction & verification

Identical mechanism to prior books: findings document (`docs/superpowers/specs/2026-07-20-ruth-data-audit-findings.md`), then `scripts/fix-ruth-audit.ts` (same dry-run-gated pattern as `fix-judges-audit.ts`), controller reviews dry-run before live execution, then live verification via API pull plus a `buildForest` chain-completeness spot-check on any curated family this book's people intersect with. Note: unlike prior audited books, this one is genealogically adjacent to `david_family` in `lib/families.ts` (Jesse is David's father) — this must be actually checked against the current family roster, not assumed clear like most prior books.

## Out of scope

- Any book other than Ruth.
- Re-auditing Rahab/Nahshon's own person records or the wider Perez-through-Amminadab chain (owned by their originating books).
- Seeding a person record for the unnamed nearer kinsman.
