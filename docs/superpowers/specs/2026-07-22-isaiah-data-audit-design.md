# Isaiah People & Relationships Data Audit — Design

**Date:** 2026-07-22
**Status:** Approved

## Context

Eighteenth in the per-book audit series (Genesis through Wisdom books already merged — see their design specs for the established methodology, source, and fix-mechanism decisions, all reused unchanged here). `scripts/seed-isaiah.ts` adds 7 new people (Amoz, Uzziah, Jotham of Judah, Ahaz of Judah, Wife of Isaiah, Shear-Jashub, Maher-shalal-hash-baz) — 9 relationships, 9 scripture refs. It also loads 2 pre-existing cross-seed people (`loadCrossSeedPeople`): Isaiah and Hezekiah, adding only new relationships/refs to them, not editing their own person records.

**Important scope wrinkle, unlike a typical cross-seed reference:** unlike most prior books, this file's `safeInsertPerson` calls for Uzziah, Jotham, and Ahaz are their actual *first creation* in this codebase — grepping every `scripts/seed-*.ts` file confirms no other file creates person records with these names via `safeInsertPerson` (a same-named "Jotham" in `seed-judges.ts` is a distinct person, Gideon's son, disambiguated by a different `alsoKnownAs`, not a collision). Because this file is where these three kings' person records actually originate, their own `name`/`alsoKnownAs`/`description`/`tags`/`gender` fields ARE in scope for this audit — unlike Isaiah's and Hezekiah's own records, which are genuinely out of scope since those two are loaded via `loadExisting` from an earlier seed run.

## Scope

**In scope:**
- All 7 new people: name, alternate names, description, tags, gender — including Uzziah, Jotham, and Ahaz's own person records (see scope wrinkle above).
- All 9 relationships in the file, including the `ahaz_judah parent_of Hezekiah` cross-seed-name-lookup relationship (via `insertRelLocalToName`) and the `isaiah ally_of hezekiah` / `isaiah other ahaz_judah` relationships.
- All 9 scripture refs added by this file.

**Out of scope:**
- Re-auditing Isaiah's or Hezekiah's own person records (loaded via `loadExisting`, originating elsewhere) — only the new relationships/refs this file adds referencing them are in scope.
- Any book other than this file's scope.

## Methodology (unchanged from prior books)

1. Enumerate every person/relationship/ref in `scripts/seed-isaiah.ts` (full file — 206 lines, read in one pass).
2. Cross-reference against ESV, fetched live, not recalled from memory: Isaiah 1:1 (the superscription naming Amoz and all four kings), Isaiah 6 (the call vision "in the year that King Uzziah died"), Isaiah 7 (the Ahaz/Immanuel encounter, Shear-Jashub present), Isaiah 8:1-4 (Maher-shalal-hash-baz's birth and naming), Isaiah 8:3 ("the prophetess"), Isaiah 36-39 (Hezekiah/Sennacherib, Isaiah's counsel), 2 Kings 15-20 (the parallel royal history for Uzziah/Jotham/Ahaz/Hezekiah's reigns and dates).
3. Prioritize: (a) Uzziah/Jotham/Ahaz's regnal date ranges (~792–740, ~740–732, ~732–716 BC) — verify against standard scholarly chronologies (these are genuinely disputed among chronologists; check whether the DB's specific figures match a recognized source or need a hedge), (b) the Ahaz→Hezekiah `parent_of` link via `insertRelLocalToName` — confirm this successfully resolves to the live Hezekiah record and is textually correct, (c) Shear-Jashub's name-meaning gloss ("A remnant shall return") and Maher-shalal-hash-baz's ("Swift is the booty, speedy is the prey") against the text's own naming explanations, (d) whether "the prophetess" (Isaiah 8:3) is being correctly read as Isaiah's wife's title vs. a separate identification question some scholarship raises, (e) the `isaiah other ahaz_judah` relationship type choice — check consistency with this codebase's established use of `"other"` (per the Wisdom books audit's precedent research), (f) all 9 refs' chapter:verse ranges and note text, including whether the 4 "one of the kings during Isaiah's ministry" refs (each a single-verse 1:1 ref) are the right way to represent a shared superscription citation across 4 different people.
4. Triple-check: verify each finding once when found, then a second full pass before presenting findings.
5. Single audit pass — 7 people is comparable in size to Job/Esther.

## Findings report, correction & verification

Identical mechanism to prior books: findings document (`docs/superpowers/specs/2026-07-22-isaiah-data-audit-findings.md`), then `scripts/fix-isaiah-audit.ts` (same dry-run-gated pattern as `scripts/fix-wisdom-audit.ts`), controller reviews dry-run before live execution, then live verification via direct DB query (preferred given intermittent network issues observed in some prior books' dev-server routes) plus a curated-family roster check against `lib/families.ts`.

## Out of scope

- Any book other than this file's scope.
- Re-auditing Isaiah's and Hezekiah's own person records (loaded via `loadExisting`, originating elsewhere).
