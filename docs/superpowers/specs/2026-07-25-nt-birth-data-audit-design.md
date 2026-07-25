# NT Birth Narrative People & Relationships Data Audit — Design

**Date:** 2026-07-25
**Status:** Approved

## Context

Twenty-third in the per-book audit series, third New Testament file. `scripts/seed-nt-birth.ts` covers the birth and infancy narratives of Matthew 1-2 and Luke 1-2. It adds 9 new people (Zechariah father of John the Baptist, Elizabeth, John the Baptist, Jesus, Mary, Joseph husband of Mary, Simeon of Jerusalem, Anna the prophetess, Herod the Great) — 15 relationships (11 via the standard `insertRel` helper, 4 via `insertRelByName` cross-seed lookups to David/Abraham/Zerubbabel/Boaz), 18 scripture refs. Unlike the two prior NT files (pure genealogy gap-fillers), this file is narrative-style like the OT person-books, with substantive descriptive claims and direct quotations to verify.

## Scope

**In scope:**
- All 9 new people: name, alternate names, description, tags, gender, birth/death years where given.
- All 15 relationships, including the 4 `insertRelByName` cross-seed links (David/Abraham/Zerubbabel/Boaz → Jesus, `ancestor_of`) and the `elizabeth other mary_mother` / `john_baptist other jesus` relationships characterizing their kinship.
- All 18 scripture refs.

**Out of scope:**
- Re-auditing David's, Abraham's, Zerubbabel's, or Boaz's own person records (referenced only via `insertRelByName`, originating elsewhere).
- Any book/file other than this file's scope.

## Methodology (unchanged from prior books)

1. Enumerate every person/relationship/ref in `scripts/seed-nt-birth.ts` (full file — 201 lines, read in one pass).
2. Cross-reference against ESV, fetched live, not recalled from memory: Luke 1 (Zechariah's vision, Elizabeth's conception, the Annunciation to Mary at 1:26-38, Mary's visit and Elizabeth's exclamation at 1:39-45, the Magnificat, John's birth and the Benedictus), Luke 2 (the census, Jesus's birth, the shepherds, Simeon's Nunc Dimittis at 2:29-32 and his prophecy to Mary at 2:35, Anna at 2:36-38, the boy Jesus in the Temple), Matthew 1-2 (Joseph's dilemma and the angel's dream, the magi, Herod's reaction, the massacre of the innocents, the flight to Egypt), Matthew 11:14 and Malachi 4:5 (the "Elijah who is to come" identification — checking which verse the exact phrase belongs to), and Matthew 14:1-12 / Mark 6:14-29 (Herod Antipas, Herodias, and the dance before John's beheading — checking whether the dancer is actually named in the Gospel text).
3. Prioritize: (a) every direct quotation attributed to a person (Elizabeth's "Blessed are you among women...," Mary's "I am the servant of the Lord...," Simeon's Nunc Dimittis and sword prophecy) — verify each against the ESV's exact wording, flagging both wrong words and quietly-truncated quotes presented as continuous, (b) the "Elijah who is to come" phrase attributed to Malachi 4:5 in John the Baptist's description — verify which verse actually contains this exact wording, (c) whether "Salome" (named in John the Baptist's description as the dancer who prompted his execution) actually appears anywhere in the Gospel accounts of the episode, or is an extra-biblical detail (from Josephus) being presented as scriptural narrative, (d) the `elizabeth other mary_mother` relationship's Greek citation (συγγενής/Luke 1:36) — verify the English word Luke 1:36 actually uses for their relation, (e) Anna's "84 years (or aged 84)" hedge against Luke 2:36-37's text and footnote, (f) each disambiguation hedge (Zechariah "not to be confused with the OT prophet... or Zechariah son of Jehoiada," Simeon "not to be confused with Simeon son of Jacob," Joseph "not to be confused with Joseph son of Jacob") — grep-confirm each referenced figure exists elsewhere in the DB, (g) all 18 refs' chapter:verse ranges.
4. Triple-check: verify each finding once when found, then a second full pass before presenting findings.
5. Single audit pass — 9 new people is comparable in size to Job/Esther/Isaiah/Daniel, though this file's density of direct quotations (four separate attributed quotes) raises the verification bar per person above those books' average.

## Findings report, correction & verification

Identical mechanism to prior books: findings document (`docs/superpowers/specs/2026-07-25-nt-birth-data-audit-findings.md`), then `scripts/fix-nt-birth-audit.ts` (same dry-run-gated pattern as `scripts/fix-luke-lineage-audit.ts`), controller reviews dry-run before live execution, then live verification via direct DB query plus a curated-family roster check against `lib/families.ts` (`jesus_family` includes several of this file's own people — Joseph, Mary, Jesus, Elizabeth, Zechariah, John the Baptist — the first file in the NT portion of this series where a curated family is directly, not just tangentially, affected).

## Out of scope

- Any book/file other than this file's scope.
- Re-auditing David's, Abraham's, Zerubbabel's, or Boaz's own person records.
