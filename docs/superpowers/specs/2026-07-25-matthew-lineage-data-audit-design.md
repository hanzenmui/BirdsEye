# Matthew Lineage Gaps People & Relationships Data Audit — Design

**Date:** 2026-07-25
**Status:** Approved

## Context

Twenty-first in the per-book audit series, and the first New Testament seed file audited — the series moves from person-narrative books to genealogy-gap-filler files here. Unlike prior books, `scripts/seed-matthew-lineage.ts` isn't a single book's narrative; it fills two genealogical gaps needed to complete a continuous `parent_of` chain from Adam to Jesus: (a) an Old Testament gap, Perez→Nahshon (Hezron, Ram, Amminadab — three new people, sourced from Ruth 4:18-22, 1 Chronicles 2:5-10, and Numbers 1:7 as well as Matthew 1:3-4), and (b) a New Testament post-exilic gap, Zerubbabel→Joseph husband of Mary (Abiud, Eliakim, Azor, Zadok, Achim, Eliud, Eleazar, Matthan, Jacob — nine new people, sourced solely from Matthew 1:13-16, since no other biblical genealogy names this specific chain). It adds 12 new people, 14 relationships, 17 scripture refs. It also loads 4 pre-existing cross-seed people (`loadCrossSeedPeople`): Perez, Nahshon, Zerubbabel, and Joseph (husband of Mary) — adding only new relationships/refs to them, not editing their own person records.

## Scope

**In scope:**
- All 12 new people: name, alternate names, description, tags, gender. OT-gap: Hezron, Ram, Amminadab. NT-gap: Abiud, Eliakim (Matthew's genealogy variant, distinct key `eliakim_matt`), Azor, Zadok (`zadok_matt`), Achim, Eliud, Eleazar (`eleazar_matt`), Matthan, Jacob (`jacob_joseph`).
- All 14 relationships: the 4 OT-gap `parent_of` links (Perez→Hezron→Ram→Amminadab→Nahshon), the 9 NT-gap `parent_of` links (Zerubbabel→Abiud→...→Jacob), and the 1 cross-seed-name-lookup link (`insertRelLocalToName`: Jacob→Joseph).
- All 17 scripture refs added by this file.

**Out of scope:**
- Re-auditing Perez's, Nahshon's, Zerubbabel's, or Joseph's own person records (loaded via `loadExisting`/`loadExistingByAka`, originating elsewhere) — only the new relationships/refs this file adds referencing them are in scope.
- The middle portion of Matthew's genealogy (David through Jechoniah) — not touched by this file at all, already covered by other already-audited seed files' person records.
- The well-known scholarly discrepancy between Matthew's post-exilic names (Abiud etc.) and 1 Chronicles 3:19-24's different list of Zerubbabel's descendants — out of scope since the DB makes no claim reconciling or addressing this; each name's own description already appropriately hedges with "known only from this list."
- Any book/file other than this file's scope.

## Methodology (unchanged from prior books)

1. Enumerate every person/relationship/ref in `scripts/seed-matthew-lineage.ts` (full file — 285 lines, read in one pass).
2. Cross-reference against ESV, fetched live, not recalled from memory: Ruth 4:18-22 (Perez to David), 1 Chronicles 2:3-15 (Judah's genealogy, especially v5 for Hezron son of Perez and v9-10 for Ram/Amminadab/Nahshon), Numbers 1:7 (Nahshon son of Amminadab, prince of Judah), Exodus 6:23 (Amminadab as Aaron's father-in-law via his daughter Elisheba), and Matthew 1:1-17 (the full genealogy, with particular attention to the exact spelling at 1:3-4 and the full post-exilic chain at 1:13-16).
3. Prioritize: (a) the `ram` person's `alsoKnownAs`/description claim that Matthew 1:3-4 renders him "Aram" — verify against the ESV's actual wording at that verse (not another translation like the KJV), (b) the `amminadab` description's "father-in-law of Aaron, whose son Nahshon led Judah in the wilderness" — check whether "whose" is ambiguous/misreadable as referring to Aaron's son rather than Amminadab's own son Nahshon, (c) each of the 9 post-exilic names' "known only from this list" hedge — verify no other seed file or scripture ref already creates these names elsewhere (grep-confirm), (d) all 17 refs' chapter:verse ranges against the exact verse each name appears in, particularly the Ruth 4:18-19/4:19/4:19-20 span pattern and the Matthew 1:13-1:16 span pattern for the post-exilic chain, (e) the `insertRelLocalToName("jacob_joseph", "parent_of", "Joseph", ...)` cross-seed lookup — confirm it resolves against the live DB rather than silently warning and skipping.
4. Triple-check: verify each finding once when found, then a second full pass before presenting findings.
5. Single audit pass — 12 new people is the largest in the series so far (exceeding Prophets' 18 only if counting differently; here it's comparable to Chronicles/Prophets in scale), but all descriptions are short (one or two sentences each, mostly "known only from this genealogical list"), so the actual verification surface is smaller than the person-narrative books despite the higher people count.

## Findings report, correction & verification

Identical mechanism to prior books: findings document (`docs/superpowers/specs/2026-07-25-matthew-lineage-data-audit-findings.md`), then `scripts/fix-matthew-lineage-audit.ts` (same dry-run-gated pattern as `scripts/fix-daniel-audit.ts`), controller reviews dry-run before live execution, then live verification via direct DB query (preferred given intermittent network issues observed in some prior books' dev-server routes) plus a curated-family roster check against `lib/families.ts`.

## Out of scope

- Any book/file other than this file's scope.
- Re-auditing Perez's, Nahshon's, Zerubbabel's, or Joseph's own person records (loaded via `loadExisting`/`loadExistingByAka`, originating elsewhere).
- The middle portion of Matthew's genealogy (David–Jechoniah), not touched by this file.
