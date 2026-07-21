# Chronicles People & Relationships Data Audit — Design

**Date:** 2026-07-21
**Status:** Approved

## Context

Thirteenth in the per-book audit series (Genesis through Late Kings of Judah already merged — see their design specs for the established methodology, source, and fix-mechanism decisions, all reused unchanged here). `scripts/seed-chronicles.ts` is explicitly a gap-filling seed file per its own header comment: "1 & 2 Chronicles: Judah king lineage gaps, temple musicians/psalmists, David's warriors, prophets." It adds 13 new people across four groups: missing Judah kings bridging Rehoboam to the already-seeded Uzziah/Joash/Ahaziah/Hezekiah chain (Abijam, Asa, Jehoshaphat, Jehoram, Amaziah), David's three chief temple musicians (Asaph, Heman, Jeduthun), David's warrior Benaiah, and Chronicles-unique figures (Jabez, and the prophets Azariah son of Oded, Shemaiah, Hanani) — 20 relationships, 32 scripture refs (this book cites more Psalm superscriptions than any prior book in this series).

This file loads 11 cross-seed people at the top (`loadCrossSeedPeople`): David, Solomon, Rehoboam, Joash, Ahaziah of Judah, Hezekiah, Uzziah, Jotham, Ahaz, Athaliah, Josiah, and Korah (from Numbers) — all already seeded elsewhere. The relationships this file creates connecting to them are in scope; their own person records are not.

## Scope

**In scope:**
- All 13 new people: name, alternate names, description, tags, gender.
- All 20 relationships in the file, including those referencing the 11 pre-existing cross-seed people.
- All 32 scripture refs added by this file, spanning five books (1 Kings, 2 Kings, 2 Chronicles, 1 Chronicles, Psalms).

**Out of scope:**
- Re-auditing David/Solomon/Rehoboam/Joash/Ahaziah-of-Judah/Hezekiah/Uzziah/Jotham/Ahaz/Athaliah/Josiah/Korah's own person records (owned by their originating books).
- Any book other than this file's scope.

## Methodology (unchanged from prior books)

1. Enumerate every person/relationship/ref in `scripts/seed-chronicles.ts` (full file — 330 lines, read in one pass).
2. Cross-reference against ESV, fetched live, not recalled from memory: 1 Kings 15 (Abijam, Asa), 2 Chronicles 13-16 (Abijah's victory, Asa's reforms and the Ethiopian battle), 1 Kings 22 and 2 Chronicles 17-20 (Jehoshaphat), 2 Kings 8 and 2 Chronicles 21 (Jehoram of Judah, his marriage to Athaliah), 2 Kings 14 and 2 Chronicles 25 (Amaziah), 1 Chronicles 6, 15-16, 25 (the three chief musicians' genealogies and appointments), 1 Chronicles 11 and 27 and 1 Kings 2:35 (Benaiah), 1 Chronicles 4:9-10 (Jabez), 2 Chronicles 15 (Azariah son of Oded), 1 Kings 12 and 2 Chronicles 12 (Shemaiah), 2 Chronicles 16:7-10 (Hanani), plus the Psalm superscriptions cited (Psalms 39, 50, 62, 73-83, 77, 88, 89).
3. Prioritize: (a) the Judah king succession chain's dates and parent-child links, (b) Heman's "grandson of Samuel" claim — verify whether 1 Chronicles 6:33-38's actual genealogy directly supports "son of Joel, son of Samuel" or whether the file's "..." elision in the Korah-lineage relationship note skips generations that matter, (c) the Jeduthun/Ethan-the-Ezrahite identification — this is a traditional/scholarly harmonization (1 Chronicles 15:19 names the three cymbal-players as Heman, Asaph, and Ethan; later chapters use "Jeduthun") rather than an explicit textual equation, worth checking whether the DB's "Likely the same person" hedge is appropriately cautious or should be adjusted, (d) Benaiah's exploits' exact details (the lion in a pit on a snowy day, the Moabite champions, the Egyptian's spear size), (e) Heman's exact sons/daughters count (1 Chr 25:5, "fourteen sons and three daughters"), (f) all 32 refs' chapter:verse ranges and note text, including the Psalm citations.
4. Triple-check: verify each finding once when found, then a second full pass before presenting findings.
5. Single audit pass — 13 people is comparable to 1 Kings, but the 32 refs (more than any prior book) warrant careful per-ref verification, especially the Psalm citations which require checking psalm superscriptions rather than narrative text.

## Findings report, correction & verification

Identical mechanism to prior books: findings document (`docs/superpowers/specs/2026-07-21-chronicles-data-audit-findings.md`), then `scripts/fix-chronicles-audit.ts` (same dry-run-gated pattern as `scripts/fix-late-kings-audit.ts`), controller reviews dry-run before live execution, then live verification via direct DB query (preferred given intermittent network issues observed in some prior books' dev-server routes) plus a curated-family roster check against `lib/families.ts` — `david_family` in particular should be checked since this file heavily involves David's court.

## Out of scope

- Any book other than this file's scope.
- Re-auditing the 11 cross-seed people's own person records (owned by their originating books).
