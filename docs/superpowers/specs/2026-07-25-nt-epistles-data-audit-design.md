# NT Epistles People & Relationships Data Audit — Design

**Date:** 2026-07-25
**Status:** Approved

## Context

Twenty-ninth in the per-book audit series, ninth New Testament file. `scripts/seed-nt-epistles.ts` covers named co-workers, church leaders, and household members across Romans through Jude. It adds 28 new people (Phoebe, Andronicus, Junia, Rufus, Tertius, Chloe, Stephanas, Crispus, Gaius of Corinth, Epaphroditus, Euodia, Syntyche, Clement, Philemon, Apphia, Archippus, Onesimus, Epaphras, Nympha, Aristarchus, Lois, Eunice, Demas, Hymenaeus, Gaius of 3 John, Diotrephes, Demetrius, Jude) — 27 relationships (26 `insertRel`, 1 `insertRelNameToLocal`), 36 scripture refs. This file directly overlaps `scripts/seed-romans16.ts`'s source text (Romans 16) for five of its people (Phoebe, Andronicus, Junia, Rufus, Tertius, Gaius of Corinth) — the cross-seed people that file loaded but never used, confirming those loads were forward references to this file, not a gap.

**Notable risk carried over from the Romans 16 audit:** that audit found a systemic pattern where quoted phrases matched the NIV rather than the ESV. Since this file quotes several of the same Romans 16 verses (16:1-2, 16:7) plus material from Philippians, Philemon, Colossians, and 2 Timothy already partly checked in other audits, every quotation here should be verified fresh against the ESV rather than assumed correct because a similar-sounding phrase passed in another file.

## Scope

**In scope:**
- All 28 new people: name, alternate names, description (including every direct quotation), tags, gender.
- All 27 relationships.
- All 36 scripture refs.

**Out of scope:**
- Re-auditing Paul's, Timothy's, James the brother of Jesus's, John the Apostle's, or Peter's own person records (loaded via `loadExisting`, originating elsewhere) — only new relationships/refs referencing them are in scope.
- Any book/file other than this file's scope.

## Methodology (unchanged from prior books)

1. Enumerate every person/relationship/ref in `scripts/seed-nt-epistles.ts` (full file — 463 lines, read in one pass).
2. Cross-reference against ESV, fetched live, not recalled from memory: Romans 16:1-2 (Phoebe), 16:7 (Andronicus and Junia — a well-known, contested translation crux regarding female apostleship, where the ESV specifically reads "well known to the apostles" rather than "outstanding among the apostles"), 1 Corinthians 1:11-16 and 16:15-17 (Chloe, Stephanas, Crispus, Gaius), Philippians 2:25-30, 4:2-3, 4:18 (Epaphroditus, Euodia, Syntyche, Clement), Philemon 1:1-24 (Philemon, Apphia, Archippus, Onesimus, Epaphras, Aristarchus, Demas), Colossians 1:7, 4:9-17 (Epaphras, Onesimus, Nympha, Aristarchus, Demas), 2 Timothy 1:5, 4:10 (Lois, Eunice, Demas), 1 Timothy 1:20 and 2 Timothy 2:17-18 (Hymenaeus), 3 John 1:1, 1:9-12 (Gaius, Diotrephes, Demetrius), Jude 1:1 (Jude).
3. Prioritize: (a) Andronicus's and Junia's "outstanding among the apostles" quote (appearing in both their descriptions and both their scripture_refs notes) against the ESV's actual "well known to the apostles" — given this bears directly on the "apostle" tag and "Likely a female apostle" claim, treat the quote-fidelity fix and the tag/interpretive question as related but separate concerns: the quote must match the ESV regardless, while the tag question is a judgment call for the controller given this is a genuinely disputed translation crux, (b) Phoebe's "benefactor" vs the ESV's "patron," (c) Euodia's and Syntyche's "contended at his side in the cause of the gospel" against the ESV's "labored side by side with me in the gospel," (d) Epaphras's "dear"/"beloved" and "agonizing"/"struggling" against Colossians 1:7 and 4:12-13, (e) Demas's "having loved"/"in love with" against 2 Timothy 4:10 (appearing in both his description and his 2 Timothy ref note), (f) every other direct quotation's exact wording, (g) all 36 refs' chapter:verse ranges.
4. Triple-check: verify each finding once when found, then a second full pass before presenting findings — re-check every quoted phrase in the file a second time, given the systemic risk already established for this source material.
5. Single audit pass despite the file's size (28 people, the largest in the series) — as with prior large NT files, budget disproportionate time on quotation verification relative to the raw people count.

## Findings report, correction & verification

Identical mechanism to prior books: findings document (`docs/superpowers/specs/2026-07-25-nt-epistles-data-audit-findings.md`), then `scripts/fix-nt-epistles-audit.ts` (same dry-run-gated pattern as `scripts/fix-romans16-audit.ts`), controller reviews dry-run before live execution, then live verification via direct DB query plus a curated-family roster check against `lib/families.ts` (a pre-scan found none of this file's 28 people in any curated family).

## Out of scope

- Any book/file other than this file's scope.
- Re-auditing Paul's, Timothy's, James the brother of Jesus's, John the Apostle's, or Peter's own person records.
