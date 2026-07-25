Reviewed: 10 people, 13 relationships, 36 refs. 6 findings.

## Finding 1: Tychicus's quote substitutes "dear"/"servant" for the ESV's "beloved"/"minister"
- **Category:** Incorrect
- **Verse(s):** Ephesians 6:21
- **Current DB state:** `tychicus`'s description quotes him as "'our dear brother and faithful servant in the Lord' (Eph 6:21; Col 4:7)."
- **Proposed correction:** Ephesians 6:21 (ESV) reads "Tychicus the beloved brother and faithful minister in the Lord." Replace with "'the beloved brother and faithful minister in the Lord'" — "dear" and "servant" are not the ESV's words at either cited verse (Col 4:7 similarly reads "a beloved brother and faithful minister and fellow servant in the Lord").
- **Severity:** Important

## Finding 2: Alexander the coppersmith's quote adds words not in the ESV
- **Category:** Incorrect
- **Verse(s):** 2 Timothy 4:14
- **Current DB state:** `alexander_coppersmith`'s description quotes him as having "'did me a great deal of harm' according to Paul (2 Tim 4:14)."
- **Proposed correction:** 2 Timothy 4:14 (ESV) reads "Alexander the coppersmith did me great harm." Replace with "'did me great harm'" — "a great deal of" is not in the ESV's text.
- **Severity:** Important

## Finding 3: 2 Peter's opening quote uses "Simon Peter" where the ESV's specific wording is "Simeon Peter"
- **Category:** Incorrect
- **Verse(s):** 2 Peter 1:1
- **Current DB state:** `peter`'s scripture_refs note for the 2 Peter 1:1 ref reads "Peter identifies himself as author: 'Simon Peter, a servant and apostle'."
- **Proposed correction:** 2 Peter 1:1 (ESV) reads "Simeon Peter, a servant and apostle of Jesus Christ" — the ESV specifically uses the fuller Hebraic form "Simeon" at this verse (distinct from the usual "Simon" used elsewhere in the NT for the same person). Replace with "'Simeon Peter, a servant and apostle'".
- **Severity:** Important

## Finding 4: "The Elect Lady" is quoted as "the chosen lady" in three places, but the ESV says "elect lady"
- **Category:** Incorrect
- **Verse(s):** 2 John 1:1
- **Current DB state:** Three locations all say "chosen" instead of "elect": `elect_lady`'s own description ("addressed as 'the chosen lady and her children'"), the `john`→`elect_lady` relationship note ("writes 'to the chosen lady and her children'"), and the `elect_lady` scripture_refs note ("The chosen lady and her children: recipient of 2 John").
- **Proposed correction:** 2 John 1:1 (ESV) reads "The elder to the elect lady and her children, whom I love in truth." Replace "chosen" with "elect" in all three locations — notably, the person's own DB key/name is already correctly "The Elect Lady," making the "chosen" wording in the quoted text an internal inconsistency as well as a misquote.
- **Severity:** Important

## Finding 5: Peter's 1 Peter 5:13 quote says "in Babylon" where the ESV says "at Babylon"
- **Category:** Incorrect
- **Verse(s):** 1 Peter 5:13
- **Current DB state:** `peter`'s scripture_refs note for the 1 Peter 5:13 ref reads "Greetings from 'she who is in Babylon' — the Roman church."
- **Proposed correction:** 1 Peter 5:13 (ESV) reads "She who is at Babylon, who is likewise chosen, sends you greetings." Replace "in Babylon" with "at Babylon".
- **Severity:** Important

## Finding 6: Fortunatus's and Achaicus's refs don't cover the verse that supports their "refreshed his spirit" description
- **Category:** Incorrect
- **Verse(s):** 1 Corinthians 16:17-18
- **Current DB state:** Both `fortunatus` and `achaicus` have a scripture_refs row spanning 1 Corinthians 16:17-16:17 (a single verse), while their own descriptions say they visited Paul "refreshing his spirit" — but 1 Corinthians 16:17 only names the three visitors ("I rejoice at the coming of Stephanas and Fortunatus and Achaicus"); the "refreshed my spirit" detail is in verse 18, outside the cited range.
- **Proposed correction:** Extend both refs' `chapter_end`/`verse_end` from 16:17 to 16:18, so the cited range actually covers the verse ("for they refreshed my spirit as well as yours") that supports each person's own description.
- **Severity:** Important
