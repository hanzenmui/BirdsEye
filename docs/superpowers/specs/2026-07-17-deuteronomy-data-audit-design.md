# Deuteronomy People & Relationships Data Audit — Design

**Date:** 2026-07-17
**Status:** Approved

## Context

Fourth of the planned per-book audit series (Genesis, Exodus, and Numbers already merged — see their design specs for the established methodology, source, and fix-mechanism decisions, all reused unchanged here). `scripts/seed-deuteronomy.ts` is much smaller than the prior three books: only 2 new people (Sihon, king of Heshbon; Og, king of Bashan — the two Transjordanian kings defeated before Israel's entry, Deut 2-3), 4 relationships, and 8 scripture refs. Most of Deuteronomy is Moses's farewell speeches — retrospective and legal material referencing people already seeded by earlier books (Moses, Joshua, Caleb), not new narrative characters.

## Scope

**In scope:**
- Both new people (Sihon, Og): name, description, tags, gender.
- All 4 relationships in the file (`sihon enemy_of og`, `sihon enemy_of moses`, `og enemy_of moses`, `manasseh ruler_of og`).
- All 8 scripture refs added by this file, including the ones attached to pre-existing people (Moses, Joshua, Caleb) — the refs themselves (book/chapter/verse and note text) are native to this file even though the people are not, so their accuracy is this audit's responsibility.

**Out of scope:**
- Re-auditing Moses/Joshua/Caleb's own person records (name, description, other relationships) — owned by whichever book originally seeded them.
- Named figures Deuteronomy mentions in passing but that this seed file does not model as relationships or new people (e.g., Balaam/Balak recalled in Deut 23:4-5, the sons of Anak in Deut 9:1-2, Miriam's death recalled in Deut 24:9, Aaron's death at Moserah in Deut 10:6) — flagged as candidate findings only if the existing prose in this file's descriptions or refs asserts something about them that the DB can't support (mirroring the "structural gap" pattern from Genesis/Exodus/Numbers), not as a mandate to seed new content for every name Deuteronomy mentions.
- Any book other than Deuteronomy.

## Methodology (unchanged from Genesis/Exodus/Numbers)

1. Enumerate every person/relationship/ref in `scripts/seed-deuteronomy.ts` (full file — it's only 160 lines).
2. Cross-reference against ESV, fetched live, not recalled from memory: Deuteronomy 1-3 (Sihon/Og, the farewell addresses' opening, Joshua's commissioning, Caleb's exception), Deuteronomy 31/34 (Moses's death, Joshua's commissioning), and Numbers 21:21-35 (the original Sihon/Og narrative Deuteronomy retells, since the file cites it directly).
3. Prioritize: (a) whether Sihon's and Og's descriptions match the text precisely (kingdom, defeat location, aftermath, the "iron bed" detail for Og), (b) whether the `manasseh ruler_of og` relationship is textually supported the way the file's own comment claims (Deut 3:13), (c) whether the Moses/Joshua/Caleb refs' chapter:verse ranges and note text are accurate.
4. Triple-check: verify each finding once when found, then a second full pass before presenting findings — the exact discipline the Genesis and Exodus audits established after undercounting relationships on first pass.
5. Single audit pass — this book is far smaller than Exodus (25 people) or Numbers (28 people), so no section split is needed.

## Findings report, correction & verification

Identical mechanism to Genesis/Exodus/Numbers: findings document (`docs/superpowers/specs/2026-07-17-deuteronomy-data-audit-findings.md`), then `scripts/fix-deuteronomy-audit.ts` (same dry-run-gated pattern as `fix-numbers-audit.ts`), controller reviews dry-run before live execution, then live verification via API pull plus a `buildForest` chain-completeness spot-check on any curated family this book's people intersect with (none of the current 9 curated families include Sihon or Og, so this step may simply confirm that and move on — same situation as Numbers).

## Out of scope

- Any book other than Deuteronomy.
- Re-auditing Moses/Joshua/Caleb's own person records (owned by their originating books).
- Seeding new people for names Deuteronomy mentions only in passing, unless this file's own existing content already asserts something about them the DB can't support.
