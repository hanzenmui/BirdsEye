# Daniel People & Relationships Data Audit — Design

**Date:** 2026-07-25
**Status:** Approved

## Context

Twentieth in the per-book audit series (Genesis through Prophets already merged — see their design specs for the established methodology, source, and fix-mechanism decisions, all reused unchanged here). `scripts/seed-daniel.ts` covers the book of Daniel. It adds 6 new people (Daniel, Hananiah, Mishael, Azariah, Belshazzar, Darius the Mede) — 9 relationships, 7 scripture refs. It also loads 1 pre-existing cross-seed person (`loadExisting`): Nebuchadnezzar (already seeded in `seed-2kings.ts`), adding only new relationships/refs to him, not editing his own person record. This is the last Old Testament book with an un-audited seed file — the series moves to the New Testament seed files (`seed-matthew-lineage.ts`, `seed-luke-lineage.ts`, `seed-nt-*.ts`, `seed-acts.ts`, `seed-romans16.ts`, `seed-nt-epistles.ts`, `seed-revelation.ts`) after this.

## Scope

**In scope:**
- All 6 new people: name, alternate names, description, tags, gender. This includes Daniel (aka Belteshazzar), Hananiah (aka Shadrach), Mishael (aka Meshach), Azariah (aka Abednego), Belshazzar, and Darius the Mede.
- All 9 relationships in the file: the 5 `ally_of` relationships among Daniel/Hananiah/Mishael/Azariah, the 2 cross-seed-name-lookup relationships to Nebuchadnezzar (via `insertRelByName`: `ruler_of` and `enemy_of`), and the `belshazzar enemy_of daniel` / `darius_mede ruler_of daniel` relationships.
- All 7 scripture refs added by this file, including the 1 new ref attached to the pre-existing `neb` (Nebuchadnezzar) person, guarded by an `if (await loadExisting(...))` check.

**Out of scope:**
- Re-auditing Nebuchadnezzar's own person record (owned by 2 Kings, per this file's own comment "already seeded in 2 Kings") — only the new relationships/ref this file adds referencing him are in scope.
- Any book other than this file's scope (Daniel).

## Methodology (unchanged from prior books)

1. Enumerate every person/relationship/ref in `scripts/seed-daniel.ts` (full file — 166 lines, read in one pass).
2. Cross-reference against ESV, fetched live, not recalled from memory: Daniel 1 (the four young men's names, the food test, Nebuchadnezzar taking Daniel to Babylon), Daniel 2 (the statue dream), Daniel 3 (the golden image, the fiery furnace, the "fourth... like a son of the gods"), Daniel 4 (Nebuchadnezzar's tree dream and madness), Daniel 5 (Belshazzar's feast, the temple vessels, the handwriting on the wall, his death and the transfer of the kingdom), Daniel 6 (Darius's decree, the lions' den), Daniel 7-12 (the apocalyptic visions: four beasts, Ancient of Days, Son of Man, seventy weeks) for the summary claims in Daniel's own description.
3. Prioritize: (a) Belshazzar's genealogy claim ("son of Nabonidus, though Daniel calls him Nebuchadnezzar's son, likely in a dynastic sense") — verify this against both the text (Dan 5:2, 5:11, 5:18-22 repeatedly call him Nebuchadnezzar's son/father) and the standard historical resolution (Belshazzar was actually Nabonidus's son and co-regent, not Nebuchadnezzar's biological son), (b) Darius the Mede's identity claim ("historical identity is debated") — verify this is an accurate, appropriately-hedged characterization of the real scholarly question, not an invented one, (c) the fiery furnace description's "fourth figure... like a son of the gods" wording against Dan 3:25's actual phrasing, (d) each of the four young men's name-meaning/Babylonian-renaming claims (Dan 1:7) for accuracy, (e) the `insertRelByName` cross-seed lookups to Nebuchadnezzar — confirm both actually resolve against the live DB (fail-loud check, same concern flagged in the Isaiah and Prophets audits for this helper), (f) all 7 refs' chapter:verse ranges and note text, especially the two whole-book-spanning refs (Daniel's own 1:1-12:13 and Nebuchadnezzar's 1:1-4:37) for correct total-chapter-count accuracy, and Belshazzar's 5:1-5:30 / Darius's 5:31-6:28 split at the chapter-5/6 boundary.
4. Triple-check: verify each finding once when found, then a second full pass before presenting findings.
5. Single audit pass — 6 new people is comparable in size to Job/Esther/Isaiah.

## Findings report, correction & verification

Identical mechanism to prior books: findings document (`docs/superpowers/specs/2026-07-25-daniel-data-audit-findings.md`), then `scripts/fix-daniel-audit.ts` (same dry-run-gated pattern as `scripts/fix-prophets-audit.ts`), controller reviews dry-run before live execution, then live verification via direct DB query (preferred given intermittent network issues observed in some prior books' dev-server routes) plus a curated-family roster check against `lib/families.ts`.

## Out of scope

- Any book other than this file's scope.
- Re-auditing Nebuchadnezzar's own person record (owned by 2 Kings).
