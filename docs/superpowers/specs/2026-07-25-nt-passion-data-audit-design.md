# NT Passion People & Relationships Data Audit — Design

**Date:** 2026-07-25
**Status:** Approved

## Context

Twenty-fifth in the per-book audit series, fifth New Testament file. `scripts/seed-nt-passion.ts` covers the religious and political authorities of the Passion narrative: the high priestly family, Roman and Herodian authorities, and other passion-narrative figures. It adds 10 new people (Annas, Caiaphas, Pontius Pilate, Herod Antipas, Herodias, Salome daughter of Herodias, Barabbas, Joseph of Arimathea, Simon of Cyrene, Herod Agrippa I) — 17 relationships (4 `insertRel`, 10 `insertRelByName`, 1 `insertRelLocalToAka`, 2 `insertRelNameToLocal`), 17 scripture refs. Notably, this file's own `salome_herodias` person record already correctly hedges "Her name is not given in the Gospels but is supplied by the historian Josephus" — the same issue flagged as Important in the NT birth narrative audit's Finding 3 for a *different* Salome reference, confirming that finding's correction direction was right and giving a same-series precedent to check against.

## Scope

**In scope:**
- All 10 new people: name, alternate names, description, tags, gender, birth/death years where given.
- All 17 relationships.
- All 17 scripture refs.

**Out of scope:**
- Re-auditing Jesus's, John the Baptist's, Peter's, James son of Zebedee's, Nicodemus's, or Herod the Great's own person records (referenced only via relationship helpers, originating in earlier NT files, already audited).
- Any book/file other than this file's scope.

## Methodology (unchanged from prior books)

1. Enumerate every person/relationship/ref in `scripts/seed-nt-passion.ts` (full file — 228 lines, read in one pass).
2. Cross-reference against ESV, fetched live, not recalled from memory: John 11:49-53 and John 18:13-28 (Annas, Caiaphas), Matthew 26:57-68 (the night trial), Matthew 27 and John 18:28-19:22 (Pilate's trial, his wife's dream, the hand-washing, the cross inscription and its languages), Luke 13:31-33 ("that fox"), Luke 23:7-12 (Herod Antipas at the trial), Matthew 14:1-12 and Mark 6:14-29 (John's execution, Herodias, Salome), Matthew 27:15-26 (Barabbas), Mark 15:43 / Luke 23:50-51 / John 19:38-42 (Joseph of Arimathea), Matthew 27:32 / Mark 15:21 (Simon of Cyrene), Acts 12:1-24 (Herod Agrippa I).
3. Prioritize: (a) every direct quotation's exact ESV wording, per this series' established pattern, (b) the cross inscription's language list (John 19:20) — verify whether the ESV's primary text says "Hebrew" or "Aramaic" (a known ESV translation choice with a footnote alternate), not assumed from memory or another translation, (c) Acts 12:23's exact wording for Herod Agrippa I's death, (d) each disambiguation hedge ("Not to be confused with Herod the Great or Herod Agrippa I," "Not to be confused with Salome wife of Zebedee," "Not to be confused with Herod the Great, Herod Antipas, or Herod Agrippa II") — verse/grep-confirm each, (e) all 17 refs' chapter:verse ranges.
4. Triple-check: verify each finding once when found, then a second full pass before presenting findings.
5. Single audit pass — 10 new people is comparable in size to Job/Esther/Isaiah/Daniel/NT birth.

## Findings report, correction & verification

Identical mechanism to prior books: findings document (`docs/superpowers/specs/2026-07-25-nt-passion-data-audit-findings.md`), then `scripts/fix-nt-passion-audit.ts` (same dry-run-gated pattern as `scripts/fix-nt-ministry-audit.ts`), controller reviews dry-run before live execution, then live verification via direct DB query plus a curated-family roster check against `lib/families.ts` (a pre-scan found none of this file's 10 people in any curated family).

## Out of scope

- Any book/file other than this file's scope.
- Re-auditing Jesus's, John the Baptist's, Peter's, James son of Zebedee's, Nicodemus's, or Herod the Great's own person records.
