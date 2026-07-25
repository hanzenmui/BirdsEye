# NT Gaps People & Relationships Data Audit — Design

**Date:** 2026-07-25
**Status:** Approved

## Context

Twenty-sixth in the per-book audit series, sixth New Testament file. Unlike prior narrative files, `scripts/seed-nt-gaps.ts` is a coverage-gap-filler: it adds 10 minor named individuals mentioned only in Paul's later epistles and the Johannine letters (Tychicus, Onesiphorus, Crescens, Linus, Claudia, Pudens, Alexander the coppersmith, Fortunatus, Achaicus, The Elect Lady) — 13 relationships, 36 scripture refs. Of the 36 refs, 14 attach to the 10 new people and 22 attach to 7 pre-existing cross-seed people (Paul, Timothy, Silas, Titus, James the brother of Jesus, Peter, John), adding scripture coverage to previously-zero-ref books (Ephesians, 1/2 Thessalonians, Titus, Hebrews, James, 1/2 Peter, 1/2/3 John, Galatians) without editing those 7 people's own person records.

## Scope

**In scope:**
- All 10 new people: name, alternate names, description, tags, gender.
- All 13 relationships.
- All 36 scripture refs, including the 22 attached to pre-existing people.

**Out of scope:**
- Re-auditing Paul's, Timothy's, Silas's, Titus's, James the brother of Jesus's, Peter's, or John's own person records (loaded via `loadExisting`/`loadExistingByAka`) — only the new refs/relationships this file adds referencing them are in scope.
- Any book/file other than this file's scope.

## Methodology (unchanged from prior books)

1. Enumerate every person/relationship/ref in `scripts/seed-nt-gaps.ts` (full file — 324 lines, read in one pass).
2. Cross-reference against ESV, fetched live, not recalled from memory: Ephesians 6:21, Colossians 4:7 (Tychicus), 2 Timothy 1:16-18, 4:10, 4:14, 4:19, 4:21 (Onesiphorus, Crescens, Alexander, Linus, Claudia, Pudens), 1 Timothy 1:20 (Alexander), 1 Corinthians 16:17-18 (Fortunatus, Achaicus, and specifically which verse mentions "refreshing" his spirit), 2 John 1:1 and 1:13 (the Elect Lady), Galatians 1:1 and 2:1, Ephesians 1:1, Philippians 1:1, 1/2 Thessalonians 1:1, Titus 1:4, Hebrews 13:23-24, James 1:1 and 2:14, 1 Peter 1:1 and 5:13, 2 Peter 1:1, 1 John 1:1.
3. Prioritize: (a) every direct quotation's exact ESV wording — this file's short entries lean heavily on brief quoted phrases, several citing name-form or preposition choices easy to misremember (e.g. "beloved"/"dear," "minister"/"servant," "elect"/"chosen," "at"/"in," "Simeon"/"Simon"), (b) 2 Peter 1:1's opening self-identification specifically — the ESV renders this "Simeon Peter," a different (and easily-confused) name-form than the "Simon Peter" used elsewhere in the NT, (c) whether the Fortunatus/Achaicus refs' chapter:verse range (1 Cor 16:17 only) actually covers the "refreshing his/my spirit" detail each of their own descriptions claims, given that detail is specifically in v18, not v17, (d) each hedge ("though this identification is not made in scripture itself" for Linus, "Possibly the same Alexander..." for Alexander the coppersmith, "Scholars debate whether this refers to a specific named woman..." for the Elect Lady) for accuracy, (e) all 36 refs' chapter:verse ranges.
4. Triple-check: verify each finding once when found, then a second full pass before presenting findings.
5. Single audit pass — 10 new people, each with very short (one-to-two-sentence) descriptions, keeps this comparable in size to Job/Esther despite the higher ref count.

## Findings report, correction & verification

Identical mechanism to prior books: findings document (`docs/superpowers/specs/2026-07-25-nt-gaps-data-audit-findings.md`), then `scripts/fix-nt-gaps-audit.ts` (same dry-run-gated pattern as `scripts/fix-nt-passion-audit.ts`), controller reviews dry-run before live execution, then live verification via direct DB query plus a curated-family roster check against `lib/families.ts` (a pre-scan found none of this file's 10 new people in any curated family).

## Out of scope

- Any book/file other than this file's scope.
- Re-auditing Paul's, Timothy's, Silas's, Titus's, James the brother of Jesus's, Peter's, or John's own person records.
