# 1 Kings People & Relationships Data Audit — Design

**Date:** 2026-07-20
**Status:** Approved

## Context

Tenth in the per-book audit series (Genesis through 2 Samuel already merged — see their design specs for the established methodology, source, and fix-mechanism decisions, all reused unchanged here). `scripts/seed-1kings.ts` adds 13 new people spanning three narrative arcs: David's final days and Solomon's succession (Adonijah, Solomon), the divided kingdom's founding (Rehoboam, Jeroboam, Ahijah the prophet, and the international figures Hiram of Tyre and the Queen of Sheba), and the Elijah/Ahab era (Elijah, Ahab, Jezebel, Obadiah the steward, Naboth, Ben-hadad) — 18 relationships, 13 scripture refs.

This book continues directly from David's family (2 Samuel) — Adonijah and Solomon are both David's sons by name, and Bathsheba's motherhood of Solomon is reasserted here with its own citation.

## Scope

**In scope:**
- All 13 new people: name, alternate names, description, tags, gender.
- All 18 relationships in the file, including those referencing pre-existing people (David, Bathsheba, Nathan, Judah).
- All 13 scripture refs added by this file.

**Out of scope:**
- Re-auditing David/Bathsheba/Nathan/Judah's own person records (owned by their originating books) — only the relationships this file adds referencing them are in scope.
- Any book other than 1 Kings.

## Methodology (unchanged from prior books)

1. Enumerate every person/relationship/ref in `scripts/seed-1kings.ts` (full file — 223 lines, read in one pass).
2. Cross-reference against ESV, fetched live, not recalled from memory: 1 Kings 1-2 (Adonijah's bid, Solomon's coronation), 3-11 (Solomon's wisdom, the Temple, Hiram, the Queen of Sheba, Solomon's wives and decline), 12 (the kingdom's split, Rehoboam, Jeroboam), 11:26-40 and 14:1-18 (Ahijah's prophecies to and against Jeroboam), 16-22 (Ahab, Jezebel, Elijah, Obadiah, Naboth, Ben-hadad).
3. Prioritize: (a) numeric/physical details this book is dense with (Solomon's 700 wives/300 concubines, the Queen of Sheba's 120 talents of gold, the twelve pieces of Ahijah's torn cloak, the twenty towns given to Hiram and their "Cabul" naming, the count of prophets Obadiah hid — "fifties in a cave," per 1 Kgs 18:4, totaling roughly 100), (b) Jezebel's father Ethbaal and her title as princess of Sidon, matching 1 Kgs 16:31 precisely, (c) the Rehoboam/Jeroboam split's causal sequence and Ahijah's role, (d) Elijah's Carmel/Horeb/Naboth narrative details, (e) all 13 refs' chapter:verse ranges and note text.
4. Triple-check: verify each finding once when found, then a second full pass before presenting findings.
5. Single audit pass — 13 people is comparable to Joshua/Deuteronomy-sized books, smaller than 1-2 Samuel, so no section split needed.

## Findings report, correction & verification

Identical mechanism to prior books: findings document (`docs/superpowers/specs/2026-07-20-1kings-data-audit-findings.md`), then `scripts/fix-1kings-audit.ts` (same dry-run-gated pattern as `fix-2samuel-audit.ts`), controller reviews dry-run before live execution, then live verification via API pull (or direct DB query if a subagent hits the sandboxed-network limitation observed in prior books' Task 3s) plus a `buildForest` chain-completeness spot-check on any curated family this book's people intersect with — none of the current 9 curated families in `lib/families.ts` are 1-Kings-sourced as far as prior audits established, but this must be actually checked, not assumed.

## Out of scope

- Any book other than 1 Kings.
- Re-auditing David/Bathsheba/Nathan/Judah's own person records (owned by their originating books).
