# Job People & Relationships Data Audit — Design

**Date:** 2026-07-22
**Status:** Approved

## Context

Sixteenth in the per-book audit series (Genesis through Esther already merged — see their design specs for the established methodology, source, and fix-mechanism decisions, all reused unchanged here). `scripts/seed-job.ts` adds 5 new people (Job, and his three friends Eliphaz, Bildad, Zophar, plus the younger Elihu) — 6 relationships, 10 scripture refs, all confined to the book of Job itself (no cross-seed lookups to pre-existing people).

## Scope

**In scope:**
- All 5 new people: name, alternate names, description, tags, gender.
- All 6 relationships in the file.
- All 10 scripture refs added by this file.

**Out of scope:**
- Any book other than this file's scope.
- The historical/literary-genre debate over whether Job is a real historical figure or a wisdom-literature parable is out of scope unless the DB's own description makes a specific, checkable claim that bears on it — the DB currently treats Job as a real figure (consistent with how this codebase treats all OT figures), which is not itself a discrepancy to investigate.

## Methodology (unchanged from prior books)

1. Enumerate every person/relationship/ref in `scripts/seed-job.ts` (full file — 128 lines, read in one pass).
2. Cross-reference against ESV, fetched live, not recalled from memory: Job 1-2 (Job's character, wealth, the wager between God and the Adversary, the loss of children/livestock/health), Job 2:11-13 (the three friends' arrival and week of silence), Job 4-5, 15, 22 (Eliphaz's three speeches), Job 8, 18, 25 (Bildad's three speeches), Job 11, 20 (Zophar's two speeches), Job 32-37 (Elihu's speeches), Job 38-41 (God's speech from the whirlwind), Job 42 (the rebuke of the three friends, Job's intercession, restoration).
3. Prioritize: (a) Job's specific numeric wealth claims (7,000 sheep, 3,000 camels, 500 yoke of oxen, ten children) and their restoration figures in ch. 42, (b) each friend's geographic origin/title (Eliphaz the Temanite, Bildad the Shuhite, Zophar the Naamathite) and Elihu's fuller genealogy (son of Barachel the Buzite, of the family of Ram) — verify these are textually exact, (c) the specific claim that God rebukes the three friends but not Elihu at the end — verify Job 42:7-9 names only the three friends and Elihu is absent from the rebuke, (d) the claim that Zophar "only speaks twice... implying Job's responses silenced him" — check whether the text supports this as an inference worth stating or whether it overclaims, (e) each speech's chapter range attribution (confirm no chapter is misattributed between the three friends and Elihu, especially since Bildad's third speech, ch. 25, is unusually short and some study traditions merge parts of ch. 26-27 into it — check whether the DB's clean 25:1-6 range is textually accurate or whether that's a contested attribution worth a hedge), (f) all 10 refs' chapter:verse ranges and note text.
4. Triple-check: verify each finding once when found, then a second full pass before presenting findings.
5. Single audit pass — 5 people is one of the smaller books in this series, comparable to Esther/Ruth.

## Findings report, correction & verification

Identical mechanism to prior books: findings document (`docs/superpowers/specs/2026-07-22-job-data-audit-findings.md`), then `scripts/fix-job-audit.ts` (same dry-run-gated pattern as `scripts/fix-esther-audit.ts`), controller reviews dry-run before live execution, then live verification via direct DB query (preferred given intermittent network issues observed in some prior books' dev-server routes) plus a curated-family roster check against `lib/families.ts`.

## Out of scope

- Any book other than this file's scope.
