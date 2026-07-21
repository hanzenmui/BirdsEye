# Late Kings of Judah People & Relationships Data Audit — Design

**Date:** 2026-07-21
**Status:** Approved

## Context

Twelfth in the per-book audit series (Genesis through 2 Kings already merged — see their design specs for the established methodology, source, and fix-mechanism decisions, all reused unchanged here). `scripts/seed-late-kings.ts` is a small, focused seed script explicitly scoped out of the 2 Kings audit: it seeds the final four kings of Judah (Jehoahaz, Jehoiakim, Jehoiachin, Zedekiah — all sons of Josiah or grandsons through Jehoiakim) plus Shealtiel, the genealogical bridge from Jehoiachin (in exile) to Zerubbabel (the post-exilic governor), per its own header comment: "Fills the final gap in the Judah succession chain and completes the Adam→Jesus lineage." 5 new people, 13 relationships, 15 scripture refs — spanning 2 Kings 23-25, 2 Chronicles 36, Jeremiah 22/36/52, Matthew 1, Ezra 3, and 1 Chronicles 3.

This file explicitly loads three cross-seed people at the top (`loadCrossSeedPeople`): Josiah (from `seed-2kings.ts`, already audited), Nebuchadnezzar (also from `seed-2kings.ts`, already audited), and Zerubbabel (from whichever seed file introduces him — likely `seed-ezra-nehemiah.ts` or `seed-matthew-lineage.ts`, neither yet audited). The `shealtiel parent_of Zerubbabel` relationship is native to this file and in scope; Zerubbabel's own person record is not.

## Scope

**In scope:**
- All 5 new people: name, alternate names (each king has multiple — throne names vs. birth names, e.g. Jehoiakim/Eliakim, Zedekiah/Mattaniah, Jehoiachin/Jeconiah/Coniah), description, tags, gender.
- All 13 relationships in the file, including those referencing pre-existing people (Josiah, Nebuchadnezzar, Zerubbabel, Jeremiah).
- All 15 scripture refs added by this file, spanning five different books (2 Kings, 2 Chronicles, Jeremiah, Matthew, Ezra, 1 Chronicles).

**Out of scope:**
- Re-auditing Josiah/Nebuchadnezzar/Zerubbabel/Jeremiah's own person records (owned by their originating books).
- Any book other than this file's scope (2 Kings 23-25's final chapters, already excluded from the 2 Kings audit proper).

## Methodology (unchanged from prior books)

1. Enumerate every person/relationship/ref in `scripts/seed-late-kings.ts` (full file — 204 lines, read in one pass).
2. Cross-reference against ESV, fetched live, not recalled from memory: 2 Kings 23:31-34 (Jehoahaz), 23:34-24:7 (Jehoiakim), 24:8-17 and 25:27-30 (Jehoiachin), 24:17-25:7 (Zedekiah), plus 2 Chronicles 36 (parallel account), Jeremiah 22:10-12 (Jehoahaz), Jeremiah 36 (Jehoiakim burning the scroll), Jeremiah 52 (Zedekiah's capture), Matthew 1:11-12 (Jeconiah/Shealtiel in the genealogy), Ezra 3:2 and 1 Chronicles 3:17 (Shealtiel).
3. Prioritize: (a) each king's name-change (Eliakim→Jehoiakim by Pharaoh Neco; Mattaniah→Zedekiah by Nebuchadnezzar) is correctly attributed to the correct foreign king, (b) reign lengths and exact dates (Jehoahaz's 3 months, Jehoiachin's 3 months, Zedekiah's ~11 years, Jehoiachin's 37 years in Babylonian prison before release), (c) the sibling relationships among Josiah's sons are textually supported (which two of the three are full brothers vs. half-brothers, if the text specifies mothers), (d) the Shealtiel/Zerubbabel Matthew-genealogy bridge is accurate given the well-known textual tension between Matthew's and Luke's genealogies at this exact point (Matthew has Shealtiel as Jeconiah's son; 1 Chronicles 3:17-19 lists Pedaiah as Zerubbabel's father, with Shealtiel as his uncle — a genuine, long-documented crux worth checking whether the description states it as flatly settled), (e) all 15 refs' chapter:verse ranges and note text across five different books.
4. Triple-check: verify each finding once when found, then a second full pass before presenting findings.
5. Single audit pass — 5 people is one of the smallest books in this series (comparable to Deuteronomy's 2), so no section split needed, but the density of cross-references across five different biblical books warrants careful ref-by-ref verification.

## Findings report, correction & verification

Identical mechanism to prior books: findings document (`docs/superpowers/specs/2026-07-21-late-kings-data-audit-findings.md`), then `scripts/fix-late-kings-audit.ts` (same dry-run-gated pattern as `fix-2kings-audit.ts`), controller reviews dry-run before live execution, then live verification via direct DB query (given the sandboxed-network limitations observed intermittently in prior books' Task 3s, this may be preferred over the dev-server API route) plus a curated-family roster check against `lib/families.ts` — none of the current 9 curated families appear to include these late kings, but this must be actually checked.

## Out of scope

- Any book other than this file's scope.
- Re-auditing Josiah/Nebuchadnezzar/Zerubbabel/Jeremiah's own person records (owned by their originating books).
- Resolving the Matthew-vs-1-Chronicles Shealtiel/Zerubbabel/Pedaiah genealogical tension with new content beyond what this audit's findings determine is needed — this is a well-known scholarly crux, not necessarily a DB error.
