# Numbers Data Audit — Findings

Reviewed: 28 people, 31 relationships, 50 refs. 7 findings.

Single-pass audit of `scripts/seed-numbers.ts` (per `docs/superpowers/specs/2026-07-16-numbers-data-audit-design.md`),
cross-referenced against the ESV text fetched live via WebFetch (biblegateway.com/ESV and esv.org pages)
in this session — no claim below is answered from memory. Counts were grep-verified directly against
the file: `safeInsertPerson` calls in lines 99-246 = 28; relationship calls (`insertRel` +
`insertRelByName` + `insertRelNameToLocal`, lines 248-298) = 31; `insertRef` calls (lines 300-365) = 50.

## Chain-tracing summary (Step 3 priority items)

**Levitical clan heads → Levi (Num 3:17-20):** The chain `Levi → parent_of → Gershon`,
`Levi → parent_of → Merari` (both in `scripts/seed-numbers.ts`), plus `Levi → parent_of → Kohath`
and `Kohath → parent_of → Amram` (both already seeded in `scripts/seed-exodus.ts`), and
`Kohath → parent_of → Izhar` (`scripts/seed-numbers.ts` line 251) are all present and textually
correct — Numbers 3:17 ("Gershon and Kohath and Merari"), 3:19 ("Amram, Izhar, Hebron, and
Uzziel"), Exodus 6:18 all confirm this structurally. However, **Gershon's own sons (Libni,
Shimei) and Merari's own sons (Mahli, Mushi), explicitly named in Numbers 3:18 and 3:20, have
no person records or relationships anywhere in the codebase at all** — see Finding 4. This is an
asymmetry: Kohath's sons are represented (Izhar has a full record; Amram already existed via
Exodus), but Gershon's and Merari's sons are entirely absent, despite the brief specifically
calling out "Num 3:17-20" (which names all three clans' sons) as a trace target.

**Korah's rebellion family connections (Num 16:1):** `Izhar → parent_of → Korah` is present and
correct (`scripts/seed-numbers.ts` line 252, matching "Korah the son of Izhar, son of Kohath, son
of Levi" verbatim). But Numbers 16:1 also names **Eliab** as the father of Dathan and Abiram, and
**On son of Peleth** as a fourth named co-conspirator — neither has a person record in
`scripts/seed-numbers.ts`, nor anywhere else in the codebase (confirmed via full-repo grep). The
only "Eliab" in the file is `eliab_helon`, an unrelated Zebulunite prince (son of Helon) from a
different tribe — not the Reubenite Eliab of Numbers 16:1. Both gaps are documented as Findings 1
and 2 below.

---

## Finding 1: Eliab, father of Dathan and Abiram (Num 16:1), has no person record — the only "Eliab" in the database is an unrelated prince of Zebulun

- **Category:** Structural gap
- **Verse(s):** Numbers 16:1 ("Dathan and Abiram, the sons of Eliab") — ESV, confirmed by live fetch
- **Current DB state:** `dathan.description` and `abiram.description` (`scripts/seed-numbers.ts` lines 182-190) each say "Son of Eliab, a Reubenite" in prose, but no relationship or person record establishes this. The only person in the entire codebase named "Eliab" is `eliab_helon` (`scripts/seed-numbers.ts` line 110, `alsoKnownAs: "Eliab son of Helon"`), the prince of Zebulun appointed in Numbers 1:9 and 2:7 — a completely different individual from a different tribe. There is no `parent_of` relationship from any Eliab to `dathan` or `abiram`, and no separate "Eliab (Reubenite)" person key exists to link to. This mirrors the exact "description states a genealogical link, but the underlying graph data does not" pattern flagged in the Exodus audit's Finding 1 (Bezalel/Uri/Hur).
- **Proposed correction:** Add a new person record for Eliab the Reubenite (proposed key: `eliab_reuben`, to disambiguate from the existing `eliab_helon`), described as "A Reubenite, father of Dathan and Abiram (Num 16:1)." Add relationships `eliab_reuben → parent_of → dathan` and `eliab_reuben → parent_of → abiram`.
- **Notes for collision check:** Confirmed via `grep -n 'key: "'` across `scripts/seed-numbers.ts`, `scripts/seed-genesis.ts`, and `scripts/seed-exodus.ts` that no key `eliab_reuben` (or any bare `eliab`) exists — only `eliab_helon` exists, in this file. No collision found.
- **Severity:** Important

---

## Finding 2: On son of Peleth (Num 16:1), named alongside Korah, Dathan, and Abiram as a co-conspirator, has no person record at all

- **Category:** Missing
- **Verse(s):** Numbers 16:1 ("On the son of Peleth, sons of Reuben") — ESV, confirmed by live fetch
- **Current DB state:** Numbers 16:1 names four men at the head of the rebellion — Korah, Dathan, Abiram, and On. Korah, Dathan, and Abiram all have person records in `scripts/seed-numbers.ts`; On does not (confirmed via full-repo grep for "On" and "Peleth" — zero matches outside this citation). The text itself gives no further narrative about On after verse 1 (he is not mentioned again in the chapter), so this is a lower-confidence "worth flagging" item rather than a slam-dunk parity gap, but he is a named, tribally-identified individual (Reubenite, son of Peleth) explicitly grouped with the other three rebels in the same verse, and the brief calls for tracing this exact verse's family connections "end-to-end."
- **Proposed correction:** Add a minimal person record for On (proposed key: `on`), described as "Son of Peleth, a Reubenite. Named alongside Korah, Dathan, and Abiram at the head of the rebellion against Moses (Num 16:1); not mentioned again in the narrative." Optionally add `insertRelByName("On", "adversary_of", "Moses", ...)` paralleling the existing Korah/Dathan/Abiram relationships, and a `parent_of` link from a Peleth person record if one is ever added (Peleth itself has no other biblical footprint and is not proposed here).
- **Notes for collision check:** Confirmed via `grep -on 'key: "[a-z_0-9]*"'` across all seed files that no key `on` currently exists anywhere in the codebase. No collision found. (Flagging the short key as a minor future-collision risk given its generic spelling, but not a blocker.)
- **Severity:** Minor

---

## Finding 3: Pagiel's father is spelled "Ocran" in the database; the ESV consistently spells the name "Ochran"

- **Category:** Incorrect
- **Verse(s):** Numbers 1:13, 2:27, 7:72, 7:77, 10:26 (all "Pagiel the son of Ochran") — ESV, confirmed by live fetch
- **Current DB state:** `scripts/seed-numbers.ts` line 150: `alsoKnownAs: "Pagiel son of Ocran"`; line 152: description reads "Son of Ocran, prince of the tribe of Asher." Every ESV occurrence of this name (checked across all five references) spells it "Ochran," not "Ocran."
- **Proposed correction:** Update `alsoKnownAs` to `"Pagiel son of Ochran"` and the description to "Son of Ochran, prince of the tribe of Asher."
- **Severity:** Minor

---

## Finding 4: Gershon's and Merari's own sons (Numbers 3:18, 3:20) — Libni, Shimei, Mahli, and Mushi — have no person records, unlike Kohath's line where the corresponding generation (Izhar) is fully represented

- **Category:** Missing
- **Verse(s):** Numbers 3:18 ("the names of the sons of Gershon: Libni and Shimei"); Numbers 3:20 ("the sons of Merari: Mahli and Mushi") — ESV, confirmed by live fetch
- **Current DB state:** `scripts/seed-numbers.ts` seeds `gershon` and `merari` (lines 161-169) but neither has any listed children in the DB — no person records for Libni, Shimei, Mahli, or Mushi exist anywhere in the codebase (confirmed via grep; the one "Shimei" in the DB is an unrelated Benjaminite from `scripts/seed-2samuel.ts`). By contrast, Kohath's corresponding third-generation son Izhar is fully seeded with his own record, description, and `parent_of` relationship in this same file. This creates an inconsistency in how deep each of the three Levitical clans is traced, even though the brief specifically names "Num 3:17-20" — which covers all three clans' sons equally — as a trace priority. This is a borderline case for inclusion: Libni, Shimei, Mahli, and Mushi have essentially no further narrative role anywhere in Numbers beyond this census list (unlike Izhar, who matters because his son Korah rebels), so the omission may be an intentional narrative-relevance choice rather than an oversight. Flagging per the brief's instruction to include borderline observations rather than silently decline them.
- **Proposed correction:** If completeness of the Num 3:17-20 genealogical list is desired, add minimal person records for Libni, Shimei (Gershon's sons, proposed keys `libni`/`shimei_gershon` to disambiguate from the existing unrelated `shimei` key in `seed-2samuel.ts`), and Mahli, Mushi (Merari's sons, proposed keys `mahli`/`mushi`), each with a `parent_of` relationship from their respective father and a description noting their sole scriptural role is this census listing. If the controller judges these four to be out of narrative scope (no distinguishing acts, unlike Izhar), no action is needed and this finding can be closed as "accepted as intentional scope limit."
- **Notes for collision check:** `shimei` already exists as a key in `scripts/seed-2samuel.ts` (a different, unrelated Benjaminite) — any new record for Gershon's son must use a disambiguating key (e.g. `shimei_gershon`) to avoid collision. `libni`, `mahli`, and `mushi` do not collide with any existing key (confirmed via `grep -on 'key: "[a-z_0-9]*"'` across all seed files).
- **Severity:** Minor

---

## Finding 5: Mahlah is described as "Eldest daughter" and Tirzah as "Youngest daughter" of Zelophehad, but no cited passage uses birth-order language for any of the five daughters

- **Category:** Unsupported
- **Verse(s):** Numbers 26:33, 27:1, 36:11 (all list the five daughters by name, in the consistent order Mahlah, Noah, Hoglah, Milcah, Tirzah — except 36:11, which orders them Mahlah, Tirzah, Hoglah, Milcah, Noah) — ESV, confirmed by live fetch
- **Current DB state:** `scripts/seed-numbers.ts` line 220-223: `mahlah.description` begins "Eldest daughter of Zelophehad." Line 240-243: `tirzah_z.description` begins "Youngest daughter of Zelophehad." Live-fetched ESV text of all three passages (Num 26:33, 27:1, 36:11) lists the five names in sequence but never uses "eldest," "firstborn," "youngest," or any other birth-order term for any daughter — the ESV text of 36:11 does not even preserve a single consistent ordering (Mahlah is listed first there too, but Noah moves from second to last, and Tirzah moves from fifth to second), which undercuts even the weaker inference that list-order reflects birth order.
- **Proposed correction:** Remove the unsupported "Eldest daughter of" / "Youngest daughter of" claims from `mahlah.description` and `tirzah_z.description`, replacing with neutral phrasing consistent with the other three sisters' descriptions (e.g. "Daughter of Zelophehad," matching the pattern already used for Hoglah and Milcah).
- **Severity:** Minor

---

## Finding 6: Izhar's description states he is "Father of Korah, Nepheg, and Zichri," but only Korah has a person record — Nepheg and Zichri are entirely unseeded

- **Category:** Missing
- **Verse(s):** Exodus 6:21 ("The sons of Izhar: Korah, Nepheg, and Zichri") — ESV, confirmed by live fetch; corroborated by Numbers 3:19's listing of Kohath's sons including Izhar
- **Current DB state:** `scripts/seed-numbers.ts` line 173: `izhar.description` reads "Father of Korah, Nepheg, and Zichri." Only `korah` is seeded as a person (line 177) with the relationship `izhar → parent_of → korah` (line 252). Nepheg and Zichri have no person records or relationships anywhere in the codebase (confirmed via grep). This is a lower-severity, borderline finding similar to Finding 4 above — Nepheg and Zichri have no further narrative role in Numbers beyond this one genealogical mention, so the description accurately names them in prose even though they're not separately modeled as graph nodes. Included per the brief's instruction to flag borderline items rather than silently omit them, since the description itself creates an expectation of two more relationships that don't exist.
- **Proposed correction:** Either (a) accept as an intentional scope limit (these two have no independent narrative), or (b) add minimal person records for Nepheg and Zichri with `parent_of` relationships from `izhar`, for full consistency with the description text.
- **Notes for collision check:** Confirmed via `grep -on 'key: "[a-z_0-9]*"'` across all seed files that neither `nepheg` nor `zichri` collides with any existing key.
- **Severity:** Minor

---

## Finding 7: Zelophehad's own genealogy — Manasseh → Machir → Gilead → Hepher → Zelophehad — has three of its four named intermediate generations (Machir, Gilead, Hepher) missing as person records entirely, and the only relationship on file skips straight from Manasseh to Zelophehad

- **Category:** Structural gap
- **Verse(s):** Numbers 27:1 ("the daughters of Zelophehad the son of Hepher, son of Gilead, son of Machir, son of Manasseh, from the clans of Manasseh the son of Joseph"); Numbers 26:29-33 ("The sons of Manasseh: of Machir, the clan of the Machirites; and Machir was the father of Gilead; of Gilead, the clan of the Gileadites... and of Hepher, the clan of the Hepherites. Now Zelophehad the son of Hepher had no sons, but daughters.") — ESV, confirmed by live fetch in this session
- **Current DB state:** `scripts/seed-numbers.ts` line 217's `zelophehad.description` asserts "Son of Hepher, from the clan of Gilead, tribe of Manasseh" — prose that itself names two of the three missing intermediate generations (Hepher, Gilead) plus the top-level tribe (Manasseh), but omits Machir by name. The two scripture refs cited for Zelophehad (`insertRef("zelophehad", "Numbers", 27, 1, 27, 11, ...)` and `insertRef("zelophehad", "Numbers", 36, 1, 36, 12, ...)`, lines 351-352) point directly at the passages that spell out the full four-generation chain. Yet none of Hepher, Gilead, or Machir exist as person records anywhere in the codebase (confirmed via full-repo grep — the only "Gilead" hits are an unrelated place-name/patronymic use in `seed-judges.ts` for Jephthah's father, and incidental "Gilead"/"Ramoth-gilead" place references in `seed-1kings.ts`/`seed-2kings.ts`; zero matches for "Hepher" or "Machir" anywhere). The only relationship connecting Zelophehad to his line at all is a single `insertRelNameToLocal("Manasseh", "ancestor_of", "zelophehad", "Zelophehad is from the clan of Manasseh (Num 27:1)")` (line 295), which uses the vaguer `ancestor_of` predicate specifically because it skips three explicitly-named intermediate generations rather than modeling a direct `parent_of` chain. This is the same "Structural gap" pattern as Finding 1 (Eliab/Dathan/Abiram) — a description and/or relationship asserts a genealogical link, but the underlying graph data omits the named intermediate generations — except here three full generations are missing rather than one individual.
- **Proposed correction:** Add three new person records: `machir` ("Son of Manasseh, grandson of Joseph. Father of Gilead. Clan head of the Machirites (Num 26:29)."), `gilead` ("Son of Machir, grandson of Manasseh. Father of Hepher. Clan head of the Gileadites (Num 26:29); the region of Gilead in Transjordan is named after this clan, not to be confused with Jephthah's unrelated father of the same name in `seed-judges.ts`."), and `hepher` ("Son of Gilead, great-grandson of Manasseh. Father of Zelophehad. Clan head of the Hepherites (Num 26:32-33)."). Add the direct chain `manasseh → parent_of → machir`, `machir → parent_of → gilead`, `gilead → parent_of → hepher`, `hepher → parent_of → zelophehad`. On the existing `manasseh ancestor_of zelophehad` relationship: recommend **removing** it once the direct four-link `parent_of` chain is in place. The `ancestor_of` link was a coarse stand-in for exactly the chain this finding proposes to model explicitly; keeping both would leave a redundant, lower-precision edge duplicating information the new direct chain expresses more accurately, and no other finding or feature appears to depend on the `ancestor_of` edge specifically (unlike, say, a tribal-prince pattern where `ancestor_of` is the deliberate, permanent modeling choice for princes with no further traced lineage — see the twelve `insertRelNameToLocal(..., "ancestor_of", ...)` calls for the census princes, which are not proposed for replacement here since no intermediate generations are named in their case).
- **Notes for collision check:** Confirmed via `grep -on 'key: "[a-z_0-9]*"'` across all seed files that no key `machir`, `gilead`, or `hepher` currently exists anywhere in the codebase. Note that a different "Gilead" (Jephthah's father, an unrelated individual, in `scripts/seed-judges.ts`) exists only as prose/description text, not as a `key:`-based person record, so there is no key collision, but the new `gilead` person's description should disambiguate from Jephthah's father as noted above to avoid reader confusion given the shared name.
- **Severity:** Important
- **Scope note:** Manasseh originates in `seed-genesis.ts`, so the new `manasseh parent_of machir` edge and the deleted `manasseh ancestor_of zelophehad` edge both touch a Genesis-seeded person. This finding does not re-audit Manasseh himself — it only attaches new Numbers-native descendants (Machir, Gilead, Hepher) to an existing anchor, and the edge being removed was itself Numbers-seeded (line 295). Treated as in-scope on that basis, consistent with the Exodus audit's identical precedent (attaching Uri between the Exodus-native Hur and Bezalel).

---

## Findings Summary Table

| # | Finding | Category | Severity |
|---|---------|----------|----------|
| 1 | Eliab (father of Dathan/Abiram, Num 16:1) has no person record; only unrelated `eliab_helon` exists | Structural gap | Important |
| 2 | On son of Peleth (Num 16:1), named with the other three rebels, has no person record | Missing | Minor |
| 3 | Pagiel's father spelled "Ocran" in DB vs. ESV's consistent "Ochran" | Incorrect | Minor |
| 4 | Gershon's sons (Libni, Shimei) and Merari's sons (Mahli, Mushi), Num 3:18/3:20, entirely unseeded — asymmetric with Kohath's line (Izhar) | Missing | Minor |
| 5 | Mahlah "Eldest daughter" / Tirzah "Youngest daughter" claims not supported by any cited birth-order language in the text | Unsupported | Minor |
| 6 | Izhar's description names Nepheg and Zichri as sons, but neither is seeded as a person | Missing | Minor |
| 7 | Zelophehad's genealogy (Num 27:1, 26:29-33) — Machir, Gilead, Hepher — three intermediate generations missing; only a coarse `ancestor_of` link from Manasseh exists | Structural gap | Important |

**Totals:** 0 Critical, 2 Important, 5 Minor. 2 Structural gap, 1 Incorrect, 3 Missing, 1 Unsupported.

---

## Triple-Check Pass (Step 5)

**First re-verification (re-checked each finding individually against fetched text):**
- Finding 1: Re-read `scripts/seed-numbers.ts` lines 182-190 and full-repo grep for "Eliab"/"eliab" directly. Re-confirmed Numbers 16:1 ESV reads "Dathan and Abiram, the sons of Eliab" and that the only Eliab person record anywhere is `eliab_helon` (a Zebulunite, per Num 1:9/2:7 — a different tribe and clearly a different individual). No discrepancy.
- Finding 2: Re-read Numbers 16:1 ESV ("On the son of Peleth, sons of Reuben") and re-confirmed via grep that no "On" or "Peleth" person exists in any seed file. No discrepancy.
- Finding 3: Re-fetched Numbers 1:13 and cross-checked against 2:27, 7:72, 7:77, and 10:26 — all five spell it "Ochran." Re-read `scripts/seed-numbers.ts` line 150/152 confirming "Ocran" (no h) in both the `alsoKnownAs` and description fields. No discrepancy.
- Finding 4: Re-confirmed Numbers 3:18 ("Libni and Shimei") and 3:20 ("Mahli and Mushi") via live fetch, and re-grepped the full codebase confirming none of these four names appear as Levitical person records (the only "Shimei" match is the unrelated 2 Samuel Benjaminite). No discrepancy.
- Finding 5: Re-fetched Numbers 26:33, 27:1, and 36:10-12 verbatim. Confirmed no birth-order term appears in any of the three, and specifically confirmed 36:11's order is "Mahlah, Tirzah, Hoglah, Milcah, and Noah" — different from 26:33/27:1's "Mahlah, Noah, Hoglah, Milcah, and Tirzah" — which weakens rather than strengthens any list-position inference. No discrepancy.
- Finding 6: Re-fetched Exodus 6:21 ("The sons of Izhar: Korah, Nepheg, and Zichri") and re-confirmed via grep that only `korah` exists as a person record among the three. No discrepancy.
- Finding 7 (added after this document's initial review round, per task-review feedback): Re-fetched Numbers 27:1 and 26:29-33 ESV directly and re-confirmed the chain Manasseh → Machir → Gilead → Hepher → Zelophehad, and re-grepped the codebase confirming zero `key:`-based person records for `machir`, `gilead`, or `hepher`. No discrepancy.

**Second full read-through (checking for contradictions between findings):** Findings 1 and 2 both concern Numbers 16:1 but touch entirely distinct individuals (Eliab vs. On) with no overlapping proposed keys or relationships. Finding 4 and Finding 6 are both "Missing" findings about unseeded sons of Levitical figures (Gershon/Merari's sons vs. Izhar's other two sons) — they are complementary, not contradictory, and use disjoint proposed keys (`libni`/`shimei_gershon`/`mahli`/`mushi` vs. `nepheg`/`zichri`), with Finding 4 explicitly noting the `shimei` collision risk against `seed-2samuel.ts` that Finding 6 does not share. Finding 3 (Ocran/Ochran) and Finding 5 (Mahlah/Tirzah birth order) are isolated single-field corrections with no dependency on any other finding. Finding 7 shares its Manasseh anchor with the pre-existing `manasseh ancestor_of zelophehad` edge it proposes to delete, but touches no keys or relationships from Findings 1-6. No contradictions found across the seven findings.

**Collision check performed within this document (not just reported separately):** All proposed keys (`eliab_reuben`, `on`, `libni`, `shimei_gershon`, `mahli`, `mushi`, `nepheg`, `zichri`) were checked via `grep -on 'key: "[a-z_0-9]*"'` against every seed file in `scripts/` (`seed-genesis.ts`, `seed-exodus.ts`, `seed-numbers.ts`, and all other book seed files present in the repo). No collisions found for any proposed key. `shimei_gershon` was deliberately chosen instead of a bare `shimei` specifically because that bare key is already taken by an unrelated person in `seed-2samuel.ts`.
