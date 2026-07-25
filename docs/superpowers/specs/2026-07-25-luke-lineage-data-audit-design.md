# Luke Lineage (3:23-38) People & Relationships Data Audit — Design

**Date:** 2026-07-25
**Status:** Approved

## Context

Twenty-second in the per-book audit series, second New Testament file. `scripts/seed-luke-lineage.ts` seeds the David-to-Jesus stretch of Luke's genealogy (Luke 3:23-31, the "Nathan line," plus the post-exilic Rhesa-to-Heli stretch at 3:24-27) — the largest file in the series so far by people count. It adds 38 new people (name/alsoKnownAs/description/tags/gender each), 40 relationships (39 via the standard helper functions, plus 1 via a raw `db.execute` call for Heli→Joseph husband of Mary), and 41 scripture refs (39 via the standard helper, plus 2 via raw `db.execute` calls adding refs to the pre-existing John the Baptist and Jesus records). It also loads 3 pre-existing cross-seed people (`loadCrossSeedPeople`): David, Shealtiel, and Zerubbabel — adding only new relationships/refs to them, not editing their own person records. This file deliberately does not touch Luke 3:32-38 (David's own ancestors back to Adam) since that portion overlaps the OT genealogy already covered by Genesis/Ruth/Matthew-lineage's seed files — a scope boundary the file's own code respects even though its header comment loosely says "Luke 3:23–38."

## Scope

**In scope:**
- All 38 new people, including the "known only from this genealogical record" hedges and every disambiguation note against same-named figures elsewhere in the DB (e.g. "Not Eliezer son of Moses," "Not the prophet Amos," "One of two men named Melchi in Luke's list").
- All 40 relationships, including the `insertRelLocalToName` link (Neri→Shealtiel) and `insertRelNameToLocal` link (Zerubbabel→Rhesa), and the raw-SQL Heli→Joseph (husband of Mary) relationship.
- All 41 scripture refs, including the 2 raw-SQL refs added to the pre-existing John the Baptist and Jesus records (Luke 3:1-22 and 3:21-22).

**Out of scope:**
- Re-auditing David's, Shealtiel's, or Zerubbabel's own person records (loaded via `loadExisting`/`loadExistingByAka`) — only new relationships/refs referencing them are in scope.
- Luke 3:32-38 (David's ancestors back to Adam) — not touched by this file at all.
- Any book/file other than this file's scope.

## Methodology (unchanged from prior books)

1. Enumerate every person/relationship/ref in `scripts/seed-luke-lineage.ts` (full file — 676 lines, read in one pass).
2. Cross-reference against ESV, fetched live, not recalled from memory: the complete text of Luke 3:23-31 and 3:24-27 (name-by-name, verse-by-verse — this is a long unbroken genealogical chain where a single transposed or misspelled name breaks the audit), Matthew 1:12 (for the Shealtiel/Jechoniah cross-reference in Neri's description), 1 Chronicles 3:5 (Nathan as David's son by Bathsheba), and Luke 3:1-22 (John the Baptist's ministry and Jesus's baptism, for the two raw-SQL refs).
3. Prioritize: (a) exact name spelling and chain order for all 38 names against the ESV text, verse by verse — given the chain's length, systematically walk both directions (Jesus-to-David per the text's own order, and David-to-Jesus per the DB's `parent_of` direction) to catch any transposition, (b) the two `matthias_luke_upper`/`matthias_luke_lower` people's name spelling against the ESV's actual rendering at Luke 3:25-26, (c) Neri's description's and the Neri→Shealtiel relationship note's claim about what "Matthew says" the name of Shealtiel's father is, against Matthew 1:12's actual wording, (d) each disambiguation hedge ("Not Eliezer son of Moses," "Not the prophet Amos," "Not the prophet Nahum," "Not the patriarch Levi/Judah," "Not Joshua son of Nun," "Not Er son of Judah," "Not Simeon of Jerusalem," "Not the OT patriarch Joseph nor NT Joseph husband of Mary," "Different from the apostle Matthias") — grep-confirm each referenced figure actually exists elsewhere in the DB under that description, (e) all 41 refs' chapter:verse ranges against the verse each name actually appears in, (f) the two raw-SQL ref/relationship additions (outside the standard helpers) for correctness, since they're more easily overlooked in a review than the pattern-following majority.
4. Triple-check: verify each finding once when found, then a second full pass before presenting findings — given the chain's length, this second pass should re-walk the full name sequence once more end to end.
5. Single audit pass despite the file's size (38 people is the largest in the series) — nearly all descriptions are short, formulaic one-or-two-sentence "known only from this genealogical record" entries, so the actual verification surface per person is small even though the count is high.

## Findings report, correction & verification

Identical mechanism to prior books: findings document (`docs/superpowers/specs/2026-07-25-luke-lineage-data-audit-findings.md`), then `scripts/fix-luke-lineage-audit.ts` (same dry-run-gated pattern as `scripts/fix-matthew-lineage-audit.ts`), controller reviews dry-run before live execution, then live verification via direct DB query (preferred given intermittent network issues observed in some prior books' dev-server routes) plus a curated-family roster check against `lib/families.ts` (`jesus_family` includes Joseph husband of Mary, whom this file's Heli relationship points to — worth explicit attention even though Joseph's own record isn't edited).

## Out of scope

- Any book/file other than this file's scope.
- Re-auditing David's, Shealtiel's, or Zerubbabel's own person records (loaded via `loadExisting`/`loadExistingByAka`, originating elsewhere).
- Luke 3:32-38, not touched by this file.
