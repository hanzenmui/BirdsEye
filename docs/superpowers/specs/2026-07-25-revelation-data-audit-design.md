# Revelation People & Relationships Data Audit — Design

**Date:** 2026-07-25
**Status:** Approved

## Context

Thirtieth and final book in the per-book audit series, tenth New Testament file. `scripts/seed-revelation.ts` covers Revelation's named individuals: Antipas, Jezebel of Thyatira, and the collective "Seven Churches" of Asia Minor. It adds 3 new people — 3 relationships, 9 scripture refs (7 on new people, 2 adding Revelation coverage to the pre-existing John and Jesus records). This is the smallest file in the series by people count, closing out the systematic audit that began with Genesis.

## Scope

**In scope:**
- All 3 new people: name, alternate names, description, tags, gender.
- All 3 relationships.
- All 9 scripture refs, including the 2 attached to the pre-existing John and Jesus records.

**Out of scope:**
- Re-auditing John's or Jesus's own person records (loaded via `loadExisting`, originating elsewhere) — only the new refs this file adds referencing them are in scope.
- Any book/file other than this file's scope.

## Methodology (unchanged from prior books)

1. Enumerate every person/relationship/ref in `scripts/seed-revelation.ts` (full file — 163 lines, read in one pass).
2. Cross-reference against ESV, fetched live, not recalled from memory: Revelation 2:13 (Antipas), 2:20-25 (Jezebel of Thyatira), 1:11 (the seven churches' names and order), 22:8 (John's closing self-identification), 1:12-18 (the vision of the Son of Man), 19:11-16 (the Rider on the white horse and the "King of kings and Lord of lords" title).
3. Prioritize: (a) Antipas's quotation against Revelation 2:13's exact wording, (b) Jezebel's "calls herself a prophet" against Revelation 2:20's actual "calls herself a prophetess" — checking both her own description and her scripture_refs note, (c) the "not the OT Jezebel (wife of Ahab)" disambiguation — grep-confirm the OT Jezebel exists elsewhere in the DB, (d) the seven churches' names and order against Revelation 1:11, (e) John's closing quote against Revelation 22:8, (f) all 9 refs' chapter:verse ranges.
4. Triple-check: verify each finding once when found, then a second full pass before presenting findings.
5. Single audit pass — the smallest file in the entire series (3 new people), completed in one pass alongside the final triple-check.

## Findings report, correction & verification

Identical mechanism to prior books: findings document (`docs/superpowers/specs/2026-07-25-revelation-data-audit-findings.md`), then `scripts/fix-revelation-audit.ts` (same dry-run-gated pattern as `scripts/fix-nt-epistles-audit.ts`), controller reviews dry-run before live execution, then live verification via direct DB query plus a curated-family roster check against `lib/families.ts` (a pre-scan found none of this file's 3 people in any curated family). This closes out the per-book audit series that began with Genesis.

## Out of scope

- Any book/file other than this file's scope.
- Re-auditing John's or Jesus's own person records.
