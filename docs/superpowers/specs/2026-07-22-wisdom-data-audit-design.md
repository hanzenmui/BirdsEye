# Wisdom Books People & Relationships Data Audit — Design

**Date:** 2026-07-22
**Status:** Approved

## Context

Seventeenth in the per-book audit series (Genesis through Job already merged — see their design specs for the established methodology, source, and fix-mechanism decisions, all reused unchanged here). `scripts/seed-wisdom.ts` covers Proverbs, Ecclesiastes, and Song of Solomon. It adds 5 new people (Agur, Lemuel, the mother of Lemuel, the Shulamite, and the Daughters of Jerusalem) — 4 relationships, 16 scripture refs. Unlike most books in this series, most of the refs (9 of 16) attach to two pre-existing cross-seed people loaded at the top (`loadCrossSeedPeople`): Solomon (5 Proverbs/Ecclesiastes/Song of Solomon refs) and David (4 Psalm refs) — neither of their own person records is created or edited by this file, only new scripture_refs rows referencing them.

## Scope

**In scope:**
- All 5 new people: name, alternate names, description, tags, gender.
- All 4 relationships in the file, including the `agur other solomon` and `lemuel other solomon` relationships, and the `shulamite spouse_of solomon` relationship.
- All 16 scripture refs added by this file, including the 5 new refs attached to the pre-existing `solomon` person and the 4 new refs attached to the pre-existing `david` person.

**Out of scope:**
- Re-auditing Solomon's or David's own person records (owned by 1 Kings and 1/2 Samuel respectively) — only the new relationships/refs this file adds referencing them are in scope.
- Any book other than this file's scope (Proverbs, Ecclesiastes, Song of Solomon).
- The authorship-critical-scholarship debate over Ecclesiastes/Song of Solomon/parts of Proverbs is out of scope unless the DB's own description makes a specific, checkable claim that bears on it.

## Methodology (unchanged from prior books)

1. Enumerate every person/relationship/ref in `scripts/seed-wisdom.ts` (full file — 175 lines, read in one pass).
2. Cross-reference against ESV, fetched live, not recalled from memory: Proverbs 1:1, 10:1, 25:1 (Solomon's collections and the Hezekiah's-men copying note), Proverbs 30 (Agur's oracle), Proverbs 31 (King Lemuel and his mother's teaching, including the wife-of-noble-character poem), Ecclesiastes 1:1 (the Preacher, son of David, king in Jerusalem), Song of Solomon 1:1 and throughout (the Shulamite's identification at 6:13, the Daughters of Jerusalem's refrains at 2:7/3:5/5:8/8:4), Psalm 22, 23, 51, 110 superscriptions (for the David refs).
3. Prioritize: (a) Agur's and Lemuel's identity claims ("some traditions link him to Solomon" for Agur; "possibly another name for Solomon" for Lemuel) — verify these hedges are appropriately cautious and reflect real scholarly positions, not invented ones, (b) the `agur other solomon` and `lemuel other solomon` relationship type choice — check whether `"other"` is this codebase's actual established convention for a loose/uncertain-authorship-adjacency relationship or whether a more specific type exists elsewhere in the codebase that should be used instead, (c) the Shulamite's identification (`"the beloved, the Shulamite woman"`, "possibly from Shunem") and the `shulamite spouse_of solomon` relationship's textual basis — Song of Solomon's own authorial/narrative framing is contested among scholars regarding whether the book depicts an actual marriage to Solomon or is an allegorical/anthological love poem; check the DB's framing against this, (d) the exact chapter:verse ranges cited for Solomon's Proverbs collections (1-9, 10-22:16, 25-29) against the text's own internal section markers, (e) the Daughters of Jerusalem's four cited refrain locations (1:5, 2:7, 3:5, 5:8) — note the DB only cites 3 of what the description's own text calls "repeatedly" (1:5, 2:7, 5:8) and check whether 3:5 (mentioned in the description but not ref'd) or 8:4 (neither mentioned nor ref'd) should be added for consistency, (f) the four David Psalm refs' superscriptions and note text (23, 22, 51, 110), especially the parenthetical "(after Bathsheba)" on Psalm 51 and "(Messianic)" on Psalm 110 — verify these characterizations against the Psalms' own superscriptions and standard usage.
4. Triple-check: verify each finding once when found, then a second full pass before presenting findings.
5. Single audit pass — 5 new people plus 9 refs on pre-existing people is comparable in size to Esther/Job.

## Findings report, correction & verification

Identical mechanism to prior books: findings document (`docs/superpowers/specs/2026-07-22-wisdom-data-audit-findings.md`), then `scripts/fix-wisdom-audit.ts` (same dry-run-gated pattern as `scripts/fix-job-audit.ts`), controller reviews dry-run before live execution, then live verification via direct DB query (preferred given intermittent network issues observed in some prior books' dev-server routes) plus a curated-family roster check against `lib/families.ts` — `solomon_family`/`david_family` (if such curated families exist) are worth checking specifically given this file's heavy involvement with Solomon and David.

## Out of scope

- Any book other than this file's scope.
- Re-auditing Solomon's and David's own person records (owned by their originating books).
