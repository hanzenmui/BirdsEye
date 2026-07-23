# Prophets (Jeremiah, Ezekiel, Twelve Minor Prophets) Data Audit — Design

**Date:** 2026-07-23
**Status:** Approved

## Context

Nineteenth in the per-book audit series (Genesis through Isaiah already merged — see their design specs for the established methodology, source, and fix-mechanism decisions, all reused unchanged here). `scripts/seed-prophets.ts` covers Jeremiah, Ezekiel, and all twelve minor prophets (Hosea, Joel, Amos, Obadiah, Jonah, Micah, Nahum, Habakkuk, Zephaniah, Haggai, Zechariah, Malachi). It adds 18 new people (grep-confirmed: 18 `safeInsertPerson`, 13 relationship-creating calls across three different helper functions, 20 `insertRef` calls) — the largest book in this series so far by people count, exceeding Chronicles' 13. It also adds a scripture ref to the pre-existing `isaiah` person (loaded via `loadExisting`, guarded by an `if` check since Isaiah's own file already seeded him) without touching his own person record.

## Scope

**In scope:**
- All 18 new people: name, alternate names, description, tags, gender. This includes Jeremiah, Baruch, Ebed-melech, Pashhur (son of Immer), Ezekiel, Hosea, Gomer, Joel, Amos, Obadiah, Jonah, Micah, Nahum, Habakkuk, Zephaniah, Haggai, Zechariah (the post-exilic prophet, distinct key `zechariah_prophet`), and Malachi.
- All 13 relationships, including the four cross-seed-name-lookup relationships to Josiah, Nebuchadnezzar, Zerubbabel, Jeshua (via `insertRelByName`) and the three Jeroboam II-disambiguated relationships (via `insertRelByAkaToName`, specifically checking these correctly target Jeroboam II and not Jeroboam I from 1 Kings).
- All 20 scripture refs, including the single new ref added to the pre-existing `isaiah` person (Isaiah 1:1-66:24).

**Out of scope:**
- Re-auditing Isaiah's own person record (owned by 1 Kings/2 Kings, per this file's own comment "Isaiah already seeded in seed-2kings.ts") — only the new ref this file adds to him is in scope.
- Re-auditing Josiah's, Nebuchadnezzar's, Zerubbabel's, Jeshua's, or Jeroboam II's own person records (owned by their originating books) — only the relationships this file adds referencing them are in scope.
- Any book other than this file's scope (Jeremiah, Ezekiel, the twelve minor prophets).

## Methodology (unchanged from prior books)

1. Enumerate every person/relationship/ref in `scripts/seed-prophets.ts` (full file — 314 lines, read in one pass).
2. Cross-reference against ESV, fetched live, not recalled from memory, organized in two natural groups given this book's size: **Major prophets** — Jeremiah 1 (call, superscription naming Hilkiah/Anathoth), Jeremiah 36 (Baruch's scroll), Jeremiah 38-39 (Ebed-melech's rescue), Jeremiah 20 (Pashhur), Jeremiah 31:31-34 (New Covenant), Ezekiel 1 (call vision, Buzi, Chebar canal), Ezekiel 4 (430 days), Ezekiel 24 (wife's death); **Minor prophets** — Hosea 1-3 (Gomer, the children's symbolic names, 6:6), Joel 2:28-32, Amos 1:1 and 7:10-17 (Amaziah's expulsion), Obadiah 1 (full 21 verses), Jonah 1-4 and 2 Kings 14:25, Micah 5:2 and 6:8, Nahum 1:1, Habakkuk 1-3 (2:4), Zephaniah 1:1 (the four-generation genealogy to Hezekiah), Haggai 1-2, Zechariah 1:1, 3, 9:9, 11:12-13, 12:10, 14:4, Malachi 3:1 and 4:5-6.
3. Prioritize: (a) every specific date claim (Jeremiah's ministry c. 627-580 BC, Hosea c. 750-722 BC, Amos c. 760 BC, Micah c. 735-700 BC, Nahum's fall-of-Nineveh 612 BC, Habakkuk c. 605 BC, Zephaniah/Josiah c. 640-630 BC, Haggai's second year of Darius 520 BC, Zechariah 520-518 BC, Malachi c. 430 BC) — verify each against standard chronologies, (b) name-meaning glosses for symbolic names (Gomer's children Jezreel/Lo-ruhamah/Lo-ammi, Pashhur's renaming "Magor-Missabib") against the text's own translations, (c) the Zephaniah genealogy claim ("four generations to Hezekiah, suggesting royal lineage") — verify this against Zeph 1:1's actual genealogy chain, (d) the `insertRelByAkaToName`/`insertRelByAkaToName` Jeroboam-disambiguation relationships — confirm they resolve against Jeroboam II specifically (via alsoKnownAs) and not the 1 Kings Jeroboam I, (e) all NT-citation claims (Hos 6:6 quoted by Jesus twice, Joel 2:28-32 cited by Peter at Pentecost, Hab 2:4 quoted in Romans/Galatians/Hebrews, Mic 5:2 quoted by the chief priests to Herod, Zech 9:9/11:12-13/12:10 as messianic fulfillment texts, Mal 3:1/4:5-6 identified with John the Baptist) — verify these are accurate NT citations, not invented or misattributed, (f) all 20 refs' chapter:verse ranges and note text, especially the four whole-book refs that span the entire book (Jeremiah 1-52, Ezekiel 1-48, Amos 1-9, Obadiah, Jonah, Micah, Nahum, Habakkuk, Zephaniah, Haggai, Zechariah, Malachi) for correct total-chapter-count accuracy.
4. Triple-check: verify each finding once when found, then a second full pass before presenting findings.
5. Given this book's unusual size (18 people, the largest in this series so far), a single audit pass is still used (consistent with this series' precedent of not splitting even Chronicles' comparably dense 32-ref book into multiple tasks), but the implementer should work through it in the two natural groups above (major prophets, then minor prophets) to manage the volume of distinct claims systematically, producing one combined findings document.

## Findings report, correction & verification

Identical mechanism to prior books: findings document (`docs/superpowers/specs/2026-07-23-prophets-data-audit-findings.md`), then `scripts/fix-prophets-audit.ts` (same dry-run-gated pattern as `scripts/fix-isaiah-audit.ts`), controller reviews dry-run before live execution, then live verification via direct DB query (preferred given intermittent network issues observed in some prior books' dev-server routes) plus a curated-family roster check against `lib/families.ts`.

## Out of scope

- Any book other than this file's scope.
- Re-auditing Isaiah's, Josiah's, Nebuchadnezzar's, Zerubbabel's, Jeshua's, or Jeroboam II's own person records (owned by their originating books).
