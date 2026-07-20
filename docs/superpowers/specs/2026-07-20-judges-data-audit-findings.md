# Judges People & Relationships Data Audit — Findings

**Date:** 2026-07-20
**Source of truth:** ESV, fetched live for every claim checked (WebFetch/WebSearch; no claim answered from training-data memory)

Reviewed: 22 people, 23 relationships, 23 refs. 1 finding.

---

## Finding 1: Othniel's relationship to Caleb — "brother" vs. "nephew" is a genuine, long-standing textual ambiguity that the DB resolves silently in favor of one contested reading

- **Category:** Unsupported
- **Verse(s):** Judges 1:13, Judges 3:9, Joshua 15:17 — ESV, confirmed by live fetch in this session. The ESV renders all three: "Othniel the son of Kenaz, Caleb's younger brother" (Judg 1:13, 3:9) and "Othniel the son of Kenaz, the brother of Caleb" (Josh 15:17).
- **Current DB state:** `scripts/seed-judges.ts` line 88's `othniel.description` states "Son of Kenaz, Caleb's younger brother (Judg 3:9)" — asserting Othniel himself is Caleb's brother. Line 206's relationship `insertRelByName("Caleb", "sibling_of", "Othniel", "Othniel is son of Kenaz, Caleb's brother (Josh 15:17)")` encodes this as a direct `sibling_of` edge between Caleb and Othniel.
- **Why this is flagged rather than silently accepted:** The Hebrew/English syntax of "Othniel son of Kenaz, [Caleb's] younger brother" is genuinely ambiguous about which noun "Caleb's younger brother" modifies — Kenaz (making Othniel Caleb's *nephew*, son of Caleb's brother) or Othniel (making Othniel and Caleb *brothers* directly, and Kenaz an unrelated or same-named figure). This is not a fringe objection: it is documented as an open crux across ancient versions and standard modern commentaries.
  - Ancient versions split: the Masoretic Text favors reading "younger brother of Caleb" as applying most naturally in a way ancient translators disagreed over — the LXX(A) favors one reading, while the Peshitta, Vulgate, and LXX(B) favor the other.
  - Modern commentaries split: Ellicott's Commentary notes the Masoretes "understood the words" as Othniel being "brother of Caleb" directly, and observes it would be "strange" that Othniel is never then called "son of Jephunneh" (Caleb's father) if that were so. The Cambridge Bible for Schools and Colleges states plainly: "the language leaves it uncertain whether Othniel was the nephew... or the brother of Caleb; but tradition favours the latter alternative" (i.e., tradition favors "brother").
  - Popular reference sites (BibleRef.com, GotQuestions.org) lean toward the nephew reading, explicitly identifying Kenaz — not Othniel — as "Caleb's younger brother," making Othniel "a nephew of Caleb... also Caleb's son-in-law."
  - 1 Chronicles 4:13 lists only Othniel and Seraiah as "sons of Kenaz" and does not place Othniel in Caleb's own genealogy line, which is consistent with either reading and does not resolve it.
- **Assessment:** Because this is a live, unresolved interpretive crux rather than a case where the DB's description plainly contradicts the fetched text, I am not filing it as "Incorrect" — the DB's "brother" reading is a defensible, traditionally-attested position, not a misreading. But because the DB states it as settled fact ("Caleb's younger brother") and hard-codes it as a `sibling_of` relationship with no hedge, while a comparably weighty scholarly tradition holds Othniel was Caleb's nephew (with Kenaz as the actual brother), I'm flagging this per the audit brief's instruction to surface borderline items for the controller's judgment rather than silently decline them.
- **Proposed correction:** Two options for the controller to weigh, in order of how much they change existing data:
  1. **Minimal (recommended):** Leave the `sibling_of` relationship and description as-is (they reflect a real, traditionally-favored reading and match both Judg 3:9 and Josh 15:17's most surface-level parse), but soften the description's phrasing from a bare assertion to acknowledge the alternate reading, e.g.: "Son of Kenaz. Traditionally identified as Caleb's younger brother (Judg 3:9; Josh 15:17), though the Hebrew syntax is ambiguous and some readings make him Caleb's nephew instead (with Kenaz as Caleb's brother)." This keeps the existing `sibling_of` edge (the traditional/majority reading) while no longer stating a contested point as flatly settled.
  2. **No change:** Leave as-is with no hedge, on the grounds that "tradition favours" the brother reading per Cambridge Bible and this is the plain-sense parse of the ESV's own wording in both source verses — treat this finding as informational only, filed for the record rather than acted on.
- **Severity:** Minor — the relationship and description are not contradicted by the text (a defensible, traditionally-favored reading supports them); the concern is that a genuinely contested point is presented without any hedge, not that the data is factually wrong.

---

## Gilead naming check (priority item — checked and clear)

Per the task brief's specific priority: confirmed there is **no live name collision** between this file's Jephthah material and the Numbers-audit `gilead` person record (son of Machir, grandson of Manasseh, from Zelophehad's genealogy, Num 26:29 — see `docs/superpowers/specs/2026-07-16-numbers-data-audit-findings.md` Finding 7).

- Ran `grep -on 'key: "[a-z_0-9]*"' scripts/seed-judges.ts` and confirmed the full list of 22 keys in this file: `othniel, cushan, ehud, eglon, shamgar, deborah, barak, sisera, jabin, jael, heber, gideon, joash_gideon, zebah, zalmunna, abimelech, jotham, jephthah, jephthah_daughter, manoah, samson, delilah`. No `gilead` key exists anywhere in this file.
- "Gilead" appears in `scripts/seed-judges.ts` only twice, both as prose, never as a `key:`-based person record:
  - Line 178, Jephthah's `description`: "Son of Gilead by a prostitute... Recalled by the elders of Gilead to fight the Ammonites..." — here "Gilead" is used both as Jephthah's father's name and, in the same sentence, as the name of the region/clan he leads, matching Judg 11:1's own dual usage ("Jephthah the Gileadite... Gilead was the father of Jephthah") confirmed by live fetch.
  - Line 232: `insertRelNameToLocal("Gad", "ancestor_of", "jephthah", "Jephthah is from Gilead in Transjordan (Judg 11:1)")` — Jephthah's tribal-origin relationship routes through the tribe **Gad**, not through any `gilead` key. This is textually reasonable: the region of Gilead in Transjordan was allotted primarily to the tribe of Gad (with the southern part shared by half-Manasseh), so anchoring Jephthah's tribal origin to Gad via `ancestor_of` is a defensible simplification, not an error. (Minor observation, not a finding: Gilead's territory technically spans both Gad and half-Manasseh, so a stricter model might hedge the tribe attribution, but this matches the same level of precision used elsewhere in this file, e.g. Gideon's own `ancestor_of Manasseh` link.)
- Conclusion: **no collision exists.** This file's "Gilead" (Jephthah's father/clan-region) and the Numbers seed's `gilead` (son of Machir, grandson of Manasseh) are correctly kept as textually separate, unlinked figures — this file never creates a `gilead` key or points any relationship at one. No Structural gap finding is warranted for this item.

---

## Findings Summary Table

| # | Finding | Category | Severity |
|---|---------|----------|----------|
| 1 | Othniel/Caleb relationship ("brother" vs. "nephew") stated without hedging a genuine textual ambiguity | Unsupported | Minor |

---

## Verification notes

**Coverage counts (grep-verified against `scripts/seed-judges.ts` before writing the summary line above):**
- People: `grep -c "await safeInsertPerson" scripts/seed-judges.ts` → 22
- Relationships: `grep -cE "await insertRel(ByName|NameToLocal)?\(" scripts/seed-judges.ts` → 23
- Refs: `grep -c "await insertRef(" scripts/seed-judges.ts` → 23

**Numeric details cross-checked against live-fetched ESV text (all confirmed accurate, no discrepancies):**
- Othniel: 8 years under Cushan-rishathaim (Judg 3:8); 40 years' rest (3:11).
- Ehud: 18 years under Eglon, with Ammonite/Amalekite allies (3:12-14); sword "a cubit in length" (~18 in.) strapped to right thigh despite left-handedness (3:16); ~10,000 Moabites killed (3:29); 80 years' rest (3:30).
- Shamgar: 600 Philistines killed with an oxgoad (3:31).
- Jabin: 20 years' oppression (4:3); "they destroyed Jabin" (4:24).
- Sisera: 900 iron chariots (4:3, 4:13); based at Harosheth-hagoyim (4:2); routed by the Lord "before Barak" (4:15); killed by Jael with tent peg and hammer while asleep (4:21); Song of Deborah's "most blessed of women is Jael" (5:24) and mother-at-the-window scene (5:28-30) both confirmed.
- Barak: led 10,000 from Naphtali/Zebulun to Mount Tabor (4:6); named alongside Gideon, Samson, Jephthah in Heb 11:32.
- Heber: "had separated from the Kenites, the descendants of Hobab the father-in-law of Moses" (4:11); clan at peace with Jabin king of Hazor specifically (4:17), not Sisera.
- Gideon: clan "weakest in Manasseh" (6:15); called at the winepress threshing wheat (6:11); fleece test both nights (6:36-40); renamed Jerubbaal after tearing down Baal's altar (6:32); 300 selected by the lapping test from an initial 32,000 (7:2-7); refused kingship, "the Lord will rule over you" (8:23); 1,700 shekels of gold ephod (8:26); 70 sons by wives, Abimelech by a Shechemite concubine (8:30-31).
- Zebah/Zalmunna: captured at Karkor, explicitly titled "the kings of Midian" (8:5-12), east of the Jordan; killed personally by Gideon in revenge for brothers slain at Tabor (8:18-21).
- Abimelech: killed 70 brothers on one stone, only Jotham escaped (9:5); ruled 3 years (9:22); killed by a woman's millstone at Thebez, had armor-bearer finish him (9:53-54).
- Jotham: delivered the Parable of the Trees (olive, fig, vine, then the bramble/thornbush accepts and threatens fire) from Mount Gerizim (9:6-15).
- Jephthah: son of Gilead by a prostitute, driven out by brothers, fled to the land of Tob (11:1-3); recalled by Gilead's elders (11:4-11); vow's exact wording — "whatever comes out from the doors of my house" (11:30-31); daughter met him "with tambourines and with dances" (11:34), asked for 2 months to mourn her virginity, commemorated 4 days yearly by the daughters of Israel (11:37-40); Shibboleth test and exactly 42,000 Ephraimites killed (12:5-6); judged Israel 6 years (12:7).
- Samson: Danite from Zorah, father Manoah, mother initially barren (13:2); angel ascended in the altar's flame, Manoah's fear of death (13:20-22); traveled to Timnah with his parents (14:5, confirming the description's "traveled to Timnah for Samson's wedding" detail, sourced from ch. 14 even though Manoah's own ref range is capped at 13:25 — the wedding trip is Samson's narrative, correctly covered by Samson's own 13:24-16:31 ref); killed a lion bare-handed (14:6); 30 companions, wager of 30 linen garments/30 changes of clothes, 30 men of Ashkelon killed (14:11-19); 300 foxes with torches (15:4-5); ~1,000 Philistines killed with a fresh donkey jawbone (15:15-16); carried Gaza's gates to the hill before Hebron (16:3); Delilah from the Valley of Sorek, 1,100 pieces of silver per lord (16:4-5); three false secrets (bowstrings, new ropes, woven hair) then the real Nazirite secret on the fourth attempt (16:7-17); eyes gouged out, ground grain in prison (16:21); pulled down Dagon's temple pillars (16:29-30); judged Israel 20 years (15:20, 16:31).

**Gilead priority check:** see dedicated section above — confirmed clear, no collision.

**Triple-check (Step 5):** Re-verified the Othniel/Caleb ambiguity against Judg 1:13, 3:9, and Josh 15:17 a second time, and re-ran the `key:` grep against `scripts/seed-judges.ts` a second time to reconfirm no `gilead` key exists. Re-checked all numeric details listed above a second time against the original fetch results; no transpositions or misreadings found (years, casualty counts, and measurements all match on re-check).

**Second full read-through (checking for contradictions between findings):** Only one finding exists, so no cross-finding contradiction is possible. The Gilead priority section and Finding 1 concern entirely different people (Jephthah's ancestry/tribe vs. Othniel's relationship to Caleb) and do not overlap in scope, keys, or proposed changes.

**Collision check performed within this document:** No new person keys or relationships are proposed by Finding 1 (it proposes only a description-text edit, no key/relationship changes). The Gilead check confirms no `gilead` key collision exists in this file. No other collision risk identified.
