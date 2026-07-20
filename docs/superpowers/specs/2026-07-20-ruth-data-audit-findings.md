# Ruth People & Relationships Data Audit — Findings

**Date:** 2026-07-20
**Source of truth:** ESV, fetched live for every claim checked (WebFetch/WebSearch; no claim answered from training-data memory)

Reviewed: 10 people, 16 relationships, 12 refs. 2 findings.

---

## Finding 1: `insertRelNameToLocal("Judah", "ancestor_of", ...)` resolves by bare-name lookup with no `also_known_as` disambiguation, and is order-dependent rather than deterministically correct

- **Category:** Structural gap
- **Verse(s):** Ruth 1:1 ("a man of Bethlehem in Judah"); no single verse governs the DB's lookup mechanism — this is a data-modeling issue, not a textual-accuracy issue.
- **Current DB state:** `scripts/seed-ruth.ts` lines 165-166 call `insertRelNameToLocal("Judah", "ancestor_of", "elimelech", ...)` and `insertRelNameToLocal("Judah", "ancestor_of", "boaz", ...)`. The helper (lines 73-81) resolves `"Judah"` via `lookupId()` (line 57-60): `SELECT id FROM people WHERE name = ? LIMIT 1` — a bare `name` match with **no `also_known_as` filter and no `ORDER BY`**. There are exactly two "Judah" person rows possible in this DB:
  1. `scripts/seed-genesis.ts` line 285: `insertPerson({ key: "judah", name: "Judah", gender: "male", ... })` — the OT patriarch, son of Jacob and Leah, ancestor of the tribe of Judah. This row has `also_known_as = ''` (the plain `insertPerson` helper defaults `alsoKnownAs ?? ''`).
  2. `scripts/seed-luke-lineage.ts` lines 185-192: `safeInsertPerson({ key: "judah_luke", name: "Judah", alsoKnownAs: "Judah son of Joseph, in Luke's genealogy", ... })` — a distinct, unrelated figure from Luke 3:30, explicitly described as "Not the patriarch Judah."
  - Verified via grep that no other file creates a bare `name: "Judah"` person row (`scripts/seed-matthew-lineage.ts` references Judah's descendants but does not re-insert a "Judah" person, since Matthew 1:3 continues the line already seeded from Genesis).
- **Why this is currently correct, but fragile:** `package.json`'s documented seed order is `seed:genesis` (line 10) → ... → `seed:ruth` (line 16) → ... → `seed:matthew-lineage` (line 35) → `seed:luke-lineage` (line 36). Under this documented order, when `seed-ruth.ts` runs, only the Genesis patriarch "Judah" row exists (Luke's `judah_luke` has not yet been inserted), so `lookupId("Judah")` resolves unambiguously and *correctly* to the patriarch — which is also the textually correct choice (Ruth 1:1's "Judah" is unambiguously the tribe/territory descended from the patriarch, not Luke's unrelated genealogical figure). I confirmed this is the currently-correct behavior, not a currently-wrong one.
  - However, the lookup mechanism itself provides no structural guarantee of this outcome. `SELECT ... LIMIT 1` with no `ORDER BY` and no `also_known_as` predicate does not guarantee first-inserted-row-returned semantics per the SQL standard (even though SQLite/libSQL will typically return rows in rowid/insertion order in practice, this is an implementation detail, not a contract). If any seed script were ever re-run out of documented order — e.g., a full-DB rebuild that runs `seed:luke-lineage` before `seed:ruth`, or `seed-ruth.ts` re-run standalone after `seed-luke-lineage.ts` has already populated a fresh DB — `lookupId("Judah")` could silently resolve to Luke's disambiguated "Judah son of Joseph" figure instead of the patriarch, producing a factually wrong `ancestor_of` relationship for both Elimelech and Boaz with no error or warning (the helper only warns if the name is *not found at all*, not if it resolves to the wrong same-named row).
- **Proposed correction:** Change both calls in `scripts/seed-ruth.ts` to disambiguate explicitly, matching the pattern already used elsewhere in the codebase (e.g. `scripts/seed-numbers.ts`'s `alsoKnownAs: "Nahshon son of Amminadab"` pattern) for same-named distinct people. Since the Genesis patriarch Judah row has `also_known_as = ''` (not a populated disambiguator), the safest fix is either: (a) add a `WHERE also_known_as = ''` branch to `lookupId`/`insertRelNameToLocal` when a bare match is needed, or (b) add a dedicated lookup helper that excludes rows whose `also_known_as` matches known non-patriarch variants (e.g. excludes `"Judah son of Joseph, in Luke's genealogy"`). Either change is a code fix to the seeding helper, not a data fix — flagging here for Task 2 to weigh, since the *current data outcome* is correct under the documented run order.
- **Severity:** Minor — no current data is wrong (verified: only the patriarch Judah row exists at ruth-seed time under documented order), but the lookup is structurally unsafe against re-seeding-order changes, matching the audit brief's explicit instruction to flag this ambiguity for the controller's judgment.

---

## Finding 2: Jesse's description states "six other sons," which reflects 1 Chronicles 2:13-15's count but conflicts with 1 Samuel 17:12's count of eight sons total (seven others) — and neither number appears in Ruth itself

- **Category:** Unsupported
- **Verse(s):** Ruth 4:17 (ESV, live-fetched): "And the women of the neighborhood gave him a name, saying, 'A son has been born to Naomi.' They named him Obed. He was the father of Jesse, the father of David." Ruth's own text states no count of Jesse's sons at all. The claim is sourced from elsewhere in the canon: 1 Chronicles 2:13-15 (ESV, live-fetched) lists exactly seven sons total — "Jesse fathered Eliab his firstborn, Abinadab the second, Shimea the third, Nethanel the fourth, Raddai the fifth, Ozem the sixth, David the seventh" (6 named + David = 7, i.e. 6 "other" sons besides David) — while 1 Samuel 17:12 (ESV, live-fetched via search) states Jesse "had eight sons in the days of Saul," i.e. 7 others besides David.
- **Current DB state:** `scripts/seed-ruth.ts` line 135, `jesse.description`: "Son of Obed, grandson of Boaz and Ruth. Father of King David **and six other sons**. The 'root of Jesse' became a messianic title (Isa 11:1, 10). Lived in Bethlehem of Judah."
- **Why this is flagged:** The book of Ruth (this audit's own source book) never states a count of Jesse's sons — Ruth 4:17 stops at "father of Jesse, the father of David," so this detail is entirely sourced from elsewhere. That sourcing itself is internally inconsistent across scripture: 1 Chronicles 2:13-15 supports "six other sons" (7 total, David 7th), but 1 Samuel 17:12 states Jesse had "eight sons" total, implying seven others, not six. This is a known, documented textual discrepancy between Samuel and Chronicles (commonly explained by scholars as one son having died without descendants and being dropped from the Chronicles genealogy) — it is not a case where the DB is simply wrong, but a case where the DB states one of two conflicting biblical totals as if settled, without a source citation, and the number doesn't come from Ruth's own text at all.
- **Proposed correction:** Two options for the controller to weigh:
  1. **Minimal (recommended):** Add a citation and soften to acknowledge the two traditions, e.g.: "Father of King David and (per 1 Chr 2:13-15) six other sons — though 1 Sam 17:12 counts eight sons total." This keeps "six" (the more specific, named list) as primary while not silently erasing the conflicting total.
  2. **No change:** Leave as-is, since "six other sons" is a defensible, specifically-enumerated reading (1 Chronicles names all seven sons by name, which is stronger evidence than Samuel's unlisted "eight"), and 1 Samuel's total may itself reflect a son who died young or is otherwise unaccounted — treat as informational only.
- **Severity:** Minor — this is background/genealogical color describing a person outside Ruth's own narrative scope, not a claim about anything that happens within the book of Ruth, and the DB's stated number is a real, traditionally-used reading (matching the fuller, named list in Chronicles), not an invented one.

---

## Priority items checked and cleared (no finding)

Per the task brief's specific priorities:

**(a) Naomi's "Mara" name change (Ruth 1:20-21).** Live-fetched exact ESV text: "Do not call me Naomi; call me Mara, for the Almighty has dealt very bitterly with me. I went away full, and the Lord has brought me back empty. Why call me Naomi, when the Lord has testified against me and the Almighty has brought calamity upon me?" The DB's `naomi.description` (line 93): "...told the townswomen to call her 'Mara' (meaning bitter), for the Lord had brought her back empty." Both stated reasons in the DB text ("bitter" / "brought back empty") are drawn directly and accurately from vv. 20-21; "Mara" meaning "bitter" is linguistically correct (Hebrew מָרָא). `alsoKnownAs: "Mara"` on the person record (line 91) is the correct, codebase-standard way to encode a genuine alternate name (matching the `Jethro`/`Reuel` and `Joshua`/`Hoshea` pattern in `seed-exodus.ts`). **No finding — this is precise and accurate.**

**(b) Genealogical chain Salmon→Boaz→Obed→Jesse (Ruth 4:18-22).** Live-fetched full genealogy: "Now these are the generations of Perez: Perez fathered Hezron, Hezron fathered Ram, Ram fathered Amminadab, Amminadab fathered Nahshon, Nahshon fathered Salmon, Salmon fathered Boaz, Boaz fathered Obed, Obed fathered Jesse, and Jesse fathered David." Cross-checked against Matthew 1:4-5 (live-fetched): "and Ram the father of Amminadab, and Amminadab the father of Nahshon, and Nahshon the father of Salmon, and Salmon the father of Boaz by Rahab, and Boaz the father of Obed by Ruth, and Obed the father of Jesse." The DB's relationship chain (`insertRelByName("Nahshon","parent_of","Salmon",...)`, `insertRel("salmon","parent_of","boaz",...)`, `insertRel("boaz","parent_of","obed",...)`, `insertRel("obed","parent_of","jesse",...)`, lines 157-162) matches this exactly, link for link, in the correct direction and order. **No finding — the chain matches Ruth 4:18-22 and Matt 1:4-5 exactly.**

**(c) Multiple "Judah" records — see Finding 1 above.** Confirmed and flagged as a Structural gap (currently correct outcome, structurally fragile mechanism).

**(d) Manual Rahab cross-book ref insert (lines 183-191).** Compared byte-for-byte against the `insertRef` helper's SQL (lines 49-55): both use `INSERT OR IGNORE INTO scripture_refs (id,person_id,book,chapter_start,verse_start,chapter_end,verse_end,note,created_at) VALUES (?,?,?,?,?,?,?,?,datetime('now'))` — identical column list, identical column order, identical `INSERT OR IGNORE` semantics, identical `datetime('now')` timestamp handling. The manual insert produces exactly the same row shape the helper would have produced, guarded by an explicit existence check (`if (rahab)`) that the helper itself lacks (a minor robustness improvement, not a defect). Args: `book: "Ruth"`, `chapter_start/end: 4`, `verse_start/end: 21`, `note: "Named in genealogy as Salmon's wife, mother of Boaz (Matt 1:5)"`. Verified Ruth 4:21 (live-fetched via search): "Salmon fathered Boaz, Boaz fathered Obed" — this is precisely the verse that identifies Salmon as Boaz's father, making the ref's chapter:verse correct for a note about Rahab as "Salmon's wife, mother of Boaz." Cross-checked note against Matthew 1:5 (live-fetched): "Salmon the father of Boaz by Rahab" — confirms Rahab is Boaz's mother and Salmon's wife exactly as stated. **No finding — same shape, same semantics, textually accurate.**

**(e) All 12 refs' chapter:verse ranges and note text.** Individually verified against live-fetched ESV text for Ruth 1-4:

| Person | Ref | Note | Verified against |
|---|---|---|---|
| Elimelech | 1:1-5 | Takes family to Moab during famine; dies there | 1:1 (famine, move), 1:3 (death) — accurate |
| Naomi | 1:1-4:17 | Central figure; 'call me Mara' | Present throughout; 1:20-21 Mara; 4:16-17 nurses Obed (last appearance) — accurate |
| Mahlon | 1:1-5 | Son of Elimelech; dies in Moab | 1:2 (named), 1:5 (dies) — accurate |
| Mahlon | 4:9-10 | Ruth named as widow of Mahlon at gate redemption | 4:9-10 (live-fetched verbatim): "...all that belonged to Elimelech and...to Chilion and to Mahlon. Also Ruth the Moabite, the widow of Mahlon..." — accurate |
| Chilion | 1:1-5 | Son of Elimelech; dies in Moab | 1:2 (named), 1:5 (dies) — accurate |
| Ruth | 1:4-4:17 | Entire book: gleaning, Boaz, redemption, birth of Obed | 1:4 (first named), 4:13-17 (marriage, birth) — accurate span |
| Orpah | 1:4-14 | Returns to Moab after her husband's death | 1:4 (named), 1:14 (live-fetched): "Orpah kissed her mother-in-law" and departs — accurate |
| Salmon | 4:20-21 | Named in genealogy: Nahshon → Salmon → Boaz | 4:20 "Nahshon fathered Salmon", 4:21 "Salmon fathered Boaz" (live-fetched) — accurate |
| Boaz | 2:1-4:22 | Kinsman-redeemer; generosity; gate ceremony | 2:1 (live-fetched): "a worthy man of the clan of Elimelech...Boaz" (first appearance) through 4:22 (genealogy close) — accurate span |
| Obed | 4:13-17 | Born to Ruth and Boaz; Naomi nurses him | 4:13 (birth), 4:16 (Naomi nurses), 4:17 (named) — accurate |
| Jesse | 4:17-22 | Named in closing genealogy: Obed → Jesse → David | 4:17 (first named), 4:18-22 (genealogy) — accurate |
| Rahab (manual) | 4:21-21 | Named in genealogy as Salmon's wife, mother of Boaz (Matt 1:5) | See item (d) above — accurate |

All 12 refs' chapter:verse ranges and note text confirmed accurate against live-fetched ESV text. **No findings.**

---

## Other details checked (no finding)

- **Boaz's generosity details** (line 125: "told her to glean only in his fields, leave extra grain for her, share his water, and eat with his workers"): confirmed against Ruth 2:8-9 (live-fetched: "keep close to my young women...go to the vessels and drink what the young men have drawn") and Ruth 2:14-16 (eating together, extra grain left for gleaning) — accurate.
- **Boaz described as "of the clan of Elimelech"** (lines 125, 166): confirmed verbatim against Ruth 2:1 and 2:3 (live-fetched, both say "of the clan of Elimelech") — accurate, exact match.
- **Elimelech "of the clan of Ephrath"** (line 88): Ruth 1:2 (live-fetched): "They were Ephrathites from Bethlehem in Judah" — "clan of Ephrath" is a reasonable paraphrase of "Ephrathites"; accurate.
- **Ruth "one of only five women named in Matthew's genealogy of Jesus"** (line 109): confirmed — Matthew 1's five named women are Tamar, Rahab, Ruth, Bathsheba ("the wife of Uriah," 1:6), and Mary — accurate.
- **Salmon "married Rahab the Canaanite woman of Jericho according to Matthew 1:5"** (line 120): confirmed against live-fetched Matt 1:5, "Salmon the father of Boaz by Rahab" — accurate (Rahab's Canaanite/Jericho background is established in Joshua 2, consistent with the cross-book link).
- **Isaiah 11:1, 10 "root of Jesse" citation** (line 135): live-fetched — Isa 11:1 uses "stump of Jesse," Isa 11:10 uses "root of Jesse." The DB cites both verses under the single phrase "root of Jesse," which is a very slight looseness (the literal phrase "root of Jesse" only occurs in v.10; v.1 says "stump"), but both verses are genuinely about the same messianic image springing from Jesse's line, and "root of Jesse" is the commonly used composite title for this messianic theme across both verses. Considered this against the "actual discrepancy" bar and judged it too minor/defensible to file as a separate finding — noting it here per the brief's instruction to surface borderline items even when declined, so the controller can judge. Not filed as Finding 3 because no factual claim is wrong, only a citation-label looseness.
- **Obed "named in Ruth 4:17 and both gospel genealogies"** (line 130): confirmed — Obed appears in Matt 1:5 and Luke 3:32 (both gospel genealogies include the Ruth 4 chain) — accurate, not independently re-verified via live fetch of Luke 3 since it's a general genealogical-inclusion claim already substantiated by the Matthew 1:5 fetch and the well-established shared Davidic lineage both gospels use.
- **`lib/families.ts` line 55 confirms `{ name: "Jesse" }`** is present in the `david_family` controller's member list, as stated in the task brief — verified directly, no discrepancy.

---

## Findings Summary Table

| # | Finding | Category | Severity |
|---|---------|----------|----------|
| 1 | `insertRelNameToLocal("Judah", ...)` bare-name lookup is order-dependent; currently resolves correctly but is structurally unsafe | Structural gap | Minor |
| 2 | Jesse's "six other sons" reflects 1 Chronicles' count only, conflicting with 1 Samuel 17:12's count of eight sons total, and isn't sourced from Ruth itself | Unsupported | Minor |

---

## Verification notes

**Coverage counts (grep-verified against `scripts/seed-ruth.ts` before writing the summary line above):**
- People: `grep -c "await safeInsertPerson({" scripts/seed-ruth.ts` → 10
- Relationships: `grep -cE "await insertRel\(|await insertRelByName\(|await insertRelNameToLocal\(" scripts/seed-ruth.ts` → 16
- Refs via `insertRef` helper: `grep -c "await insertRef(" scripts/seed-ruth.ts` → 11
- Manual raw `db.execute` ref insert (Rahab, lines 186-190, guarded by `if (rahab)` at line 185): 1
- **Total refs: 11 + 1 = 12**

**People enumerated (10):** elimelech, naomi (aka Mara), mahlon, chilion, ruth, orpah, salmon, boaz, obed, jesse.

**Relationships enumerated (16):** elimelech-spouse_of-naomi; elimelech-parent_of-mahlon; elimelech-parent_of-chilion; naomi-parent_of-mahlon; naomi-parent_of-chilion; mahlon-spouse_of-ruth; chilion-spouse_of-orpah; ruth-ally_of-naomi; Nahshon-parent_of-Salmon (by name); Rahab-spouse_of-Salmon (by name); salmon-parent_of-boaz; boaz-spouse_of-ruth; boaz-parent_of-obed; obed-parent_of-jesse; Judah-ancestor_of-elimelech (name-to-local); Judah-ancestor_of-boaz (name-to-local).

**Refs enumerated (12):** elimelech (1:1-5), naomi (1:1-4:17), mahlon (1:1-5), mahlon (4:9-10), chilion (1:1-5), ruth (1:4-4:17), orpah (1:4-14), salmon (4:20-21), boaz (2:1-4:22), obed (4:13-17), jesse (4:17-22), rahab-manual (4:21-21).

**Live fetches performed this session (ESV unless noted):** Ruth 1 (full, verse-by-verse), Ruth 2 (full), Ruth 3 (full, verse-by-verse), Ruth 4 (verses 1-22, including verbatim vv. 9-10, 17, and the full 18-22 genealogy), Matthew 1:1-6 (verbatim), Isaiah 11:1 and 11:10 (verbatim), 1 Samuel 17:12 (via search), 1 Chronicles 2:13-15 (verbatim). No claim in this document was answered from training-data memory.

**Triple-check (Step 5):** Re-verified Finding 1 by re-reading `scripts/seed-ruth.ts` lines 57-81 and 165-166 a second time, re-confirmed `package.json`'s seed-script ordering (genesis line 10, ruth line 16, matthew-lineage line 35, luke-lineage line 36) a second time, and re-confirmed via grep that exactly two "Judah" `name:` rows exist in the codebase. Re-verified Finding 2 by re-fetching the 1 Samuel 17:12 and 1 Chronicles 2:13-15 counts a second time via independent search and confirming the "eight total / seven other" vs. "seven total / six other" discrepancy is consistent both times. Re-verified all 12 ref chapter:verse ranges a second time against the original fetched text; no transpositions found. Re-confirmed the Naomi/Mara wording (item a) and the full genealogical chain (item b) a second time against the original live-fetched text with no discrepancies on re-check.

**Second full read-through (checking for contradictions between findings):** Finding 1 (Judah lookup mechanism) and Finding 2 (Jesse's son count) concern entirely different people, keys, and proposed changes (one is a code/lookup-safety fix, the other is a description-text softening) — no overlap or contradiction. Neither finding proposes a change that would affect the priority items (a), (b), (d), or (e), all of which are independently confirmed clear above. No cross-finding contradictions identified.

**Collision check performed within this document:** Finding 1 does not propose adding any new person key — it proposes either a lookup-safety code change or a disambiguation change to an *existing* helper function, not new data. Finding 2 proposes only a description-text edit to the existing `jesse` person record, no new keys or relationships. No collision risk identified.
