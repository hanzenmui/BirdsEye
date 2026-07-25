# Acts People & Relationships Data Audit — Design

**Date:** 2026-07-25
**Status:** Approved

## Context

Twenty-seventh in the per-book audit series, seventh New Testament file, and the largest single file audited so far by people count. `scripts/seed-acts.ts` covers the book of Acts and the early church. It adds 23 new people (Paul, Stephen, Barnabas, James the Lord's brother, Philip the Evangelist, Matthias, Ananias husband of Sapphira, Sapphira, Ananias of Damascus, Cornelius, Silas, Timothy, Mark, Luke, Titus, Priscilla, Aquila, Apollos, Gamaliel, Felix, Festus, Herod Agrippa II, Lydia) — 26 relationships (20 `insertRel`, 5 `insertRelByName`, 1 `insertRelNameToLocal`), 29 scripture refs. This file is even denser in direct quotations than the NT ministry file, spanning the whole book of Acts plus several epistle cross-references (2 Timothy, Romans, 1/2 Corinthians, Galatians, John).

## Scope

**In scope:**
- All 23 new people: name, alternate names, description, tags, gender, birth/death years where given.
- All 26 relationships.
- All 29 scripture refs.

**Out of scope:**
- Re-auditing Jesus's, Peter's, Herod Agrippa I's, or John the Baptist's own person records (referenced only via relationship helpers, originating in earlier NT files, already audited).
- Any book/file other than this file's scope.

## Methodology (unchanged from prior books)

1. Enumerate every person/relationship/ref in `scripts/seed-acts.ts` (full file — 310 lines, read in one pass).
2. Cross-reference against ESV, fetched live, not recalled from memory: Acts 7:58-60 (Stephen's death), Acts 9:1-19 (Paul's conversion, Ananias of Damascus), Acts 5:1-11 (Ananias and Sapphira), Acts 10 (Cornelius), Acts 5:33-40 (Gamaliel's speech), Acts 15 (Jerusalem Council, James), Acts 16 (Lydia, Silas, Timothy), Acts 18 (Priscilla, Aquila, Apollos), Acts 24-26 (Felix, Festus, Agrippa II), John 7:5 (James's initial unbelief), 1 Timothy 1:2 (Timothy), 2 Timothy 4:7-11 (Paul's closing words, Mark, Luke), Romans 16:3-4 (Priscilla and Aquila).
3. Prioritize: (a) every direct quotation's exact ESV wording, per this series' established pattern — this file's sheer quote density (nearly every person has at least one) makes this the dominant risk, (b) Jesus's words to Saul on the Damascus road (Acts 9:4) — verify present-continuous vs. simple-present tense ("are you persecuting" vs. "do you persecute"), (c) Festus's exclamation (Acts 26:24) — verify whether the ESV's repeated "out of your mind" is preserved or replaced with a synonym, (d) James's John 7:5 citation — verify word order against the ESV's actual negation construction, (e) Mark's "useful to me for ministry" (2 Tim 4:11) — check whether "very" is present in the ESV and retained in the quote, (f) whether prose citations that name a single verse (e.g. "Romans 16:3") actually confine the quoted material to that verse or silently span into the next, (g) all 29 refs' chapter:verse ranges.
4. Triple-check: verify each finding once when found, then a second full pass before presenting findings — given this file's size, the second pass should specifically re-check every direct quotation once more against its cited verse.
5. Single audit pass despite the file's size (23 people, the largest in the series) — as with NT ministry, budget disproportionate time on quotation verification relative to the raw people count.

## Findings report, correction & verification

Identical mechanism to prior books: findings document (`docs/superpowers/specs/2026-07-25-acts-data-audit-findings.md`), then `scripts/fix-acts-audit.ts` (same dry-run-gated pattern as `scripts/fix-nt-gaps-audit.ts`), controller reviews dry-run before live execution, then live verification via direct DB query plus a curated-family roster check against `lib/families.ts` (a pre-scan found none of this file's 23 people in any curated family).

## Out of scope

- Any book/file other than this file's scope.
- Re-auditing Jesus's, Peter's, Herod Agrippa I's, or John the Baptist's own person records.
