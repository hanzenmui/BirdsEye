# Ezra-Nehemiah People & Relationships Data Audit — Design

**Date:** 2026-07-22
**Status:** Approved

## Context

Fourteenth in the per-book audit series (Genesis through Chronicles already merged — see their design specs for the established methodology, source, and fix-mechanism decisions, all reused unchanged here). `scripts/seed-ezra-nehemiah.ts` adds 11 new people spanning three Persian kings (Cyrus, Darius, Artaxerxes), the first-return leadership (Sheshbazzar, Zerubbabel, Jeshua the high priest), Ezra, Nehemiah, and Nehemiah's three antagonists (Sanballat, Tobiah, Geshem) — 11 relationships, 18 scripture refs.

This book continues the Davidic/messianic line the Late Kings of Judah audit already verified: Zerubbabel is created here via `safeInsertPerson` (idempotent — if the Late Kings audit's `shealtiel parent_of Zerubbabel` relationship already created a Zerubbabel row via cross-seed lookup, this file reuses it rather than duplicating). This file also adds a long-range `Solomon ancestor_of Zerubbabel` relationship, distinct from and supplementary to the precise `Jehoiachin→Shealtiel→Zerubbabel` chain already established — worth confirming this is a legitimate, non-conflicting addition rather than a duplicate or contradictory claim.

## Scope

**In scope:**
- All 11 new people: name, alternate names, description, tags, gender.
- All 11 relationships in the file, including the `Solomon ancestor_of Zerubbabel` and `Ezra ally_of Nehemiah` relationships that reference pre-existing people by name lookup.
- All 18 scripture refs added by this file, spanning six books (Ezra, Isaiah, Nehemiah, Haggai, Zechariah).

**Out of scope:**
- Re-auditing Solomon's own person record (owned by 1 Kings) — only the relationship this file adds referencing him is in scope.
- Re-auditing Zerubbabel's fuller genealogical chain established by the Late Kings of Judah audit (Jehoiachin→Shealtiel→Zerubbabel) — only this file's own contributions (Zerubbabel's description, if changed here, and the new relationships) are in scope.
- Any book other than this file's scope.

## Methodology (unchanged from prior books)

1. Enumerate every person/relationship/ref in `scripts/seed-ezra-nehemiah.ts` (full file — 195 lines, read in one pass).
2. Cross-reference against ESV, fetched live, not recalled from memory: Ezra 1 (Cyrus's decree), Isaiah 44:28-45:1 (Cyrus named by prophecy), Ezra 5-6 (Darius confirms the decree), Ezra 7 (Artaxerxes authorizes Ezra), Nehemiah 2 (Artaxerxes sends Nehemiah), Ezra 2-6 (Sheshbazzar, Zerubbabel, Jeshua, the Temple rebuilding), Haggai 1-2 and Zechariah 3-4 (Zerubbabel/Jeshua's prophetic visions), Ezra 7-10 (Ezra's mission and the foreign-wife crisis), Nehemiah 1-13 (Nehemiah's wall, reforms, and the Sanballat/Tobiah/Geshem opposition), Nehemiah 8 (Ezra reads the Law).
3. Prioritize: (a) the exact timing/duration claims this book is dense with (Isaiah naming Cyrus "150+ years" before his birth — check whether this approximation holds up against standard datings of Isaiah's ministry and Cyrus's reign; Darius's "sixth year" Temple completion, Ezra's "seventh year" and Nehemiah's "twentieth year" of Artaxerxes; the wall built "in 52 days"), (b) the Sheshbazzar/Zerubbabel identification question's framing ("some scholars identify... most treat as separate") — verify this is an accurate characterization of the actual scholarly landscape, not an invented hedge, (c) the `Solomon ancestor_of Zerubbabel` relationship's textual basis and whether it's a legitimate supplementary long-range link (matching the pattern used elsewhere in this codebase for distant ancestor claims) rather than a duplicate/conflicting claim against the Late Kings audit's precise chain, (d) Sanballat/Tobiah/Geshem's specific details (their exact quoted taunts, Tobiah's Temple-room episode, the Ono plain meeting attempt), (e) all 18 refs' chapter:verse ranges and note text across the six cited books.
4. Triple-check: verify each finding once when found, then a second full pass before presenting findings.
5. Single audit pass — 11 people is comparable to 1 Kings/Ruth-sized books, so no section split needed.

## Findings report, correction & verification

Identical mechanism to prior books: findings document (`docs/superpowers/specs/2026-07-22-ezra-nehemiah-data-audit-findings.md`), then `scripts/fix-ezra-nehemiah-audit.ts` (same dry-run-gated pattern as `scripts/fix-chronicles-audit.ts`), controller reviews dry-run before live execution, then live verification via direct DB query (preferred given intermittent network issues observed in some prior books' dev-server routes) plus a curated-family roster check against `lib/families.ts`.

## Out of scope

- Any book other than this file's scope.
- Re-auditing Solomon's own person record (owned by 1 Kings) or Zerubbabel's fuller genealogical chain established by the Late Kings of Judah audit.
