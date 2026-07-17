# Deuteronomy Data Audit — Findings

Reviewed: 2 people, 4 relationships, 12 refs. 2 findings.

Single-pass audit of `scripts/seed-deuteronomy.ts` (per
`docs/superpowers/specs/2026-07-17-deuteronomy-data-audit-design.md`), cross-referenced against the
ESV text fetched live via WebFetch (esv.org and biblegateway.com/ESV) in this session — no claim
below is answered from memory. Counts were grep-verified directly against the file: `safeInsertPerson`
calls (lines 97-105) = 2; relationship calls (`insertRel` + `insertRelByName` + `insertRelNameToLocal`,
lines 110-113) = 4; `insertRef` calls (lines 119-137) = **12**, not the 8 stated in the design doc's
scope note. The design doc's "8 scripture refs" undercounts: the actual breakdown is 5 refs for the
two new people (3 for Sihon, 2 for Og) plus 7 refs for pre-existing people loaded via `loadExisting`
(2 for Moses, 4 for Joshua, 1 for Caleb) = 12 total, not 4 for the pre-existing people as the design
doc's phrasing ("the 4 refs attached to moses/joshua/caleb") implied. This finding-count correction
is noted here per the brief's instruction to grep-count these numbers directly rather than trust any
prior estimate.

## Priority-item summary (Step 3 focus areas)

**(a) Sihon's and Og's descriptions (lines 97-105):** Checked against Numbers 21:21-35 (ESV, live
fetch) and Deuteronomy 2:26-37 / 3:1-13 (ESV, live fetch). Every checkable factual claim in both
descriptions — Sihon's title ("Amorite king of Heshbon"), his refusal of passage and attack, his
defeat at Jahaz, the transfer of his land to Reuben and Gad; Og's title ("King of Bashan"), his
Rephaim/giant status, his march to Edrei and total defeat, his sixty cities, the transfer of his
territory to the half-tribe of Manasseh, and the nine-cubit length of his iron bed — is accurate and
directly supported by the fetched text. No finding here.

**(b) `manasseh ruler_of og` relationship (line 113):** Checked against Deuteronomy 3:11-13 (ESV,
live fetch, cross-corroborated from both esv.org and biblegateway.com). **This relationship is
incorrect** — see Finding 1 below.

**(c) All 12 scripture refs:** Checked chapter:verse ranges and note text against the fetched ESV
text of Numbers 21, Deuteronomy 1-3, Deuteronomy 31, and Deuteronomy 34. All 12 are accurate. No
findings among the refs themselves.

**Additional item found outside the (a)/(b)/(c) checklist:** The `sihon enemy_of og` relationship
(line 110) asserts direct hostility between Sihon and Og that the text never states — see Finding 2.

---

## Finding 1: `manasseh ruler_of og` relationship inverts and mischaracterizes what Deuteronomy 3:13 actually says

- **Category:** Incorrect
- **Verse(s):** Deuteronomy 3:11-13 (ESV, confirmed by live fetch from both esv.org and
  biblegateway.com, texts identical) — "For only Og the king of Bashan was left of the remnant of
  the Rephaim... So the Lord our God gave into our hand Og also... and we struck him down until he
  had no survivor left... The rest of Gilead, and all Bashan, the kingdom of Og, that is, all the
  region of Argob, **I gave to the half-tribe of Manasseh**."
- **Current DB state:** `scripts/seed-deuteronomy.ts` line 113:
  `await insertRelNameToLocal("Manasseh", "ruler_of", "og", "Og's territory of Bashan allotted to
  Manasseh (Deut 3:13)")`. This inserts a relationship with `person_a = Manasseh`, `type =
  "ruler_of"`, `person_b = og` — i.e., it asserts Manasseh rules/governs Og. Elsewhere in this
  codebase `ruler_of` is used exclusively for a living monarch/authority ruling over a living
  subordinate person (e.g. `nebuchadnezzar ruler_of jehoiakim`, `felix ruler_of paul`, `ahasuerus
  ruler_of haman` — all in `scripts/seed-late-kings.ts`, `scripts/seed-acts.ts`, and
  `scripts/seed-esther.ts`), confirming the type's established semantic in this graph is
  ruler-over-subject-person, not territory-inheritance. Deut 3:3 states Og and all his people were
  "struck down until he had no survivor left" — Og was dead by the time the land was allotted in
  3:12-13, so Manasseh could never have "ruled" Og as a person even under a loose reading. What
  Deut 3:13 actually describes is Moses (not Manasseh) granting Og's now-conquered territory to the
  half-tribe of Manasseh as an inheritance — a land allotment, not a rulership relationship, and not
  even one where Manasseh is the acting party. The `notes` field's own text ("territory of Bashan
  allotted to Manasseh") correctly describes a land grant, but the relationship's `type` field
  ("ruler_of") does not match that description at all — the note and the type contradict each other
  within the same line.
- **Proposed correction:** Remove `insertRelNameToLocal("Manasseh", "ruler_of", "og", ...)`. If a
  replacement relationship is desired to capture the territorial transfer, it should use a type
  consistent with land inheritance/succession rather than `ruler_of` — no existing relationship type
  in this codebase cleanly models "tribe inherits defeated king's land" (the closest analog,
  `ancestor_of`, is used only for lineage, not territory), so the simplest correction is deletion of
  this relationship, with the already-accurate territorial-transfer fact left to stand as prose in
  both Og's own description (line 104: "His sixty fortified cities in Bashan were given to the
  half-tribe of Manasseh") and the `Deuteronomy 3:1-13` scripture ref already attached to `og` (line
  123).
- **Severity:** Important

---

## Finding 2: `sihon enemy_of og` relationship asserts direct hostility between the two kings that the text never states

- **Category:** Unsupported
- **Verse(s):** Numbers 21:21-35; Deuteronomy 2:26-3:13; Deuteronomy 3:2 ("you shall do to him as
  you did to Sihon the king of the Amorites"); Deuteronomy 31:4 ("The Lord will do to them as he did
  to Sihon and Og, the kings of the Amorites") — all ESV, confirmed by live fetch. In every one of
  these passages, Sihon and Og are each independently engaged in battle against Israel/Moses (Num
  21:23, 21:33; Deut 2:32, 3:1), and are twice named together only as a narrative pairing/precedent
  ("as you did to Sihon... [so I will do to Og]" in Deut 3:2; "as he did to Sihon and Og" in Deut
  31:4). No verse anywhere in Numbers or Deuteronomy depicts Sihon and Og fighting each other,
  allying against each other, or having any direct interaction with one another at all.
- **Current DB state:** `scripts/seed-deuteronomy.ts` line 110:
  `await insertRel("sihon", "enemy_of", "og"); // both Transjordanian foes, structurally paired`.
  The inline comment itself concedes the actual basis is that they are "structurally paired" in the
  narrative (i.e., both defeated by Israel in succession, per Num 21 and Deut 2-3), not that they
  were enemies of each other. Elsewhere in this file, `enemy_of` is used correctly for relationships
  with direct textual support — `Sihon enemy_of Moses` (Deut 2:26-37, Sihon directly attacks Israel
  under Moses) and `Og enemy_of Moses` (Deut 3:1-13, Og directly attacks Israel under Moses) both
  describe real, textually-attested conflict between the two named parties. `sihon enemy_of og` does
  not meet that same bar — it borrows the `enemy_of` type to encode a structural/narrative parallel
  between two figures who share a common enemy (Israel) rather than being enemies of each other.
- **Proposed correction:** Remove `insertRel("sihon", "enemy_of", "og")`. The genuine textual
  connection between the two — that Og's defeat is narrated as a repeat of Sihon's, per Deut 3:2 and
  31:4 — is already captured accurately by the existing `sihon` ref at Deut 3:2 ("Paired with Og in
  the retrospective," line 121), so no replacement relationship is needed; the pairing is
  sufficiently represented by that scripture ref's note text alone.
- **Severity:** Minor

---

## Items considered but not included as findings

- **Og's iron bed — omitted detail, not an inaccuracy (Deut 3:11):** The seed description says only
  "His iron bed was reportedly nine cubits long," omitting the four-cubit breadth and the detail that
  the bed's continued existence was attested "in Rabbah of the Ammonites." Both omitted facts are
  true supplementary detail in Deut 3:11, not contradicted by anything in the seed text, and the one
  detail the seed does state (nine cubits length) is accurate. The word "reportedly" adds a hedge
  the ESV narration doesn't use (Deut 3:11 states the bed's existence and measurements as fact,
  introduced with "Behold"), but this is a tone/style choice rather than a misstatement of any
  checkable fact or field value, so it does not fit the findings template (there is no discrete
  incorrect value to propose a correction for). Not included as a finding.
- **`sihon`/`og` descriptions' closing sentences ("rallying refrain" / "frequently celebrated in
  later psalms and prayers"):** Both are general, unfalsifiable-by-Deuteronomy/Numbers-text framing
  claims (referring to later reuse of Sihon/Og's defeat in texts like Psalm 135-136, which are
  outside this audit's cited-chapter scope per the design doc). Not checked against those later
  texts and not included as findings, consistent with the design doc's scope (Deut 1-3, 31, 34, and
  Num 21:21-35 only).

---

## Findings Summary Table

| # | Finding | Category | Severity |
|---|---------|----------|----------|
| 1 | `manasseh ruler_of og` inverts/mischaracterizes Deut 3:13's land-allotment as a rulership relationship | Incorrect | Important |
| 2 | `sihon enemy_of og` asserts direct hostility between the two kings that no cited passage supports | Unsupported | Minor |

**Totals:** 0 Critical, 1 Important, 1 Minor. 1 Incorrect, 1 Unsupported.

---

## Triple-Check Pass (Step 5)

**First re-verification (re-checked each finding individually against fetched text):**
- Finding 1: Re-fetched Deuteronomy 3:11-13 from both esv.org and biblegateway.com independently;
  both returned identical text. Re-confirmed "I gave to the half-tribe of Manasseh" is the operative
  clause (Moses is the grammatical subject giving the land; Manasseh is the recipient), and
  re-confirmed via grep (`grep -n "ruler_of" scripts/*.ts`) that every other `ruler_of` use in the
  codebase pairs a living authority with a living subordinate person, none of them a land-allotment
  scenario. Re-read `scripts/seed-deuteronomy.ts` line 113 character-by-character to confirm the
  literal argument order (`"Manasseh"` is `aName`, `"og"` is `bKey`, matching
  `insertRelNameToLocal(aName, type, bKey, ...)`'s signature at line 76) — confirmed `person_a =
  Manasseh`, not reversed. No discrepancy from initial finding.
- Finding 2: Re-fetched Deuteronomy 3:2 and 31:4 verbatim and confirmed neither states or implies
  Sihon and Og interacted with each other; both only compare Israel's treatment of Og to its earlier
  treatment of Sihon. Re-read Numbers 21:21-35 and Deuteronomy 2:26-3:13 in full again looking
  specifically for any verse placing Sihon and Og in the same scene together — none exists; Sihon's
  narrative (Num 21:21-31, Deut 2:26-37) and Og's narrative (Num 21:33-35, Deut 3:1-11) are fully
  sequential and non-overlapping. No discrepancy from initial finding.

**Second full read-through (checking for contradictions between findings):** Finding 1 and Finding 2
both propose removing a relationship from `seedRelationships()` (lines 109-114), but they target
different lines (113 vs. 110) with no overlap in the affected relationship rows, no shared proposed
keys, and no dependency of one finding's correction on the other's. Removing both leaves
`sihon enemy_of moses` and `og enemy_of moses` (lines 111-112) untouched, which remain accurate and
are not implicated by either finding. No contradictions found between the two findings, and neither
finding conflicts with anything stated in the "Priority-item summary" or "Items considered but not
included" sections above.

**Coverage re-confirmation:** Re-ran `grep -c "await safeInsertPerson" scripts/seed-deuteronomy.ts`
(= 2), `grep -cE "await insertRel\(|await insertRelByName\(|await insertRelNameToLocal\("
scripts/seed-deuteronomy.ts` (= 4), and `grep -c "await insertRef(" scripts/seed-deuteronomy.ts`
(= 12) a second time immediately before finalizing this document; all three counts match the header
line above.
