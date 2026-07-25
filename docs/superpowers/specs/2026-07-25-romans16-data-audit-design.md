# Romans 16 People & Relationships Data Audit — Design

**Date:** 2026-07-25
**Status:** Approved

## Context

Twenty-eighth in the per-book audit series, eighth New Testament file. `scripts/seed-romans16.ts` seeds 22 named individuals from Paul's greetings list in Romans 16:1-23 (Epaenetus, Mary of Rome, Ampliatus, Urbanus, Stachys, Apelles, Herodion, Tryphena, Tryphosa, Persis, Mother of Rufus, Asyncritus, Phlegon, Hermas, Patrobas, Hermes, Philologus, Julia, Nereus, Sister of Nereus, Olympas, Erastus) — 26 relationships (25 `insertRel`, 1 `insertRelLocalToName`), 24 scripture refs. It also loads 8 cross-seed people (`loadCrossSeedPeople`: Paul, Phoebe, Priscilla, Aquila, Andronicus, Junia, Rufus, Tertius, Gaius of Corinth), but only Paul and Rufus are actually used in any relationship this file creates — Phoebe, Andronicus, Junia, Tertius, and Gaius of Corinth's own person records and Romans 16 coverage are supplied by `scripts/seed-nt-epistles.ts` instead (confirmed by grep), so this is not a gap in this file's own scope.

**Notable pattern discovered during research:** nearly every quoted phrase in this file's descriptions diverges from the ESV in a way that matches the NIV's wording instead (e.g. "dear friend" where the ESV says "beloved," an added "very" where the ESV has none, "co-worker" where the ESV says "fellow worker"). This looks like a systemic sourcing issue — the file's quotes were apparently drawn from the NIV (or a paraphrase resembling it) rather than the ESV, this project's stated source of truth.

## Scope

**In scope:**
- All 22 new people: name, alternate names, description (including every direct quotation), tags, gender.
- All 26 relationships.
- All 24 scripture refs.

**Out of scope:**
- Re-auditing Paul's or Rufus's own person records (loaded via `loadExisting`, originating elsewhere) — only the new relationships/refs this file adds referencing them are in scope.
- Phoebe's, Priscilla's, Aquila's, Andronicus's, Junia's, Tertius's, or Gaius of Corinth's own person records — none are created by this file; their records and Romans 16 coverage belong to `scripts/seed-nt-epistles.ts`.
- Any book/file other than this file's scope.

## Methodology (unchanged from prior books)

1. Enumerate every person/relationship/ref in `scripts/seed-romans16.ts` (full file — 376 lines, read in one pass).
2. Cross-reference against ESV, fetched live, not recalled from memory: Romans 16:1-16 (the full greetings list, verse by verse) and Romans 16:21-23 (Erastus, Gaius, Tertius, Quartus).
3. Prioritize: (a) every direct quotation's exact ESV wording against each verse's actual text — given the discovered NIV-resembling pattern, treat every quoted phrase in this file as suspect until verse-confirmed, not just the ones that look unusual, (b) specifically check whether the "worked hard in the Lord" phrase attached to Tryphena's and Tryphosa's descriptions is actually the ESV's wording for them, or whether it's Persis's description (v12) misattributed, (c) Erastus's "director of public works" phrasing against Romans 16:23's actual "the city treasurer," (d) all 24 refs' chapter:verse ranges.
4. Triple-check: verify each finding once when found, then a second full pass before presenting findings — given the systemic nature of the issue found, the second pass should re-verify every single quoted phrase in the file against the fetched ESV text, not sample a subset.
5. Single audit pass — 22 new people, but each description is very short (one or two sentences, almost entirely built from a single quoted phrase), keeping the file's actual verification surface comparable to Job/Esther despite the high people count.

## Findings report, correction & verification

Identical mechanism to prior books: findings document (`docs/superpowers/specs/2026-07-25-romans16-data-audit-findings.md`), then `scripts/fix-romans16-audit.ts` (same dry-run-gated pattern as `scripts/fix-acts-audit.ts`), controller reviews dry-run before live execution, then live verification via direct DB query plus a curated-family roster check against `lib/families.ts` (a pre-scan found none of this file's 22 people in any curated family).

## Out of scope

- Any book/file other than this file's scope.
- Re-auditing Paul's or Rufus's own person records.
- Phoebe's, Priscilla's, Aquila's, Andronicus's, Junia's, Tertius's, or Gaius of Corinth's own person records (created and covered in `scripts/seed-nt-epistles.ts`, not this file).
