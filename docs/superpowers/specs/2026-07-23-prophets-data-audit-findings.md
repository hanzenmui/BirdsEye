# Prophets People, Relationships & Refs Data Audit — Findings

**Date:** 2026-07-23
**Source of truth:** ESV, fetched live for every claim checked (WebFetch/WebSearch; no claim answered from training-data memory)
**File audited:** `scripts/seed-prophets.ts` (314 lines) — Jeremiah, Ezekiel, and all twelve minor prophets

Reviewed: 18 people, 13 relationships, 20 refs. 10 findings.

Counts were grep-verified directly against the file, not taken from the task plan's stated expectations:
- `grep -c "await safeInsertPerson("` → 18
- `grep -c "await insertRel(\""` → 4, `insertRelByName(` → 6, `insertRelByAkaToName(` → 3 → **13 relationships total**
- `grep -c "await insertRef(\""` → 20 (includes the conditional Isaiah ref, which the code path always reaches since Isaiah was already seeded in `seed-2kings.ts`)

---

## Finding 1: Baruch's description frames his trip to Egypt with Jeremiah as "tradition," but it is a direct scriptural statement, not a tradition

- **Category:** Incorrect
- **Verse(s):** Jeremiah 43:6 (ESV, live-fetched, verbatim): "...also Jeremiah the prophet and Baruch the son of Neriah. And they came into the land of Egypt, for they did not obey the voice of the Lord."
- **Current DB state:** `scripts/seed-prophets.ts` line 111, `baruch.description` ends: "He preserved and transmitted the book of Jeremiah. **Tradition holds** he accompanied Jeremiah to Egypt."
- **Proposed correction:** Replace "Tradition holds he accompanied Jeremiah to Egypt." with a direct statement, e.g. "He accompanied Jeremiah to Egypt after Gedaliah's assassination (Jer 43:6)." "Tradition" more accurately applies to extra-biblical legends about Baruch's later life/death, not to the Egypt trip itself, which Jeremiah 43:6 states outright.
- **Severity:** Minor — single description field, does not misstate the underlying fact, only its epistemic status.

---

## Finding 2: Pashhur's description says he stocked Jeremiah at "the Upper Gate," omitting the specific "Benjamin" identifier the text uses

- **Category:** Incorrect
- **Verse(s):** Jeremiah 20:2 (ESV, live-fetched, verbatim): "Then Pashhur beat Jeremiah the prophet, and put him in the stocks that were in the upper Benjamin Gate of the house of the Lord."
- **Current DB state:** `scripts/seed-prophets.ts` line 121, `pashhur_jeremiah.description`: "Had Jeremiah beaten and put in stocks at **the Upper Gate** for prophesying Jerusalem's destruction."
- **Proposed correction:** Change "the Upper Gate" to "the upper Benjamin Gate" (or "the upper Gate of Benjamin"). A separate "upper gate of the house of the LORD" (built by Jotham, 2 Kings 15:35 / 2 Chron 27:3) is a different gate; dropping "Benjamin" risks conflating the two.
- **Severity:** Minor.

---

## Finding 3: Jonah's description quotes God's closing question with the word "concern," but the ESV uses "pity"

- **Category:** Incorrect
- **Verse(s):** Jonah 4:11 (ESV, live-fetched, verbatim): "And should not I pity Nineveh, that great city, in which there are more than 120,000 persons who do not know their right hand from their left, and also much cattle?"
- **Current DB state:** `scripts/seed-prophets.ts` line 165, `jonah.description`: "God's response forms the book's climax: **'Should I not have concern for the great city of Nineveh?'**"
- **Proposed correction:** Change the quoted line to "Should not I pity Nineveh, that great city?" (or paraphrase without quotation marks). "Concern" is the NIV's rendering of this verse, not the ESV's — the project's stated source of truth is ESV specifically.
- **Severity:** Minor.

---

## Finding 4: Malachi's description quotes the coming "Day of the Lord" as "great and terrible," but the ESV says "great and awesome"

- **Category:** Incorrect
- **Verse(s):** Malachi 4:5 (ESV, live-fetched, verbatim): "Behold, I will send you Elijah the prophet before **the great and awesome day of the Lord** comes." (Joel 2:31 uses the identical ESV phrase "the great and awesome day of the Lord," confirming this is the ESV's consistent rendering, not a one-off.)
- **Current DB state:** `scripts/seed-prophets.ts` line 207, `malachi.description`: "...closed with the prophecy of 'Elijah' returning before **'the great and terrible Day of the Lord'** (Mal 4:5-6..."
- **Proposed correction:** Change "the great and terrible Day of the Lord" to "the great and awesome day of the Lord." ("Terrible" is the KJV's wording for this verse; the ESV says "awesome.")
- **Severity:** Minor.

---

## Finding 5: Haggai's description quotes God's challenge as "Give careful thought to your ways," but the ESV says "Consider your ways"

- **Category:** Incorrect
- **Verse(s):** Haggai 1:5 and 1:7 (ESV, live-fetched, verbatim, identical in both verses): "Thus says the Lord of hosts: **Consider your ways.**"
- **Current DB state:** `scripts/seed-prophets.ts` line 195, `haggai.description`: "Haggai challenged them: **'Give careful thought to your ways.'**"
- **Proposed correction:** Change the quoted line to "Consider your ways." ("Give careful thought to your ways" is the NIV's rendering; the ESV says "Consider your ways.")
- **Severity:** Minor.

---

## Finding 6: Habakkuk's description quotes 2:4 as "the righteous shall live by faith," dropping the ESV's "his"

- **Category:** Incorrect
- **Verse(s):** Habakkuk 2:4 (ESV, live-fetched, verbatim): "Behold, his soul is puffed up; it is not upright within him, **but the righteous shall live by his faith.**"
- **Current DB state:** `scripts/seed-prophets.ts` line 183, `habakkuk.description`: "God declares **'the righteous shall live by faith'** (Hab 2:4 — quoted in Romans, Galatians, and Hebrews)."
- **Why this is borderline:** Romans 1:17 and Galatians 3:11 (both ESV, live-fetched) do render it exactly "The righteous shall live by faith" — without "his" — so the DB's wording matches the NT citations verbatim even though it doesn't match the ESV Habakkuk verse itself. It's plausible the field intentionally quotes the popular NT-echoed form rather than the OT verse. Flagging this non-prescriptively since there's no single obviously-correct fix: either restore "his" to match the OT verse, or leave as-is since it accurately quotes how Paul/the author of Hebrews render it.
- **Proposed correction:** No single mandated fix — either add "his" ("the righteous shall live by his faith") to match the ESV OT verse exactly, or leave as is with a note that this is the NT-quoted form. Controller/reviewer to decide.
- **Severity:** Minor.

---

## Finding 7: Habakkuk's description quotes the fig-tree passage as "does not blossom," but the ESV says "should not blossom"

- **Category:** Incorrect
- **Verse(s):** Habakkuk 3:17 (ESV, live-fetched, verbatim): "Though the fig tree **should not blossom**, nor fruit be on the vines, the produce of the olive fail and the fields yield no food..."
- **Current DB state:** `scripts/seed-prophets.ts` line 183, `habakkuk.description`: "...one of the most beautiful expressions of faith in the Bible: **'Though the fig tree does not blossom…yet I will rejoice in the Lord.'**"
- **Proposed correction:** Change "does not blossom" to "should not blossom" to match the ESV exactly.
- **Severity:** Minor.

---

## Finding 8: The Jonah↔Jeroboam II relationship duplicates one already created in `seed-2kings.ts`, with an inconsistent `type`

- **Category:** Incorrect
- **Verse(s):** 2 Kings 14:25 (context for both relationship rows).
- **Current DB state:** `scripts/seed-2kings.ts` line 244 already runs: `insertRelNameToLocal("Jonah", "ally_of", "jeroboam2", "Jonah prophesied Jeroboam II's restoration of Israel's borders (2 Kgs 14:25)")`. `scripts/seed-prophets.ts` line 230-231 then runs a second, near-identical relationship: `insertRelByAkaToName("Jeroboam", "Jeroboam II king of Israel", "other", "Jonah", "Jonah prophesied Jeroboam II's restoration of Israel's borders (2 Kgs 14:25)")` — same two people, same underlying fact, same note text, but reversed person_a/person_b direction and a different `type` (`"other"` vs. `"ally_of"`). The `relationships` table has **no unique constraint** on (person_a, person_b, type) — confirmed by the comment at the top of `scripts/dedupe-relationships.ts` ("the `relationships` table has no unique constraint on...") — and `INSERT OR IGNORE` only dedupes on the generated UUID primary key, so this will persist as two separate rows describing the same fact with different, inconsistent types. (The corresponding Hosea↔Jeroboam II and Amos↔Jeroboam II relationships in this file are *not* duplicates — no existing relationship rows for those pairs were found in `seed-2kings.ts`, `seed-1kings.ts`, or `seed-chronicles.ts`.)
- **Why non-prescriptive:** There's no single obviously-correct fix — either drop the new `insertRelByAkaToName("Jeroboam", ..., "Jonah", ...)` call from `seed-prophets.ts` (since the equivalent relationship already exists), or keep it but harmonize the `type` to `ally_of` to match the existing row, or leave both and let a future dedupe pass merge them. Flagging for the controller/reviewer to resolve.
- **Proposed correction:** Non-prescriptive — recommend removing the redundant `insertRelByAkaToName("Jeroboam", "Jeroboam II king of Israel", "other", "Jonah", ...)` call, since `seed-2kings.ts` already establishes this relationship with type `ally_of`.
- **Severity:** Important — unlike the wording-only findings above, this one produces an actual duplicate/inconsistent row in the live relationships data, not just an imprecise description string.

---

## Finding 9: Zephaniah's description states his genealogy traces "back four generations to Hezekiah, suggesting royal lineage" — this identification is genuinely disputed among scholars, not settled

- **Category:** Unsupported
- **Verse(s):** Zephaniah 1:1 (ESV, live-fetched, verbatim): "The word of the Lord that came to Zephaniah the son of Cushi, son of Gedaliah, son of Amariah, son of Hezekiah, in the days of Josiah the son of Amon, king of Judah."
- **Current DB state:** `scripts/seed-prophets.ts` line 189, `zephaniah.description`: "...with a remarkably long genealogy tracing him back four generations to Hezekiah, **suggesting royal lineage**."
- **Why this is flagged as borderline:** Research (WebSearch, including a review of the arguments in "The Royal Ancestry of Zephaniah" and other commentary) confirms this is a real scholarly debate, not settled fact: some scholars (e.g., G. A. Smith) argue this Hezekiah is "in all probability" King Hezekiah of Judah, since a four-generation genealogy is unique among the prophetic books and otherwise unexplained. Others reject the connection, noting (a) if royal descent were the point, the text would be expected to explicitly say "Hezekiah the king," as other biblical genealogies do when disambiguating royalty, and (b) none of the intervening names (Cushi, Gedaliah, Amariah) appear among Hezekiah's known descendants elsewhere in Scripture, and (c) the chronology is tight (~88 years between the end of Hezekiah's reign and the end of Josiah's for four full generations). The DB's phrasing ("suggesting," not "confirming") is already appropriately hedged and may not clear the bar for a hard "discrepancy" — but per the brief's instruction to include borderline items rather than silently omit them, this is flagged for the controller/reviewer to judge whether the hedge is hedged enough.
- **Proposed correction:** No single mandated fix — optionally strengthen the hedge further, e.g. "...tracing him back four generations to a man named Hezekiah — possibly, though not certainly, King Hezekiah of Judah, which would give him royal lineage."
- **Severity:** Minor.

---

## Finding 10: Ezekiel's description summarizes the sign-act as lying on his side "for 430 days" — accurate as a sum, but this elides that it was two separate acts on two different sides representing two different nations

- **Category:** Unsupported
- **Verse(s):** Ezekiel 4:4-6 (ESV, live-fetched, verbatim): "Lie on your left side... I assign to you a number of days, 390 days, equal to the number of the years of their punishment. So you shall bear the punishment of the house of Israel... And when you have completed these, you shall lie down a second time, but on your right side, and bear the punishment of the house of Judah. Forty days I assign you, a day for each year."
- **Current DB state:** `scripts/seed-prophets.ts` line 127, `ezekiel.description`: "Performed many acted signs: **lay on his side for 430 days**, shaved his head, cooked with dung."
- **Why this is flagged as borderline:** 390 + 40 does equal 430, so the total is numerically correct, and this kind of aggregated summary is common in study-Bible descriptions. However, phrased as a single clause ("lay on his side for 430 days") it could be read as one continuous 430-day act on one side, when the text specifies two distinct acts — 390 days on the left side for Israel, then a separate 40 days on the right side for Judah. Flagging as a borderline precision issue for the controller/reviewer to judge whether the current phrasing is clear enough or should be split out.
- **Proposed correction:** No single mandated fix — optionally: "lay on his left side 390 days for Israel's punishment, then his right side 40 days for Judah's (430 days total)."
- **Severity:** Minor.

---

## Priority items checked and cleared (no finding)

Per the task brief's specific priorities:

**(a) The three `insertRelByAkaToName("Jeroboam", "Jeroboam II king of Israel", ...)` calls resolve to Jeroboam II, not Jeroboam I.** The helper `lookupIdByAka(name, aka)` runs `SELECT id FROM people WHERE name = ? AND also_known_as = ?` — an exact match on both fields. Confirmed by reading `scripts/seed-2kings.ts` line 174: `safeInsertPerson({ key: "jeroboam2", name: "Jeroboam", alsoKnownAs: "Jeroboam II king of Israel", ... })` — the exact string used in all three `insertRelByAkaToName` calls in `seed-prophets.ts`. Jeroboam I, by contrast, is seeded in `scripts/seed-1kings.ts` line 115 with `alsoKnownAs: "Jeroboam son of Nebat"` — a different string. The exact-match lookup correctly disambiguates the two. **No finding.**

**(b) The six `insertRelByName` cross-seed links (Josiah/Jeremiah, Nebuchadnezzar/Jeremiah, Zerubbabel/Haggai, Zerubbabel/Zechariah, Jeshua/Haggai, Jeshua/Zechariah).** All six target names exist verbatim (`name` field) in earlier seed files: "Josiah" and "Nebuchadnezzar" in `seed-2kings.ts`, "Zerubbabel" and "Jeshua" in `seed-ezra-nehemiah.ts` (confirmed via grep). Content checks: Jeremiah 1:2 confirms Jeremiah's call in Josiah's 13th year; 2 Chronicles 35:25 confirms Jeremiah "uttered a lament for Josiah" (supports "mourned his death"); Nebuchadnezzar's role as the Babylonian conqueror Jeremiah prophesied about is amply attested throughout the book (e.g., Jer 39). Ezra 5:1-2 (ESV, live-fetched, verbatim): "Now the prophets, Haggai and Zechariah the son of Iddo, prophesied to the Jews... Then Zerubbabel the son of Shealtiel and Jeshua the son of Jozadak arose and began to rebuild the house of God" — confirms both prophets encouraged both leaders. Haggai 1:12 confirms Zerubbabel and Joshua/Jeshua "obeyed the voice of the Lord... and the words of Haggai." Zechariah 3 confirms Joshua/Jeshua the high priest is the central figure of that vision. **No finding — all six textually supported.**

**(c) Every whole-book ref's final chapter:verse against the actual last verse of that book.** All checked by live-fetching each book's final chapter: Jeremiah 52:34 ✓, Ezekiel 48:35 ✓, Isaiah 66:24 ✓, Hosea 14:9 ✓, Joel 3:21 ✓, Amos 9:15 ✓, Obadiah 1:21 ✓, Jonah 4:11 ✓, Micah 7:20 ✓, Nahum 3:19 ✓, Habakkuk 3:19 ✓, Zephaniah 3:20 ✓, Haggai 2:23 ✓, Zechariah 14:21 ✓, Malachi 4:6 ✓. Also checked the two non-whole-book refs' chapter boundaries: Baruch's ref ends at Jeremiah 45:5, and Jeremiah 45 has exactly 5 verses (the full "oracle to Baruch") ✓; Ebed-melech's ref ends at Jeremiah 39:18, and Jeremiah 39 has exactly 18 verses, with 39:15-18 being God's personal promise to him ✓. **No finding — every endpoint is exact.**

**(d) Every NT-citation claim, fetching the actual NT verse (not just the OT source).** Checked all nine explicit NT-citation claims in the file: Hosea 6:6 quoted by Jesus in Matthew 9:13 and 12:7 (confirmed, both verbatim "I desire mercy, and not sacrifice") ✓; Joel 2:28-32 cited by Peter in Acts 2:16-21 as the explanation for Pentecost's events ✓; Micah 5:2 quoted by the chief priests to Herod in Matthew 2:5-6 ✓; Habakkuk 2:4 quoted in Romans 1:17, Galatians 3:11, and Hebrews 10:38 (all three confirmed, though with translation variance noted separately in Finding 6) ✓; Zechariah 9:9 cited as fulfilled in Matthew 21:4-5 (Palm Sunday) ✓; Zechariah 12:10 cited in John 19:37 at the crucifixion ✓; Malachi 3:1 quoted by Jesus in Matthew 11:10 regarding John the Baptist ✓; Malachi 4:5-6's "Elijah" applied to John the Baptist in Matthew 17:10-13 and Luke 1:17 ✓; Jeremiah 31:31-34's New Covenant "quoted in full in Hebrews" — confirmed via Hebrews 8:8-12, which represents the content of all four Jeremiah verses (all four verses' content appears, in the same order, though the LXX-derived wording in Hebrews differs slightly from the ESV OT translation of the Hebrew, e.g. "showed no concern for them" vs. "though I was their husband") — considered accurate as "quoted in full" since no verse's content is omitted. **No finding on this last one** — the "partial" framing an initial single-verse comparison suggested doesn't hold up once all four verses are checked together. Zechariah 11:12-13 ("thirty pieces of silver") is described in the DB without any NT-citation claim attached, so the well-known fact that Matthew 27:9-10 attributes this quotation to "the prophet Jeremiah" rather than Zechariah is not a discrepancy here — the DB never claims it's cited in Matthew. **No finding — noted for awareness only, since the DB makes no NT-citation claim on this one that could be wrong.**

**(e) Gomer's three children's names and meanings.** Hosea 1:4-9 (ESV, live-fetched, verbatim) confirms all three: Jezreel (1:4), Lo-ruhamah/"No Mercy" (1:6, i.e. "not loved"), Lo-ammi/"Not My People" (1:9). The DB's glosses ("not loved," "not my people") match. **No finding.**

**(f) All 18 people's names, alsoKnownAs, gender, and dates against recognized chronologies.** Individually verified: Jeremiah (son of Hilkiah, Anathoth, Benjamin — Jer 1:1 ✓; called Josiah's 13th year ✓); Ezekiel (son of Buzi, Chebar canal, exiled with Jehoiachin 597 BC — Ezek 1:1-3 ✓); Hosea (son of Beeri, Hos 1:1 ✓; ministry dates ~750s-722 BC align with the superscription's king list spanning Jeroboam II through Hezekiah); Amos (shepherd of Tekoa, Jeroboam II's reign, "two years before the earthquake" — Amos 1:1 ✓; Jeroboam II's reign dated 793-753 BC per both `seed-2kings.ts` and independent scholarly search, consistent with "c. 760 BC" for Amos); Obadiah (21 verses confirmed ✓); Jonah (son of Amittai, Gath-hepher, Zebulun — 2 Kings 14:25 ✓); Micah (of Moresheth, Jotham/Ahaz/Hezekiah — Micah 1:1 ✓); Nahum (of Elkosh — Nahum 1:1 ✓); Habakkuk (dated ~605 BC, Jehoiakim's reign — standard scholarly dating, no explicit biblical date given so this is appropriately hedged as "probably"); Zephaniah (Josiah's reign — Zeph 1:1 ✓; genealogy addressed in Finding 9); Haggai (2nd year of Darius I, 520 BC — Hag 1:1 ✓; Temple completed 516 BC matches Ezra 6:15's "sixth year of Darius"); Zechariah (son of Berechiah, grandson of Iddo — Zech 1:1 ✓; contemporary with Haggai, 520-518 BC and beyond, matching Zech 1:1 and 7:1's dated oracles); Malachi (c. 430 BC — standard scholarly range, no explicit biblical date, appropriately hedged). Joel's father Pethuel confirmed (Joel 1:1). **No findings beyond those already listed above.**

---

## Triple-check note (Step 5)

Every finding above was re-verified against its live-fetched source text a second time while drafting this document (the verbatim quotes embedded in each finding are the actual second-pass confirmations, not first-pass paraphrases). A second full read-through of all 10 findings was then done specifically checking for contradictions between findings: no two findings make incompatible claims about the same verse or field, no finding's "current DB state" text conflicts with another finding's, and no proposed correction in one finding is undone by another. Findings 6, 8, 9, and 10 are explicitly presented non-prescriptively per the brief's guidance, since each has more than one defensible resolution. Finding 7 has a single mandated fix and is not among these.
