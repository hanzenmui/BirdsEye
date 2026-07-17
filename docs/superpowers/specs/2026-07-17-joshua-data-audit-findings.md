# Joshua Data Audit — Findings

Reviewed: 8 people, 9 relationships, 21 refs. 2 findings.

Single-pass audit of `scripts/seed-joshua.ts` (per
`docs/superpowers/specs/2026-07-17-joshua-data-audit-design.md`), cross-referenced against the ESV
text fetched live via WebFetch/WebSearch (esv.org and biblegateway.com/ESV, cross-corroborated) in
this session — no claim below is answered from memory. Counts were grep-verified directly against
the file:

- **People** — `await safeInsertPerson` calls: lines 93 (rahab), 99 (achan), 105 (achsah), 111
  (adoni_zedek), 116 (hoham), 121 (piram), 126 (japhia_lachish), 131 (debir_king) = **8**, not the 9
  the task brief's Step 1 language estimated.
- **Relationships** — `insertRelByName`/`insertRelNameToLocal`/`insertRel` calls in
  `seedRelationships()`: lines 140, 143, 144, 147, 150, 151, 152, 153, 154 = **9**, matching the
  brief.
- **Refs** — `insertRef` calls in `seedRefs()`: lines 160-174 (9 refs for the 5 new named people:
  rahab ×2, achan ×1, achsah ×1, and one each for the 5 kings) + lines 178-195 (12 refs for
  pre-existing people loaded via `loadExisting`: joshua_ex ×5, caleb_ex ×2, eleazar_ex ×4,
  phinehas_ex ×1) = **21 total**, not the 15 the brief's Step 1 language estimated (brief said "15
  ... including the 8 attached to joshua_ex/caleb_ex/eleazar_ex/phinehas_ex" — the actual
  pre-existing-person total is 12, not 8, and the grand total is 21, not 15). This correction is
  noted here per the brief's instruction to grep-count these numbers directly rather than trust any
  prior estimate.

## Priority-item summary (per task brief's "Additional context")

**(a) Five kings' titles/cities and coalition structure vs Josh 10:3:** Fetched Josh 10:1-6, 10:16-27
live (esv.org + biblegateway.com, texts identical). Josh 10:3 ESV: "So Adoni-zedek king of Jerusalem
sent to Hoham king of Hebron, to Piram king of Jarmuth, to Japhia king of Lachish, and to Debir king
of Eglon." All five names, all five city assignments (Jerusalem/Hebron/Jarmuth/Lachish/Eglon), and
the person-to-city mapping in the seed file's `alsoKnownAs` and description fields match exactly.
Josh 10:1 confirms Adoni-zedek is the one who organizes the coalition ("heard... sent to..."),
matching the description's "organized a coalition." Josh 10:5 confirms the "Amorite" identity used
in all five kings' tags. Josh 10:16-27 confirms: fled and hid in a cave at Makkedah; brought out;
executed; hung on trees; bodies returned to the cave at sundown; cave sealed with stones. All of this
matches the descriptions and refs. **No finding.**

**(b) Achan's ancestry ("son of Carmi, of the clan of Zabdi... tribe of Judah," Josh 7:1) vs the
single `Judah ancestor_of achan` relationship:** Fetched Josh 7:1 live (esv.org + biblegateway.com,
cross-corroborated) — "Achan the son of Carmi, son of Zabdi, son of Zerah, of the tribe of Judah."
This is a four-generation chain: Judah → Zerah → Zabdi (also called Zimri in 1 Chr 2:6, confirmed by
live fetch of 1 Chr 2:6-7 ESV: "The sons of Zerah: Zimri..." / "The son of Carmi: Achan") → Carmi →
Achan. Grepped all `scripts/seed-*.ts` files for `key: "zerah"`, `key: "carmi"`, `key: "zabdi"`,
`key: "zimri"` — only `zimri` exists as a person record (`scripts/seed-numbers.ts` line 204), and it
is a **different, unrelated person**: "Zimri son of Salu," a Simeonite leader killed by Phinehas at
Peor (Num 25) — not the Zerahite ancestor of Carmi. No `zerah`, `carmi`, or `zabdi` person record
exists anywhere in the codebase. The seed file's own Achan description names both "Carmi" (his
father) and "Zabdi (Zimri)" (his grandfather) as specific intermediate generations between Judah and
Achan, but the only relationship the file creates is a single generic `Judah ancestor_of achan` with
no intervening person records or relationships for Zerah, Zabdi/Zimri, or Carmi — i.e., the
description names a specific genealogical path the graph has no way to represent. This is the same
structural-gap pattern used in the Genesis/Exodus/Numbers audits. **See Finding 1.**

**(c) Rahab's marriage to Salmon / motherhood of Boaz vs `salmon`/`boaz` records:** Grepped all
`scripts/seed-*.ts` files for `key: "salmon"` and `key: "boaz"` — both exist, in
`scripts/seed-ruth.ts` (lines 118, 123). `scripts/seed-ruth.ts` line 158 contains
`await insertRelByName("Rahab", "spouse_of", "Salmon", "Rahab married Salmon (Matt 1:5)")`, and lines
183-190 add a cross-book scripture ref tying Rahab (looked up by name, seeded in `seed-joshua.ts`) to
Ruth 4:21 with note "Named in genealogy as Salmon's wife, mother of Boaz (Matt 1:5)." Because
`insertRelByName` and the ref-insertion in `seed-ruth.ts` both resolve `Rahab` by name lookup against
the shared `people` table (not a local in-script key), this relationship and ref apply regardless of
script execution order, and they directly support both of the Joshua seed file's claims ("Later
married Salmon and became the mother of Boaz"). The description's claim is **not** left unsupported
by any relationship — per the brief's explicit instruction ("flag only if the description asserts
something the DB can't support, not as a mandate to seed new content"), this is **not a finding**.

**(d) All 15 [sic — actually 21] refs' chapter:verse ranges and note text:** Checked every ref
against the fetched ESV text of Joshua 1, 2, 3, 6, 7, 10, 14, 15, 19-21, 22, 23-24. All chapter:verse
ranges and note summaries are accurate:
- `rahab` 2:1-2:24 (spies hidden, promise of safety) and 6:17-6:25 (Rahab spared) — both confirmed.
- `achan` 7:1-7:26 (theft, defeat at Ai, stoning in Valley of Achor) — confirmed; the chapter's full
  narrative arc (vv. 1-26) matches the note.
- `achsah` 15:16-15:19 (marries Othniel, asks for springs) — confirmed against Josh 15:16-19 ESV
  exactly (offer in v.16, capture/marriage in v.17, request in vv.18-19).
- Five kings, `10:3-10:27` (`adoni_zedek` uses `10:1-10:27`) — all confirmed: v.3 names/titles, vv.
  16-27 capture/execution at Makkedah.
- `joshua_ex`: 1:1-1:18 (commission, confirmed), 3:1-3:17 (Jordan crossing, confirmed), 6:1-6:27
  (fall of Jericho, confirmed), 10:12-10:14 (sun stands still at Gibeon, confirmed against v.12-14
  exactly), 23:1-24:28 (farewell/covenant renewal at Shechem, confirmed).
- `caleb_ex`: 14:6-14:15 (Hebron claim, age 85, confirmed against 14:10 "eighty-five years old" and
  14:13 Hebron given to Caleb) and 15:13-15:19 (giants driven out, Achsah given springs — confirmed,
  episode runs 15:13-19 exactly as stated).
- `eleazar_ex`: 14:1-14:1 (allotment overseer, confirmed against 14:1 "Eleazar the priest and Joshua
  the son of Nun"), 19:51-19:51 (division completed, confirmed verbatim), 21:1-21:3 (Levitical cities
  requested/allocated, confirmed against 21:1-2 Levite family heads approaching Eleazar and Joshua),
  24:33-24:33 (Eleazar's death and burial at Gibeah of Phinehas, confirmed verbatim against 24:33).
- `phinehas_ex`: 22:13-22:34 (delegation to challenge the Transjordanian altar, confirmed against
  22:13-14 naming Phinehas as delegation leader and vv. 15-34 covering the full episode through
  reconciliation).

No ref finding.

**Additional item found outside the (a)/(b)/(c)/(d) checklist:** Achan's stolen-goods description
omits a textual detail and uses outdated phrasing for one item — see Finding 2.

**Borderline observation (included per brief's instruction to flag uncertain items rather than
silently decline them):** Rahab's description opens "Canaanite innkeeper (traditionally described as
a prostitute)." Josh 2:1 and 6:17 (ESV, both fetched live) call her directly "a prostitute" /
"Rahab the prostitute" with no textual hedge — the ESV itself does not present this as merely
traditional. This is a common interpretive/apologetic softening found in some secondary literature,
not a factual contradiction of what the text states (the text does call her a prostitute, so nothing
in the description is false), and the same phrasing convention may already be established elsewhere
in this codebase's prior person descriptions. Given the brief's directive to include borderline items
for the controller to judge rather than silently omit them, this is noted here but **not** written up
as a formal finding, since it is an editorial framing choice rather than a discrepancy against the
text — the underlying fact ("Rahab was a prostitute per the ESV text") is not disputed by the
description, which fully discloses it in parentheses.

**Minor phrasing observation (not a finding):** The description says Achan hid the items "under his
tent." Josh 7:21-22 (ESV) describes them as "hidden in the ground inside my tent, with the silver
underneath" (i.e., buried in the earth inside the tent, not literally under the tent structure). This
is imprecise but not materially wrong — buried "in" a tent's floor could fairly be summarized as
concealed "under" it in the sense of "underground within it" — and does not rise to the bar of a
formal finding on its own. Flagged here for completeness per the brief's guidance.

---

## Finding 1: Achan's ancestry names intermediate generations (Carmi, Zabdi/Zimri) that have no corresponding person records or relationships in the graph

- **Category:** Structural gap
- **Verse(s):** Joshua 7:1 (ESV) — "Achan the son of Carmi, son of Zabdi, son of Zerah, of the tribe
  of Judah"; corroborated by 1 Chronicles 2:6-7 (ESV) — "The sons of Zerah: Zimri... The son of
  Carmi: Achan, the troubler of Israel."
- **Current DB state:** `scripts/seed-joshua.ts` line 99-102 gives Achan the description "Son of
  Carmi, of the clan of Zabdi (Zimri), from the tribe of Judah," explicitly naming two intermediate
  generations (his father Carmi and grandfather Zabdi/Zimri) between Judah and Achan. But
  `scripts/seed-joshua.ts` line 143 creates only one relationship for Achan's ancestry:
  `await insertRelNameToLocal("Judah", "ancestor_of", "achan", ...)` — a single, generic four-
  generation-skipping link directly from Judah to Achan. No `zerah`, `carmi`, or `zabdi`/`zimri`
  person record modeling this specific lineage exists in `scripts/seed-joshua.ts` or any other
  `scripts/seed-*.ts` file (the one existing `zimri` record, in `scripts/seed-numbers.ts`, is an
  unrelated Simeonite figure killed by Phinehas at Peor, not the Zerahite ancestor of Carmi). The
  description therefore asserts a specific genealogical path the relationship graph has no way to
  represent.
- **Proposed correction:** Either (a) add `zerah`/`carmi`/`zabdi` (or `zimri`) person records and the
  intermediate `ancestor_of` relationships (Judah → Zerah → Zabdi/Zimri → Carmi → Achan) to model the
  chain the description already asserts, or (b) if new person records are out of scope for this
  correction pass, leave the existing generic `Judah ancestor_of achan` relationship as a deliberate
  simplification but flag it as such — Task 2 should decide which approach matches the correction
  scope used for the equivalent structural gaps already fixed in Genesis/Exodus/Numbers.
- **Severity:** Minor

## Finding 2: Achan's stolen-goods description omits the gold's stated weight and uses non-ESV phrasing

- **Category:** Missing
- **Verse(s):** Joshua 7:21 (ESV, confirmed by live fetch, cross-corroborated across esv.org,
  biblehub.com/esv, and biblia.com/bible/esv) — "when I saw among the spoil a beautiful cloak from
  Shinar and two hundred shekels of silver and a bar of gold fifty shekels in weight, then I coveted
  them and took them."
- **Current DB state:** `scripts/seed-joshua.ts` line 101 describes the stolen items as "a Babylonian
  robe, 200 shekels of silver, and a wedge of gold" — the silver amount (200 shekels) is correct, but
  the gold item's weight (fifty shekels) is missing entirely, and "wedge of gold" is KJV-era phrasing
  rather than the ESV's "a bar of gold... in weight."
- **Proposed correction:** Update the description to include the gold's weight, e.g. "...secretly
  taking a Babylonian robe, 200 shekels of silver, and a bar of gold weighing 50 shekels..." (or
  equivalent ESV-aligned phrasing).
- **Severity:** Minor
