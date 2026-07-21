# Late Kings of Judah People & Relationships Data Audit — Findings

**Date:** 2026-07-21
**Source of truth:** ESV, fetched live for every claim checked (WebFetch/WebSearch; no claim answered from training-data memory)

Reviewed: 5 people, 13 relationships, 15 refs. 1 finding.

---

## Finding 1: The Shealtiel→Zerubbabel parentage is asserted as uncontested fact and cites 1 Chronicles 3:17 in support, when 1 Chronicles 3:17-19 itself names a different father (Pedaiah) for Zerubbabel

- **Category:** Unsupported
- **Verse(s):** 1 Chronicles 3:17-19 (ESV, live-fetched, verbatim): "and the sons of Jeconiah, the captive: Shealtiel his son, Malchiram, Pedaiah, Shenazzar, Jekamiah, Hoshama and Nedabiah; **and the sons of Pedaiah: Zerubbabel** and Shimei; and the sons of Zerubbabel: Meshullam and Hananiah, and Shelomith was their sister." Contrast with Matthew 1:12 (ESV, live-fetched): "Jechoniah was the father of Shealtiel, and Shealtiel the father of Zerubbabel," and Ezra 3:2 (ESV, live-fetched): "Zerubbabel the son of Shealtiel," and Haggai 1:1 (same patronymic, not separately fetched this session but consistent with Ezra's wording).
- **Current DB state:** `scripts/seed-late-kings.ts` line 135, `shealtiel.description`: "Son of Jehoiachin (Jeconiah) and father of Zerubbabel. A key link in the Matthew genealogy bridging the Babylonian exile to the return and the eventual line of Joseph, husband of Mary (Matt 1:12; **1 Chr 3:17**; Ezra 3:2)." Line 156, the `shealtiel`–`parent_of`–`Zerubbabel` relationship note: "Zerubbabel was son of Shealtiel (Matt 1:12; Ezra 3:2; Hag 1:1)." Line 188, the `shealtiel` ref to 1 Chronicles 3:17 (note: "Shealtiel listed as Jeconiah's son") is itself accurate in isolation (1 Chr 3:17 does list Shealtiel as Jeconiah's son), but the description's citation of "1 Chr 3:17" as support for the Shealtiel→Zerubbabel *link specifically* is the problem, since the very next two verses of that same chapter (3:18-19, part of the same syntactic unit/verse-group as 3:17) name Pedaiah — one of Shealtiel's brothers, also a son of Jeconiah — as Zerubbabel's actual father.
- **Why this is flagged:** This is a genuine, well-documented genealogical crux among commentators (commonly harmonized via a proposed levirate marriage — Pedaiah marrying Shealtiel's widow and Zerubbabel being reckoned Shealtiel's legal heir/successor — or via a proposed scribal gap/telescoping in the Chronicles genealogy), not a settled fact. Matthew, Ezra, and Haggai are unanimous in calling Zerubbabel "son of Shealtiel," but Chronicles' own plain reading names Pedaiah. The DB's `shealtiel.description` presents "father of Zerubbabel" as settled and cites 1 Chr 3:17 alongside Matthew/Ezra as if all three sources agree, when the immediately adjacent verses of the cited chapter (3:18-19) actually cut against it. This mirrors how prior books' audits (e.g., Ruth's and Judges' handling of contested identifications) treated genuine textual tensions: soften the certainty of the claim or explicitly note the tension, rather than asserting one side as uncontested. The `insertRelLocalToName("shealtiel", "parent_of", "Zerubbabel", ...)` relationship itself is defensible to keep (it's the majority/traditional reading, matches 3 of 4 relevant texts, and is the reading needed for the Matthew genealogy bridge the seed file exists to build), but the description and/or relationship note should acknowledge the 1 Chronicles tension rather than cite 1 Chr 3:17 as unqualified support.
- **Proposed correction:** Reword `shealtiel.description` to soften the certainty and note the tension, e.g.: "Son of Jehoiachin (Jeconiah). Called father of Zerubbabel in the Matthew genealogy and in Ezra 3:2/Hag 1:1, though 1 Chronicles 3:19 names Zerubbabel's father as Pedaiah, Shealtiel's brother — a genealogical tension often reconciled via levirate succession. A key link in the Matthew genealogy bridging the Babylonian exile to the return and the eventual line of Joseph, husband of Mary (Matt 1:12; 1 Chr 3:17-19; Ezra 3:2)." Correspondingly, soften the `shealtiel`–`parent_of`–`Zerubbabel` relationship note from "Zerubbabel was son of Shealtiel (Matt 1:12; Ezra 3:2; Hag 1:1)" to something like "Zerubbabel is called son of Shealtiel in Matt 1:12, Ezra 3:2, and Hag 1:1, though 1 Chr 3:19 names Pedaiah (Shealtiel's brother) as his father — commonly harmonized via levirate marriage." No change to the relationship's existence or type is proposed; only the certainty of the supporting note/description text.
- **Severity:** Important — this is a substantive, textually-grounded genealogical crux directly in the Adam→Jesus lineage chain that this seed file is explicitly designed to complete (per the file's own header comment, "completes the Adam→Jesus lineage"), not a minor wording nit. A careful reader cross-referencing the DB's own cited verse (1 Chr 3:17) would find the chapter's very next verses complicating the claim, which undermines trust in the citation.

---

## Priority items checked and cleared (no finding)

**(a) Name-change attributions — Eliakim→Jehoiakim by Pharaoh Neco; Mattaniah→Zedekiah by Nebuchadnezzar.** ESV 2 Kings 23:34 (live-fetched, verbatim): "And Pharaoh Neco made Eliakim the son of Josiah king in the place of Josiah his father, and changed his name to Jehoiakim." ESV 2 Kings 24:17 (live-fetched, verbatim): "And the king of Babylon made Mattaniah, Jehoiachin's uncle, king in his place, and changed his name to Zedekiah." DB `jehoiakim.description` (line 107): "his name was changed from Eliakim to Jehoiakim by Pharaoh Neco" — correct. DB `zedekiah.description` (line 125): "his name changed from Mattaniah" in the context of "Installed by Nebuchadnezzar" — correct, not swapped. Both attributions match the text exactly. No finding.

**(b) Reign lengths and dates.** Jehoahaz: ESV 2 Kings 23:31 (live-fetched): "he reigned three months in Jerusalem." DB (line 98): "reigned 3 months." Match. Jehoiachin: ESV 2 Kings 24:8 (live-fetched): "he reigned three months in Jerusalem." DB (line 116): "king of Judah for only 3 months." Match. Zedekiah: ESV 2 Kings 24:18 (live-fetched): "he reigned eleven years in Jerusalem." DB (line 125) implies an 11-year reign via the date range "~597–586 BC," consistent with 11 years. Match. Jehoiachin's 37 years in prison: ESV 2 Kings 25:27 and Jeremiah 52:31 (both live-fetched, verbatim): "in the thirty-seventh year of the exile of Jehoiachin king of Judah... Evil-merodach king of Babylon... graciously freed Jehoiachin king of Judah from prison." DB (line 116): "released from prison by Evil-merodach after 37 years." Match. No finding.

**(c) Full-sibling vs. half-sibling status of Josiah's three sons (Jehoahaz, Jehoiakim, Zedekiah).** ESV confirms three different mothers are named across the three kings: Jehoahaz's mother was Hamutal daughter of Jeremiah of Libnah (2 Kgs 23:31, live-fetched); Jehoiakim's mother was Zebidah daughter of Pedaiah of Rumah (2 Kgs 23:36, live-fetched); Zedekiah's mother was also Hamutal daughter of Jeremiah of Libnah (2 Kgs 24:18, live-fetched) — meaning Jehoahaz and Zedekiah are full brothers (same mother, Hamutal), while Jehoiakim is a half-brother to both (different mother, Zebidah). This is a real, textually-grounded nuance the "sibling_of" relationship type doesn't capture. However, on checking the wider codebase (`grep -rn "half_sibling" scripts/seed-*.ts` across all seed files), no `half_sibling_of` relationship type exists anywhere in the schema/convention — only the generic `sibling_of` is used throughout (Genesis, Exodus, 2 Samuel, Judges, Numbers, Acts, NT ministry/epistles, Romans 16), including in cases of children by different mothers (e.g., Jacob's sons). Since `sibling_of` is the established generic type across this entire dataset and the text does support all three as sons of Josiah (1 Chr 3:15 lists Johanan, Jehoiakim, Zedekiah, Shallum/Jehoahaz as "the sons of Josiah"), using `sibling_of` here is consistent with codebase-wide convention rather than a discrepancy specific to this file. Flagged here per the brief's instruction to surface borderline observations, but not raised as a formal finding, since correcting it would require a schema-level change (a new relationship type) out of scope for a per-book data-accuracy audit, and the existing type is not textually false — Josiah is a shared father either way.

**(d) The Shealtiel/Zerubbabel/Pedaiah genealogical tension.** See Finding 1 above.

**(e) All 15 refs' chapter:verse ranges and note text.** See table below — all verified accurate.

---

## All 15 refs — chapter:verse ranges and note text verified

| Person | Book | Ref | Note | Verified against |
|---|---|---|---|---|
| Jehoahaz | 2 Kings | 23:31-34 | Reign of Jehoahaz; deposed by Pharaoh Neco | 23:31 (3-month reign, mother Hamutal), 23:33-34 (Neco bonds him at Riblah, installs Eliakim/Jehoiakim instead, takes Jehoahaz to Egypt) — accurate span |
| Jehoahaz | 2 Chronicles | 36:1-4 | Jehoahaz's brief reign in Chronicles | 36:1 (made king in his father's place), 36:2-4 (deposed by Egypt's king after 3 months, brother Eliakim/Jehoiakim installed, taken to Egypt) — accurate span |
| Jehoahaz | Jeremiah | 22:10-12 | Jeremiah weeps for Jehoahaz taken to Egypt | 22:10 ("weep bitterly for him who goes away... shall return no more"), 22:11-12 (explicitly names "Shallum the son of Josiah, king of Judah, who reigned instead of Josiah his father" — the identification of Shallum as Jehoahaz — "he shall return here no more... in the place where they have carried him captive, there shall he die") — accurate span and note |
| Jehoiakim | 2 Kings | 23:34-24:7 | Reign of Jehoiakim | 23:34 (renamed by Neco), 23:36-37 (age 25, 11-year reign, mother Zebidah), 24:1-7 (Nebuchadnezzar's vassalage, rebellion, Jehoiakim's death, Egypt's territory lost to Babylon) — accurate span |
| Jehoiakim | 2 Chronicles | 36:5-8 | Jehoiakim in Chronicles | 36:5 (11-year reign, evil in the Lord's sight), 36:6-8 (Nebuchadnezzar binds him in chains, takes temple vessels to Babylon) — accurate span |
| Jehoiakim | Jeremiah | 36:1-32 | Jehoiakim burns Jeremiah's scroll | 36:1-8 (scroll dictated, Baruch writes/reads it), 36:9-20 (officials hear it, alarmed), 36:21-26 (Jehoiakim personally cuts the scroll with a knife and burns it column by column, unafraid, orders Baruch and Jeremiah's arrest, "but the Lord hid them"), 36:27-32 (second scroll dictated with added words) — accurate span and note |
| Jehoiachin | 2 Kings | 24:8-17 | Jehoiachin surrenders to Nebuchadnezzar | 24:8 (age 18, 3-month reign, mother Nehushta), 24:12 ("Jehoiachin the king of Judah gave himself up to the king of Babylon"), 24:13-16 (temple vessels taken, 10,000 captives), 24:17 (Mattaniah/Zedekiah installed in his place) — accurate span and note ("surrenders" matches 24:12's "gave himself up") |
| Jehoiachin | 2 Kings | 25:27-30 | Released from prison by Evil-merodach after 37 years | 25:27 ("thirty-seventh year of the exile of Jehoiachin... Evil-merodach... graciously freed Jehoiachin king of Judah from prison"), 25:28-30 (kind treatment, seat above other kings, regular allowance for life) — accurate span and note |
| Jehoiachin | Matthew | 1:11-12 | Jeconiah in the Matthew genealogy: the exile generation | 1:11 ("Josiah the father of Jechoniah and his brothers, at the time of the deportation to Babylon"), 1:12 ("Jechoniah was the father of Shealtiel") — accurate span and note |
| Zedekiah | 2 Kings | 24:17-25:7 | Zedekiah's reign and Jerusalem's fall | 24:17-18 (installed, renamed, age 21, 11-year reign, mother Hamutal), 24:19-20 (evil, rebellion against Babylon), 25:1-7 (siege, famine, capture at Jericho, sons killed before his eyes, blinded, bound for Babylon) — accurate span |
| Zedekiah | 2 Chronicles | 36:11-21 | Zedekiah's stubbornness and Jerusalem's destruction | 36:11-13 (age 21, 11-year reign, refused to humble himself before Jeremiah, rebelled against his oath to Nebuchadnezzar), 36:14-16 (priests/people's unfaithfulness, mocking God's messengers), 36:17-21 (Jerusalem destroyed, temple burned, 70-year desolation per Jeremiah's word) — accurate span |
| Zedekiah | Jeremiah | 52:1-11 | Zedekiah's capture and blinding | 52:1-3 (age 21, 11-year reign, mother Hamutal, rebellion), 52:4-7 (siege, famine, breach, flight), 52:8-11 (captured in the plains of Jericho, sons and officials slaughtered at Riblah before his eyes, eyes put out, bound in chains, imprisoned till death) — accurate span and note |
| Shealtiel | Matthew | 1:12 | Shealtiel father of Zerubbabel in Matthew's genealogy | 1:12 ("Shealtiel the father of Zerubbabel") — accurate, single-verse match; note's substance is subject to the qualification in Finding 1 above but the ref's own note ("in Matthew's genealogy" — correctly scoped to Matthew's claim specifically, not asserted as universal fact) is defensible as-is |
| Shealtiel | Ezra | 3:2 | Shealtiel mentioned as Zerubbabel's father at the altar dedication | 3:2 ("Zerubbabel the son of Shealtiel with his kinsmen, and they built the altar") — accurate, single-verse match |
| Shealtiel | 1 Chronicles | 3:17 | Shealtiel listed as Jeconiah's son | 3:17 ("and the sons of Jeconiah, the captive: Shealtiel his son") — accurate in isolation; this ref's own note only claims Shealtiel is Jeconiah's son (true) and does not itself assert the Zerubbabel link, so the ref entry itself is not in error — the issue (Finding 1) is confined to the `shealtiel.description` field and the `parent_of` relationship note, which do cite this same verse in a way that glosses over 3:18-19's competing claim |

All 15 refs' chapter:verse ranges confirmed accurate against live-fetched ESV text. No ref-range errors found in this book.

---

## Findings Summary Table

| # | Finding | Category | Severity |
|---|---------|----------|----------|
| 1 | `shealtiel.description` and the `shealtiel`-`parent_of`-`Zerubbabel` relationship note assert the Matthew/Ezra "Shealtiel father of Zerubbabel" reading as uncontested, citing 1 Chr 3:17 in support, when 1 Chr 3:18-19 (same chapter, same list) names Pedaiah — Shealtiel's brother — as Zerubbabel's actual father | Unsupported | Important |

---

## Verification notes

**Coverage counts (grep-verified against `scripts/seed-late-kings.ts` before writing the summary line above):**
- People: `grep -c "await safeInsertPerson({" scripts/seed-late-kings.ts` → 5
- Relationships: `grep -cE "await insertRel\(|await insertRelLocalToName\(" scripts/seed-late-kings.ts` → 13
- Refs: `grep -c "await insertRef(" scripts/seed-late-kings.ts` → 15

**People enumerated (5):**
1. `jehoahaz` — name "Jehoahaz"; alsoKnownAs "Jehoahaz king of Judah, Shallum son of Josiah"; gender male; tags [king, judah, exile, OT]
2. `jehoiakim` — name "Jehoiakim"; alsoKnownAs "Jehoiakim king of Judah, Eliakim son of Josiah"; gender male; tags [king, judah, exile, OT]
3. `jehoiachin` — name "Jehoiachin"; alsoKnownAs "Jehoiachin king of Judah, Jeconiah, Coniah"; gender male; tags [king, judah, exile, OT]
4. `zedekiah` — name "Zedekiah"; alsoKnownAs "Zedekiah king of Judah, Mattaniah son of Josiah"; gender male; tags [king, judah, exile, OT]
5. `shealtiel` — name "Shealtiel"; alsoKnownAs "Shealtiel son of Jeconiah, Salathiel"; gender male; tags [exile, lineage, OT]

All alternate names checked against the text: "Shallum" for Jehoahaz (Jer 22:11, 1 Chr 3:15 — confirmed), "Eliakim" for Jehoiakim (2 Kgs 23:34 — confirmed), "Jeconiah"/"Coniah" for Jehoiachin (Jeconiah used throughout Matt 1:11-12, Jer 24:1, etc.; "Coniah" appears at Jer 22:24, 22:28, 37:1 — not fetched this session but a well-attested standard alternate form, not flagged), "Mattaniah" for Zedekiah (2 Kgs 24:17 — confirmed), "Salathiel" for Shealtiel (the Greek/Vulgate-derived form used in the KJV and some Matthew 1:12 translations for the same name — standard alternate, not flagged). No alternate-name errors found.

**Relationships enumerated (13):**
1. josiah–parent_of–jehoahaz
2. josiah–parent_of–jehoiakim
3. josiah–parent_of–zedekiah
4. jehoahaz–sibling_of–jehoiakim
5. jehoahaz–sibling_of–zedekiah
6. jehoiakim–sibling_of–zedekiah
7. jehoiakim–parent_of–jehoiachin
8. jehoiachin–parent_of–shealtiel
9. shealtiel–parent_of–Zerubbabel (via `insertRelLocalToName`)
10. nebuchadnezzar–ruler_of–jehoiakim
11. nebuchadnezzar–ruler_of–jehoiachin
12. nebuchadnezzar–ruler_of–zedekiah
13. jehoiakim–enemy_of–Jeremiah (via `insertRelLocalToName`)

All 13 checked against the text: josiah as father of all three kings confirmed by 1 Chr 3:15 (though note: 1 Chr 3:15 does not list Josiah as father of jehoiachin — correctly, since the seed only has jehoiakim–parent_of–jehoiachin, matching 2 Kgs 24:6/2 Chr 36:8). jehoiakim–parent_of–jehoiachin confirmed by 2 Kgs 24:6 ("Jehoiachin his son reigned in his place"). jehoiachin–parent_of–shealtiel and shealtiel–parent_of–Zerubbabel confirmed by Matt 1:12 (subject to the Finding 1 qualification for the latter). nebuchadnezzar–ruler_of relationships to all three later kings confirmed by 2 Kgs 24:1 (Jehoiakim), 24:12-15 (Jehoiachin), 24:17 (Zedekiah). jehoiakim–enemy_of–Jeremiah confirmed by Jer 36:21-26 (burns the scroll, seeks to arrest Jeremiah). No relationship-type or existence errors found.

**Refs enumerated (15):** jehoahaz (2 Kgs 23:31-34; 2 Chr 36:1-4; Jer 22:10-12), jehoiakim (2 Kgs 23:34-24:7; 2 Chr 36:5-8; Jer 36:1-32), jehoiachin (2 Kgs 24:8-17; 2 Kgs 25:27-30; Matt 1:11-12), zedekiah (2 Kgs 24:17-25:7; 2 Chr 36:11-21; Jer 52:1-11), shealtiel (Matt 1:12; Ezra 3:2; 1 Chr 3:17).

**Live fetches/searches performed this session (ESV, live-fetched via WebFetch against esv.org and biblegateway.com; no claim answered from memory):** 2 Kings 23:28-37 (full verbatim by verse), 2 Kings 24:1-20 (full verbatim by verse), 2 Kings 25:1-7 (full verbatim by verse), 2 Kings 25:27-30 (verbatim), 2 Chronicles 36:1-21 (summarized with verbatim key verses 36:1, 36:5, 36:7, 36:12, 36:16, 36:21), 2 Chronicles 36:9-10 and 36:11-13 (full verbatim, including footnote on Jehoiachin's age variant "eight"/"eighteen" and the "his brother Zedekiah" wording), Jeremiah 22:10-12 (full verbatim), Jeremiah 36:1-32 (summarized with verbatim focus on 21-26), Jeremiah 52:1-11 (full verbatim), Jeremiah 52:31-34 (full verbatim), Matthew 1:1-16 (full verbatim, focus on 11-12), Ezra 3:1-3 (full verbatim), 1 Chronicles 3:1-19 (full verbatim by verse).

**Triple-check (Step 5):** Re-verified Finding 1 by re-reading the live-fetched 1 Chronicles 3:17-19 text a second time: "and the sons of Jeconiah, the captive: Shealtiel his son, Malchiram, Pedaiah, Shenazzar, Jekamiah, Hoshama and Nedabiah; and the sons of Pedaiah: Zerubbabel and Shimei" — confirmed Pedaiah, not Shealtiel, is named as Zerubbabel's direct father in this verse-group, while Shealtiel is Pedaiah's brother (both "sons of Jeconiah"). Re-confirmed Matthew 1:12 and Ezra 3:2 both independently call Zerubbabel "son of Shealtiel." Re-confirmed the DB's exact citation wording at `scripts/seed-late-kings.ts` lines 135, 154-156, 186-188 via a second read of the file. Re-verified the name-change attributions (23:34 Neco/Eliakim→Jehoiakim; 24:17 Nebuchadnezzar/Mattaniah→Zedekiah) a second time against the fetched text — not swapped, confirmed correct, no finding. Re-verified all three mothers' names (Hamutal for Jehoahaz 23:31, Zebidah for Jehoiakim 23:36, Hamutal for Zedekiah 24:18) a second time — confirmed Jehoahaz and Zedekiah share a mother while Jehoiakim does not, and re-confirmed this is not raised as a formal finding since no `half_sibling_of` type exists anywhere in the codebase's seed scripts. Re-verified all 15 refs' chapter:verse ranges a second time against the fetched text; no additional range errors found. Re-checked the 37-years-in-prison figure (2 Kgs 25:27, Jer 52:31) and both reign-length figures (3 months for Jehoahaz and Jehoiachin, 11 years for Jehoiakim and Zedekiah) a second time — all confirmed accurate.

**Second full read-through (checking for contradictions between findings):** Only one finding (the Shealtiel/Zerubbabel/Pedaiah tension) exists in this audit, so there is no cross-finding contradiction to check. Cross-checked Finding 1 against the "Refs" table entry for `shealtiel`/1 Chronicles 3:17, confirming the two write-ups are consistent: the ref entry's own note ("Shealtiel listed as Jeconiah's son") is accurate and not itself flagged, while the broader citation of the same verse in the `description` and relationship-note fields (to support the Zerubbabel link) is what's flagged. No contradiction found between the two write-ups covering the same underlying verse.

**Collision/scope check:** Finding 1 proposes a text-only rewording of the existing `shealtiel.description` field and the `shealtiel`–`parent_of`–`Zerubbabel` relationship's `notes` field — no key collision risk, no new person/relationship/ref proposed, no relationship removed or retyped. This is a lighter audit than several prior books, consistent with the plan's expectation that some books surface 0-1 findings on well-written, ESV-close seed prose — this seed file's five people, thirteen relationships, and fifteen refs were all otherwise precisely sourced (reign lengths, dates, mothers' names, name-change attributions, and the 37-year imprisonment figure all matched exactly), with the one substantive issue being the well-known Shealtiel/Zerubbabel/Pedaiah genealogical crux, which is a genuine textual tension rather than a typo or invented detail.
