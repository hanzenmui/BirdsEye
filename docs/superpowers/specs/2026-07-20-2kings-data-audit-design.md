# 2 Kings People & Relationships Data Audit — Design

**Date:** 2026-07-20
**Status:** Approved

## Context

Eleventh in the per-book audit series (Genesis through 1 Kings already merged — see their design specs for the established methodology, source, and fix-mechanism decisions, all reused unchanged here). `scripts/seed-2kings.ts` is one of the largest and richest books audited: 22 new people spanning Elisha's ministry (Elisha, Gehazi, Naaman), Jehu's revolution, the Athaliah/Joash/Jehoiada succession crisis, the Hezekiah/Isaiah/Sennacherib Assyrian crisis, and the final kings of both Israel and Judah leading to their respective falls (Manasseh, Josiah, the Omride successors Ahaziah/Joram, Jeroboam II, Amon, Huldah, Pekah, Hoshea, Zechariah son of Jehoiada) — 31 relationships, 22 scripture refs.

This book is dense with "Not to be confused with" disambiguation notes (multiple same-named kings: Ahaziah of Israel vs. Judah, Joram/Jehoram of Israel vs. Judah, Jeroboam I vs. II, Amon king vs. the Egyptian god, Manasseh king vs. Manasseh son of Joseph, Zechariah son of Jehoiada vs. the post-exilic prophet Zechariah) — each of these pairings is worth confirming both halves are correctly kept distinct in the live DB, not just correctly worded in this file's prose.

Note: `scripts/seed-late-kings.ts` (Jehoahaz, Jehoiakim, Jehoiachin, Zedekiah, and Shealtiel — the final kings of Judah through the Babylonian exile, chapters 23-25) is a separate seed script that continues 2 Kings' narrative and is explicitly documented in its own header as "fills the final gap in the Judah succession chain." Per this series' established one-seed-file-per-book convention, it will be audited as its own subsequent pass immediately following this one, not combined into this audit.

## Scope

**In scope:**
- All 22 new people: name, alternate names, description, tags, gender.
- All 31 relationships in the file, including those referencing pre-existing people (Ahab, Jezebel, Elijah, Solomon, Jonah, Jeremiah — from earlier books).
- All 22 scripture refs added by this file, including the one citing 2 Chronicles rather than 2 Kings (Zechariah son of Jehoiada, 2 Chr 24:20-22) — in scope because the ref is native to this file, matching the precedent from Ruth's cross-book Rahab ref and Joshua's cross-book ancestry chains.

**Out of scope:**
- Re-auditing Ahab/Jezebel/Elijah/Solomon/Jonah/Jeremiah's own person records (owned by their originating books) — only the relationships this file adds referencing them are in scope.
- `scripts/seed-late-kings.ts` (a separate, subsequent audit).
- Any book other than 2 Kings.

## Methodology (unchanged from prior books)

1. Enumerate every person/relationship/ref in `scripts/seed-2kings.ts` (full file — 309 lines, read in one pass).
2. Cross-reference against ESV, fetched live, not recalled from memory: 2 Kings 2 (Elijah's whirlwind, Elisha's call), 4-5 (Elisha's miracles, Naaman, Gehazi), 8-11 (Jehu's revolution, Athaliah's coup, Joash's coronation), 12 (Joash's Temple repair and later apostasy — plus 2 Chronicles 24 for Zechariah's stoning, since that incident's fuller narrative is in Chronicles), 14 (Jeroboam II, Amaziah), 15 (Pekah), 17 (Hoshea, Samaria's fall), 18-20 (Hezekiah, Sennacherib, Isaiah), 21 (Manasseh, Amon), 22-23 (Josiah, Huldah).
3. Prioritize: (a) each "Not to be confused with" disambiguation pairing is textually accurate and the two figures remain genuinely distinct in the live DB (no accidental merge risk), (b) numeric/physical details this book is dense with (Jehu's "seventy sons" of Ahab, the 185,000 Assyrians, Manasseh's 55-year reign, Hezekiah's 15 additional years, Josiah's age-eight accession and eighteenth-year reform, Amon's 2-year reign, Jehoiada's age at death), (c) the causal chains connecting successive kings (Athaliah→Joash, Ahaziah of Judah's death triggering Athaliah's coup, Manasseh→Amon→Josiah succession), (d) the cross-book Zechariah/2-Chronicles ref's accuracy, (e) all 22 refs' chapter:verse ranges and note text.
4. Triple-check: verify each finding once when found, then a second full pass before presenting findings.
5. Single audit pass — 22 people is comparable to Numbers (28) and 1 Samuel (22), the largest tier this series has handled without a section split, so budget accordingly.

## Findings report, correction & verification

Identical mechanism to prior books: findings document (`docs/superpowers/specs/2026-07-20-2kings-data-audit-findings.md`), then `scripts/fix-2kings-audit.ts` (same dry-run-gated pattern as `fix-1kings-audit.ts`), controller reviews dry-run before live execution, then live verification via API pull (or direct DB query if a subagent hits the sandboxed-network limitation observed in prior books) plus a curated-family roster check against `lib/families.ts` (none of the current 9 curated families appear to be 2-Kings-sourced based on prior audits' rosters, but this must be actually checked, not assumed).

## Out of scope

- `scripts/seed-late-kings.ts` — a separate, immediately-following audit.
- Any book other than 2 Kings.
- Re-auditing Ahab/Jezebel/Elijah/Solomon/Jonah/Jeremiah's own person records (owned by their originating books).
