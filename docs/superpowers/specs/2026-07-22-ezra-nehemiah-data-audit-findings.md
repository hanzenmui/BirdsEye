# Ezra-Nehemiah People & Relationships Data Audit — Findings

**Date:** 2026-07-22
**Source of truth:** ESV, fetched live for every claim checked (WebFetch/WebSearch; no claim answered from training-data memory)

Reviewed: 11 people, 11 relationships, 18 refs. 4 findings.

---

## Finding 1: Cyrus's `description` calls him "king of Babylon" in his first year, but Ezra 1:1 twice calls him "king of Persia"

- **Category:** Incorrect
- **Verse(s):** Ezra 1:1 (ESV, live-fetched): "In the first year of Cyrus **king of Persia**, that the word of the Lord by the mouth of Jeremiah might be fulfilled, the Lord stirred up the spirit of Cyrus **king of Persia**, so that he made a proclamation throughout all his kingdom and also put it in writing." The title "king of Persia" appears twice in this single verse; "king of Babylon" never appears as a title for Cyrus anywhere in Ezra 1.
- **Current DB state:** `scripts/seed-ezra-nehemiah.ts` line 78, `cyrus.description`: "Founder of the Achaemenid Persian Empire. In his first year **as king of Babylon** (c. 538 BC) he issued a decree allowing exiled peoples..."
- **Proposed correction:** Change "In his first year as king of Babylon" to "In his first year as king of Persia" (matching Ezra 1:1's own repeated title). Cyrus did rule Babylon after conquering it in 539 BC, but the biblical text's own formal designation for the decree — used twice in the very verse this claim is drawn from — is "king of Persia," never "king of Babylon." Calling him "king of Babylon" here is a factual/title error, not a stylistic variant.
- **Severity:** Important — this is the opening sentence of the most consequential person-record in the seed file (the decree that begins the entire return-from-exile narrative), and the title is wrong in a way that's directly falsifiable against the one verse the claim cites.

---

## Finding 2: The Isaiah/Cyrus scripture-ref note and the underlying "150+ years" framing overstate the gap between Isaiah's prophecy and Cyrus's *birth*

- **Category:** Unsupported
- **Verse(s):** Isaiah 44:28-45:1 (ESV, live-fetched): "who says of Cyrus, 'He is my shepherd... to Cyrus, whose right hand I have grasped...'" — no verse gives an absolute date. Dating requires external scholarship, researched live this session:
  - Isaiah's ministry is conventionally dated **c. 740–681/680 BC** (call in the year of Uzziah's death to around Sennacherib's death). Conservative/evangelical scholarship that defends single Isaianic authorship of chs. 40-55 (which is necessary for a genuine predictive prophecy at all, since critical scholarship instead dates chs. 40-55 to the exile itself, after Cyrus's birth) generally places the Cyrus oracle specifically within **Hezekiah's reign, roughly 715–686 BC** — not at the very start of Isaiah's ministry.
  - Cyrus the Great's birth is dated by historians to **roughly 600 BC**, with a documented range of **600–575 BC** across sources.
  - Every apologetics source found in live searches (christiancourier.com, evidenceunseen.com, apologeticspress.org, and others) that states "~150 years" or "~200 years" explicitly measures from Isaiah's ministry to Cyrus's **accession to the throne (559 BC)** or his **conquest of Babylon (539 BC)** — never to his birth. One source explicitly confirmed: "The article states Isaiah prophesied 'some one hundred fifty years before Cyrus came to the throne' — not before his birth."
  - Measuring birth-to-birth instead: even the most generous combination (earliest possible Isaiah date, 740 BC, against the latest-cited Cyrus birth estimate, 575 BC) yields only ~165 years, while the more precisely-dated Cyrus-oracle window (715–686 BC, per conservative scholarship's own dating of that specific passage) against the commonly-cited ~600 BC birth date yields only **~86–115 years** — well short of "150+."
- **Current DB state:** `scripts/seed-ezra-nehemiah.ts` line 156, ref note for `cyrus`/Isaiah 44:28-45:1: `"Named by Isaiah 150+ years before his birth"`. Related (not itself flagged as a separate finding, but the same root issue): line 78, `cyrus.description`, "Isaiah had named him by name over a century earlier" — this looser phrasing is defensible on either measure (birth or reign) and is not incorrect, only the *ref note's* specific "150+ years... before his birth" claim is.
- **Proposed correction:** Change the ref note from "Named by Isaiah 150+ years before his birth" to something measured against the reign/conquest instead (the figure the "150+" claim is actually sourced from in the apologetics literature), e.g. "Named by Isaiah roughly 150 years before his reign began" or, if the note should stay birth-anchored, soften to a defensible range, e.g. "Named by Isaiah roughly a century before his birth."
- **Severity:** Important — flagged as a special-priority item in the task brief specifically because it's a timing/duration claim of the kind readers might independently fact-check, and the specific number-plus-anchor combination ("150+ years" + "before his birth") does not hold up against either conservative or standard historical datings, even though a *looser* version of the same claim (measured to Cyrus's reign, or phrased as "over a century" to his birth) is well supported.

---

## Finding 3: Darius's `description` contains a garbled, ungrammatical sentence fragment

- **Category:** Incorrect
- **Verse(s):** Ezra 6:15 (ESV, live-fetched): "This house was finished on the third day of the month of Adar, in the sixth year of the reign of Darius the king."
- **Current DB state:** `scripts/seed-ezra-nehemiah.ts` line 83, `darius_persia.description`: "...Darius found Cyrus's original decree and not only confirmed it but ordered the expenses to be paid from the royal treasury. **Completed the Temple rebuilding was finished in his sixth year (516 BC).** Not to be confused with Darius the Mede in Daniel." The sentence "Completed the Temple rebuilding was finished in his sixth year (516 BC)" is grammatically malformed — it reads as two overlapping sentence fragments spliced together ("[The Temple was] Completed..." / "The Temple rebuilding was finished... in his sixth year"), not a single coherent English sentence.
- **Proposed correction:** Replace with a single well-formed sentence, e.g. "The Temple rebuilding was completed in his sixth year (c. 515 BC)." (Note: sources vary between 515 and 516 BC for this date depending on calendar reckoning — both are defensible; this finding is about the grammar, not the year.)
- **Severity:** Minor — purely an editorial/data-quality defect (malformed prose in a stored description field), not a factual error; the underlying claim (Temple finished in Darius's 6th year) is itself correct per Ezra 6:15.

---

## Finding 4: The Sheshbazzar/Zerubbabel scholarly-consensus framing may have the emphasis backwards, or at minimum overstates how settled the question is

- **Category:** Unsupported
- **Verse(s):** Ezra 1:8-11 (Sheshbazzar entrusted with vessels, leads first return) and Ezra 3:2, 5:2 (Zerubbabel son of Shealtiel leads the building) — the two names are never explicitly equated or distinguished within the biblical text itself; the identification question is entirely a matter of extra-biblical scholarly inference.
- **Current DB state:** `scripts/seed-ezra-nehemiah.ts` line 94, `sheshbazzar.description`: "Some scholars identify him with Zerubbabel; most treat them as separate individuals."
- **Why flagged (borderline — including per instructions rather than silently declining):** Live research this session found a genuinely split and historically-shifting literature, not a single settled "majority" position. Older/standard reference works (e.g., International Standard Bible Encyclopedia-derived material) state the identification view (Sheshbazzar = Zerubbabel) has traditionally been the *majority* position among reference works ("the majority of scholars and reference works so connect the names"), while acknowledging that some *modern* scholarship has shifted toward treating them as separate, sequential governors (Sheshbazzar under Cyrus, succeeded by Zerubbabel under Darius). In other words, the DB's phrasing ("some... most...") asserts a confident majority/minority split in a specific direction, when the live-researched picture is closer to "this has been genuinely contested and the balance of opinion has shifted over time, with sources disagreeing about which view is currently dominant."
- **Proposed correction:** Soften to acknowledge the contested/shifting nature rather than asserting a specific majority, e.g. "Scholars are divided on whether he is the same person as Zerubbabel or a separate, earlier governor; the question remains unsettled." This is a low-confidence finding — the current text is not clearly *wrong*, just more confident about the shape of the consensus than the live-researched literature supports. Flagging per the brief's instruction to include borderline items with reasoning rather than silently decline them.
- **Severity:** Minor — a nuance-of-framing issue in a single descriptive sentence about a genuinely unresolved question, not a factual claim that can be definitively falsified either way.

---

## Priority items checked and cleared (no finding)

**(a) Darius's "sixth year" Temple completion, Ezra's "seventh year," Nehemiah's "twentieth year," and the 52-day wall.** Ezra 6:15 (ESV, live-fetched): Temple "finished... in the sixth year of the reign of Darius." Matches `darius_persia.description` and the Ezra ref note ("orders Temple completion funded"), modulo Finding 3's grammar issue. Ezra 7:7-8 (ESV, live-fetched): Ezra's group departed and arrived "in the seventh year of Artaxerxes." Matches `artaxerxes.description` and `ezra`'s framing. Nehemiah 2:1 (ESV, live-fetched): "in the twentieth year of King Artaxerxes." Matches `artaxerxes.description` and `nehemiah.description`. Nehemiah 6:15 (ESV, live-fetched): "the wall was finished... in fifty-two days." Matches `nehemiah.description` and `sanballat.description`. All four timing claims confirmed accurate. No finding.

**(b) The Sheshbazzar/Zerubbabel identification framing.** See Finding 4 above — flagged as a borderline nuance issue, not cleared outright.

**(c) The `Solomon ancestor_of Zerubbabel` relationship vs. the Late Kings of Judah audit's `Jehoiachin→Shealtiel→Zerubbabel` chain.** Matthew 1:12-13 (ESV, live-fetched): "Jechoniah was the father of Shealtiel, and Shealtiel the father of Zerubbabel, and Zerubbabel the father of Abiud..." This directly supports the DB's `zerubbabel.description` claim that he is "Grandson of Jehoiachin... [via Shealtiel]" (Jehoiachin = Jeconiah = Jechoniah, standard equivalence) and is "named in both Davidic genealogies of Jesus (Matt 1:12-13; Luke 3:27)." Solomon appears earlier in the same Matthew 1 genealogy (v. 6-7, as ancestor of Jechoniah through the Davidic/Solomonic line), so `Solomon ancestor_of Zerubbabel` is a textually legitimate long-range supplementary link — it summarizes the full Solomon-to-Zerubbabel span of the same genealogy the Late Kings audit's precise `Jehoiachin→Shealtiel→Zerubbabel` chain covers only the tail end of. The two relationships describe different spans of the identical Matthew 1 genealogical chain and are consistent, not duplicative or contradictory (one is a 3-generation precise chain nearer in time; the other is a ~14-generation summary link spanning centuries). No finding.

**(d) Sanballat, Tobiah, and Geshem's specific quoted/summarized details.** Nehemiah 4:2 (ESV, live-fetched): Sanballat's taunt — "What are these feeble Jews doing?... Will they finish up in a day?" — matches `sanballat.description`'s "Ridiculed the builders." Nehemiah 4:3 (ESV, live-fetched): Tobiah's taunt — "if a fox goes up on it he will break down their stone wall!" — matches `tobiah.description`'s direct quote, "'If a fox climbed up on it, he would break it down!'" (a very close paraphrase of the ESV's wording). Nehemiah 6:1-9 (ESV, live-fetched): Sanballat, Tobiah, and Geshem's plain-of-Ono ambush attempt and the false-rebellion/kingship rumor letter are all matched by `sanballat.description` ("tried to lure Nehemiah to a meeting to harm him"), `geshem.description` ("Tried to lure Nehemiah into a meeting in the plain of Ono," "Spread false rumors that Nehemiah was planning to make himself king"). Nehemiah 6:17-19 and 13:4-5 (ESV, live-fetched): Tobiah's marriage ties to Jewish nobility and the temple-chamber incident match `tobiah.description`'s "Had Jewish relatives and allies through marriage... a room in the Temple courts was given to him; Nehemiah returned and threw all his household goods out." All quoted/summarized details confirmed accurate. No finding.

**(e) All 18 refs' chapter:verse ranges and note text.** See the full ref-by-ref verification table below. All 18 confirmed accurate; no range or note-text errors found.

---

## All 18 refs — chapter:verse ranges and note text verified

| # | Person | Book | Range | Note | Verified against |
|---|--------|------|-------|------|-------------------|
| 1 | cyrus | Ezra | 1:1-1:8 | Decree to rebuild the Temple; returns vessels | Ezra 1:1-8 (ESV, live-fetched) — decree at 1:1-4, vessels returned 1:7-8. Accurate. |
| 2 | cyrus | Isaiah | 44:28-45:1 | Named by Isaiah 150+ years before his birth | Isaiah 44:28-45:1 (ESV, live-fetched) — range accurate; note text is Finding 2. |
| 3 | darius_persia | Ezra | 5:5-6:15 | Finds Cyrus's decree; orders Temple completion funded | Ezra 5:5 (opponents' inquiry begins) through 6:15 (Temple finished) (ESV, live-fetched). Accurate. |
| 4 | artaxerxes | Ezra | 7:1-7:28 | Authorizes Ezra's mission with letter and resources | Ezra 7:1-28 (ESV, live-fetched) — decree/letter is 7:11-26; range covers the whole authorizing chapter. Accurate. |
| 5 | artaxerxes | Nehemiah | 2:1-2:8 | Grants Nehemiah permission to rebuild Jerusalem's walls | Neh 2:1-8 (ESV, live-fetched) — request and grant. Accurate. |
| 6 | sheshbazzar | Ezra | 1:8-1:11 | Entrusted with temple vessels; leads first return | Ezra 1:8-11 (ESV, live-fetched) — vessels counted out to Sheshbazzar, "all these did Sheshbazzar bring up." Accurate. |
| 7 | zerubbabel | Ezra | 2:2-6:22 | Leads return; rebuilds altar and Temple foundation | Ezra 2:2 (Zerubbabel first named among returning leaders) through 6:22 (Passover/Unleavened Bread after Temple completion) (ESV, live-fetched). Accurate — spans his full narrative arc in Ezra. |
| 8 | zerubbabel | Haggai | 1:1-2:23 | Urged by Haggai to rebuild; God's signet ring | Haggai 1:1 through 2:23 (last verse of the book, "I will make you like a signet ring") (ESV, live-fetched). Accurate. |
| 9 | zerubbabel | Zechariah | 4:6-4:10 | Vision: Zerubbabel will complete the Temple | Zechariah 4:6 ("Not by might, nor by power...") through 4:10 ("the hands of Zerubbabel have laid the foundation... shall also finish it") (ESV, live-fetched). Accurate. |
| 10 | jeshua_priest | Ezra | 2:2-6:2 | High priest; rebuilds altar with Zerubbabel | Ezra 2:2 (Jeshua named alongside Zerubbabel) through 6:2 (find of the decree during the archive search narrative) (ESV, live-fetched). Accurate. |
| 11 | jeshua_priest | Haggai | 1:1-2:4 | Commissioned alongside Zerubbabel | Haggai 1:1 and 2:2-4 both address "Joshua the son of Jehozadak, the high priest" alongside Zerubbabel (ESV, live-fetched). Accurate. |
| 12 | jeshua_priest | Zechariah | 3:1-3:9 | Vision: Joshua cleansed and crowned in Temple | Zechariah 3:1-9 (ESV, live-fetched) — Satan's accusation, filthy garments removed, clean vestments and turban given. Accurate. |
| 13 | ezra | Ezra | 7:1-10:44 | Arrives from Babylon; foreign wife crisis; dissolution | Ezra 7:1 through 10:44 (last verse of the book, listing those who had married foreign women) (ESV, live-fetched). Accurate. |
| 14 | ezra | Nehemiah | 8:1-8:18 | Reads the Law publicly; people weep | Neh 8:1-18 (ESV, live-fetched) — public reading, wooden platform, weeping. Accurate. |
| 15 | nehemiah | Nehemiah | 1:1-13:31 | Hears of Jerusalem; builds wall in 52 days; reforms | Neh 1:1 (news of Jerusalem) through 13:31 (last verse, "Remember me, O my God, for good") (ESV, live-fetched). Accurate — spans the full book. |
| 16 | sanballat | Nehemiah | 2:10-13:28 | Mocks, conspires, and plots against Nehemiah | Neh 2:10 (Sanballat and Tobiah displeased at Nehemiah's arrival) through 13:28 (Sanballat's family tie to the high priest's line) (ESV, live-fetched). Accurate. |
| 17 | tobiah | Nehemiah | 2:10-13:9 | Ridicules the wall; uses Temple room expelled by Nehemiah | Neh 2:10 through 13:9 (Nehemiah cleanses the chamber after expelling Tobiah's belongings) (ESV, live-fetched). Accurate. |
| 18 | geshem | Nehemiah | 2:19-6:14 | Spreads rumor of rebellion; lures Nehemiah to Ono | Neh 2:19 (Geshem first named, with Sanballat/Tobiah, mocking/accusing of rebellion) through 6:14 (Nehemiah's prayer naming Tobiah and Sanballat, closing the opposition narrative arc that includes Geshem's Ono ambush at 6:1-9) (ESV, live-fetched). Accurate. |

---

## Findings Summary Table

| # | Finding | Category | Severity |
|---|---------|----------|----------|
| 1 | Cyrus's `description` calls him "king of Babylon" in his first year; Ezra 1:1 twice calls him "king of Persia" | Incorrect | Important |
| 2 | Isaiah/Cyrus ref note's "150+ years before his birth" overstates the birth-anchored gap; standard apologetics sources measure ~150 years to Cyrus's reign/conquest, not his birth | Unsupported | Important |
| 3 | Darius's `description` contains a grammatically malformed sentence ("Completed the Temple rebuilding was finished in his sixth year") | Incorrect | Minor |
| 4 | Sheshbazzar's `description` asserts a specific majority/minority scholarly split ("some... most...") that overstates how settled the identification question is | Unsupported | Minor |

---

## Verification notes

**Coverage counts (grep-verified against `scripts/seed-ezra-nehemiah.ts` before writing the summary line above):**
- People: `grep -c "safeInsertPerson({" scripts/seed-ezra-nehemiah.ts` → 11
- Relationships: `grep -c "await insertRel(" scripts/seed-ezra-nehemiah.ts` → 9, plus `grep -c "await insertRelByName(" scripts/seed-ezra-nehemiah.ts` → 2. Total 11.
- Refs: `grep -c "await insertRef(" scripts/seed-ezra-nehemiah.ts` → 18

**People enumerated (11):** cyrus, darius_persia, artaxerxes, sheshbazzar, zerubbabel, jeshua_priest, ezra, nehemiah, sanballat, tobiah, geshem.

**Relationships enumerated (11):** cyrus-ally_of-sheshbazzar; cyrus-ally_of-zerubbabel; darius_persia-ally_of-zerubbabel; artaxerxes-ally_of-ezra; artaxerxes-ally_of-nehemiah; zerubbabel-ally_of-jeshua_priest; nehemiah-enemy_of-sanballat; nehemiah-enemy_of-tobiah; nehemiah-enemy_of-geshem; Ezra(byName)-ally_of-Nehemiah; Solomon(byName)-ancestor_of-Zerubbabel.

**Refs enumerated (18):** cyrus/Ezra, cyrus/Isaiah, darius_persia/Ezra, artaxerxes/Ezra, artaxerxes/Nehemiah, sheshbazzar/Ezra, zerubbabel/Ezra, zerubbabel/Haggai, zerubbabel/Zechariah, jeshua_priest/Ezra, jeshua_priest/Haggai, jeshua_priest/Zechariah, ezra/Ezra, ezra/Nehemiah, nehemiah/Nehemiah, sanballat/Nehemiah, tobiah/Nehemiah, geshem/Nehemiah. (See full ref table above.)

**Live fetches/searches performed this session (ESV unless noted; WebFetch used for chapter/passage text, WebSearch used for scholarly-dating and apologetics-claim research):** Ezra 1 (full text/summary), 2-3 (Zerubbabel/Jeshua/altar/foundation), 4-5 (opposition, work halted, Haggai/Zechariah resumption), 5-6 (Darius, archive search, funding, 6:15 completion date, 6:19-22 Passover), 7 (Artaxerxes' decree, 7:1-6 Ezra's genealogy, 7:7-9 dates, 7:13-25 authority granted), 8-10 (Ezra's journey, intermarriage crisis, confession/dissolution); Isaiah 44:28-45:1 (Cyrus named); Nehemiah 1 (Nehemiah son of Hacaliah, initial grief), 2 (2:1 twentieth year, 2:5-8 request/grant, 2:10 Sanballat/Tobiah displeased, 2:19 Geshem added), 4 (4:2-3 taunts, 4:17 armed workers), 5 (5:11 pledged-land reforms, 5:14 twelve-year governorship), 6 (6:1-9 Ono ambush/rumor letter, 6:14 prayer naming opponents, 6:15 52-day completion, 6:17-19 Tobiah's marriage ties), 8 (public reading, wooden platform, weeping), 9-13 (confession/covenant, resettlement, 13:4-5 Tobiah's temple chamber, 13:6 32nd-year departure, 13:28 Sanballat's son-in-law); Haggai 1-2 (1:1, 1:8, 1:13, 2:1-4, 2:9, 2:23 signet ring); Zechariah 3-4 (3:2-8 Joshua cleansed, 4:6-10 "not by might" and Zerubbabel completing the Temple); Matthew 1:12-13 (Jechoniah-Shealtiel-Zerubbabel genealogy); scholarly-dating searches for Isaiah's ministry (c. 740-681/680 BC; conservative dating of the Cyrus oracle specifically to Hezekiah's reign, c. 715-686 BC) and Cyrus's birth (c. 600 BC, range 575-600 BC) and reign/accession (559 BC) vs. conquest of Babylon (539 BC); multiple apologetics sources' exact wording of the "150 years" claim (christiancourier.com, evidenceunseen.com, and general search aggregation) to determine whether the anchor point is Cyrus's birth or his reign; Sheshbazzar/Zerubbabel identification scholarship (ISBE-derived material, Wikipedia, general search aggregation) to characterize the current state of the debate; sixth-year-of-Darius 515-vs-516-BC calendar-reckoning variance (confirmed as normal cross-source variation, not a DB error). No claim in this document was answered from memory alone — every claim was checked or re-checked against a live fetch/search this session.

**Triple-check (Step 5):** Re-verified Finding 1 by re-fetching Ezra 1:1 a second time — confirmed "king of Persia" appears twice, "king of Babylon" nowhere in the verse. Re-verified Finding 2 by re-running the Isaiah-ministry and Cyrus-birth date searches with different query phrasing a second time; results were consistent (Isaiah c. 740-681/680 BC generally, c. 715-686 BC for the Cyrus oracle specifically per conservative scholarship; Cyrus born c. 600 BC, range 575-600 BC) and a second independent check of two different apologetics sources both confirmed their "150 years" figure is measured to Cyrus's reign/throne, not his birth. Re-read Finding 3's sentence in the actual file a second time to confirm the grammatical break is real and not a markdown-rendering artifact — confirmed via direct grep of line 83. Re-considered Finding 4 a second time against the alternative reading that the DB's phrasing might simply be correct as a present-day snapshot; concluded it's genuinely a close call and left it flagged per the brief's explicit instruction to include borderline items rather than silently decline them. Re-verified all 18 refs' chapter:verse ranges a second time against the fetched/searched text; no additional range errors found beyond the four findings above.

**Second full read-through (checking for contradictions between findings):** Findings 1-4 each concern a different person record (cyrus, cyrus's ref note, darius_persia, sheshbazzar) and none overlap in scope or propose conflicting corrections. Cross-checked Finding 2 (Isaiah/Cyrus timing) against Finding 1 (Cyrus's title) to confirm they don't touch the same sentence — they don't (Finding 1 is about "king of Babylon" mid-description; Finding 2 is about the separate Isaiah ref note). Cross-checked Finding 4 (Sheshbazzar/Zerubbabel framing) against the "priority items cleared" item (c) (Solomon ancestor_of Zerubbabel / Late Kings chain) to confirm no contradiction between accepting the Jehoiachin-grandson framing for Zerubbabel while flagging the separate Sheshbazzar-identification question — these are independent questions (one is about Zerubbabel's own genealogy, which is clearly stated in the text; the other is about whether Sheshbazzar and Zerubbabel are the same historical person, which the text never addresses) and no contradiction was found. No overlap or contradiction found among the four findings.

**Collision/scope check:** All four findings propose text-only edits to existing `description` or ref `note` fields (Cyrus's description, the Isaiah ref note, Darius's description, Sheshbazzar's description) — no key collisions, no new person/relationship/ref proposed, no relationship-type changes proposed. This audit surfaced more findings than 1 Kings' single-finding audit but all four are description/note text corrections rather than structural (missing person, missing relationship, or wrong ref range) issues — the file's structural skeleton (11 people, 11 relationships, 18 refs, all correctly keyed and ranged) is sound.
