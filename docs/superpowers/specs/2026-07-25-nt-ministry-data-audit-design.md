# NT Ministry People & Relationships Data Audit — Design

**Date:** 2026-07-25
**Status:** Approved

## Context

Twenty-fourth in the per-book audit series, fourth New Testament file. `scripts/seed-nt-ministry.ts` covers the Twelve Apostles and key disciples/ministry figures across all four Gospels. It adds 21 new people (the Twelve: Peter, Andrew, James son of Zebedee, John, Philip, Bartholomew, Matthew, Thomas, James son of Alphaeus, Thaddaeus, Simon the Zealot, Judas Iscariot; the Bethany family: Mary Magdalene, Mary of Bethany, Martha, Lazarus; other ministry figures: Nicodemus, Zacchaeus, Jairus, Zebedee, Salome wife of Zebedee) — 26 relationships (10 via `insertRel`, 15 via `insertRelByName`, 1 via `insertRelNameToLocal`), 34 scripture refs. This is the densest file in direct-quotation content of any book audited so far — nearly every person's description contains one or more attributed quotations, raising the exact-wording verification bar well above the file's raw people count would suggest.

## Scope

**In scope:**
- All 21 new people: name, alternate names, description (including every direct quotation), tags, gender, birth/death years where given.
- All 26 relationships.
- All 34 scripture refs.

**Out of scope:**
- Re-auditing Jesus's own person record (referenced only via `insertRelByName`/`insertRelNameToLocal`, originating in `seed-nt-birth.ts`, already audited).
- Any book/file other than this file's scope.

## Methodology (unchanged from prior books)

1. Enumerate every person/relationship/ref in `scripts/seed-nt-ministry.ts` (full file — 299 lines, read in one pass).
2. Cross-reference against ESV, fetched live, not recalled from memory: John 1:35-51 (the calling of Andrew, Peter, Philip, Nathanael), Matthew 16:13-19 (Peter's confession), Mark 3:17 (Boanerges), Luke 9:54 (fire on Samaria), Acts 12:2 (James's martyrdom), Matthew 9:9-13 (Matthew's calling and banquet), John 11 (Lazarus, Martha's confession, "Lazarus, come out"), John 20:24-29 (Thomas), Mark 15:40 / Matthew 27:56 (the women at the cross, including how James son of Alphaeus/"the younger" is described), John 3:1-21 (Nicodemus), John 19:38-42 (Nicodemus and the burial spices), Luke 19:1-10 (Zacchaeus), Mark 5:21-43 (Jairus, "Talitha cumi"), Luke 10:38-42 (Martha and Mary), John 12:1-8 (Mary's anointing), John 20:11-18 (Mary Magdalene at the tomb), Matthew 26:14-27:10 (Judas).
3. Prioritize: (a) every direct quotation attributed to a person — verify word-for-word against the ESV, flagging both outright wrong words (paraphrase presented as verbatim quote) and quotes that drop an opening word/clause in a way that misrepresents where the quoted speech begins (per the precedent set by the NT birth narrative audit's Finding 1, Mary's dropped "Behold"), (b) parenthetical translation glosses of Aramaic/Greek phrases (e.g. "Talitha cumi") against the ESV's own translation of the phrase, not a different rendering, (c) each disambiguation hedge ("Not to be confused with Philip the Evangelist," "Not to be confused with Judas Iscariot," "Not to be confused with Salome daughter of Herodias," James son of Alphaeus's "the Less"/"the Younger" epithet against Mark 15:40's actual wording) — grep-confirm/verse-confirm each, (d) all 34 refs' chapter:verse ranges.
4. Triple-check: verify each finding once when found, then a second full pass before presenting findings.
5. Single audit pass despite the file's size (21 people, the second-largest narrative file after Prophets) — the volume of direct quotations means this pass should budget more time per person than a typical book of this size.

## Findings report, correction & verification

Identical mechanism to prior books: findings document (`docs/superpowers/specs/2026-07-25-nt-ministry-data-audit-findings.md`), then `scripts/fix-nt-ministry-audit.ts` (same dry-run-gated pattern as `scripts/fix-nt-birth-audit.ts`), controller reviews dry-run before live execution, then live verification via direct DB query plus a curated-family roster check against `lib/families.ts`.

## Out of scope

- Any book/file other than this file's scope.
- Re-auditing Jesus's own person record (originating in `seed-nt-birth.ts`).
