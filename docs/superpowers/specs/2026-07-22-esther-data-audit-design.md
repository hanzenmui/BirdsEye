# Esther People & Relationships Data Audit — Design

**Date:** 2026-07-22
**Status:** Approved

## Context

Fifteenth in the per-book audit series (Genesis through Ezra-Nehemiah already merged — see their design specs for the established methodology, source, and fix-mechanism decisions, all reused unchanged here). `scripts/seed-esther.ts` adds 6 new people (Ahasuerus, Vashti, Mordecai, Esther, Haman, Hegai) — 10 relationships, 6 scripture refs, all confined to the book of Esther itself (no cross-seed lookups to pre-existing people).

## Scope

**In scope:**
- All 6 new people: name, alternate names, description, tags, gender.
- All 10 relationships in the file.
- All 6 scripture refs added by this file.

**Out of scope:**
- Any book other than this file's scope.
- The historical-identification question of which Persian king Ahasuerus corresponds to is in scope only insofar as the DB's own claim ("historically identified as Xerxes I, r. 486–465 BC") needs to be checked for accuracy — broader Persian-history claims outside what the description asserts are not in scope.

## Methodology (unchanged from prior books)

1. Enumerate every person/relationship/ref in `scripts/seed-esther.ts` (full file — 133 lines, read in one pass).
2. Cross-reference against ESV, fetched live, not recalled from memory: Esther 1 (Vashti's banquet refusal and deposal), Esther 2 (the search for a new queen, Esther chosen, Mordecai's plot discovery), Esther 3 (Haman's promotion, Mordecai's refusal to bow, the genocidal edict), Esther 4 (Mordecai's appeal, "such a time as this"), Esther 5-7 (Esther's banquets, Haman's gallows, his exposure and hanging), Esther 8-10 (the counter-edict, the Jews' self-defense, the institution of Purim).
3. Prioritize: (a) Ahasuerus's historical identification as Xerxes I and the reign dates (486–465 BC) — verify this is the standard scholarly identification and the dates are accurate, (b) the extent of the kingdom ("India to Ethiopia over 127 provinces") and the banquet's duration (180 days) against the text, (c) Mordecai's genealogy (son of Jair, descendant of Kish — verify this is the same Kish as Saul's father per Esther 2:5-6, a claim worth double-checking since the "same Kish" identification could be a scribal-genealogy or a common-name coincidence), (d) Haman's title "the Agagite" and its traditional link to King Agag/the Amalekites (1 Sam 15) — check whether the DB's "traditionally linked" hedge is appropriately cautious, (e) exact numeric/detail claims (Esther's beauty-treatment year, the gallows' height "75 feet," Haman's ten sons, Hegai's gift of seven maids), (f) all 6 refs' chapter:verse ranges and note text.
4. Triple-check: verify each finding once when found, then a second full pass before presenting findings.
5. Single audit pass — 6 people is one of the smaller books in this series, comparable to Ruth.

## Findings report, correction & verification

Identical mechanism to prior books: findings document (`docs/superpowers/specs/2026-07-22-esther-data-audit-findings.md`), then `scripts/fix-esther-audit.ts` (same dry-run-gated pattern as `scripts/fix-ezra-nehemiah-audit.ts`), controller reviews dry-run before live execution, then live verification via direct DB query (preferred given intermittent network issues observed in some prior books' dev-server routes) plus a curated-family roster check against `lib/families.ts`.

## Out of scope

- Any book other than this file's scope.
