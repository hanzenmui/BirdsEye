Reviewed: 9 people, 15 relationships, 18 refs. 4 findings.

## Finding 1: Mary's quote drops the opening "Behold"
- **Category:** Incorrect
- **Verse(s):** Luke 1:38
- **Current DB state:** `mary_mother`'s description quotes her as responding "I am the servant of the Lord; let it be to me according to your word."
- **Proposed correction:** "Behold, I am the servant of the Lord; let it be to me according to your word." — the ESV's actual wording opens with "Behold," which the current text silently drops while still presenting the rest as a verbatim quotation.
- **Severity:** Minor

## Finding 2: "Elijah who is to come" is attributed to Malachi 4:5, but that's Matthew 11:14's wording
- **Category:** Incorrect
- **Verse(s):** Malachi 4:5, Matthew 11:14
- **Current DB state:** `john_baptist`'s description reads "...the forerunner prophesied by Isaiah 40:3 and Malachi 4:5 ('Elijah who is to come')."
- **Proposed correction:** Malachi 4:5 (ESV) reads "Behold, I will send you Elijah the prophet before the great and awesome day of the LORD comes" — it does not contain the phrase "Elijah who is to come." That exact phrase is Jesus's own words in Matthew 11:14 ("he is Elijah who is to come"), where Jesus applies Malachi's prophecy to John. Reword to: "...the forerunner prophesied by Isaiah 40:3 and Malachi 4:5, whom Jesus identified as 'Elijah who is to come' (Matt 11:14)."
- **Severity:** Important

## Finding 3: John's beheading narrative names the dancer "Salome," a detail absent from the Gospel text
- **Category:** Unsupported
- **Verse(s):** Matthew 14:1-12, Mark 6:14-29
- **Current DB state:** `john_baptist`'s description reads "...imprisoned and ultimately beheaded at Herodias's request when Salome danced."
- **Proposed correction:** Neither Matthew 14 nor Mark 6 (the two Gospel accounts of this episode) names the dancer — both call her only "the daughter of Herodias" (Matt 14:6) or "Herodias's own daughter" (Mark 6:22). The name "Salome" comes from the first-century historian Josephus, not from Scripture. Reword to avoid presenting the name as if it were in the biblical text: "...imprisoned and ultimately beheaded at Herodias's request after her daughter (traditionally identified as Salome, per Josephus — not named in the Gospels) danced before Herod."
- **Severity:** Important

## Finding 4: Simeon's Nunc Dimittis quote is silently truncated
- **Category:** Incorrect
- **Verse(s):** Luke 2:29-32
- **Current DB state:** `simeon_nt`'s description quotes him as praying "Lord, now you are letting your servant depart in peace, for my eyes have seen your salvation."
- **Proposed correction:** The ESV's full wording is "Lord, now you are letting your servant depart in peace, according to your word; for my eyes have seen your salvation that you have prepared in the presence of all peoples, a light for revelation to the Gentiles, and for glory to your people Israel." The current text quietly drops "according to your word" and everything after "your salvation," presenting a spliced sentence inside continuous quotation marks with no ellipsis marking the omission. Either quote the passage in full, or mark the omission explicitly, e.g. "...depart in peace...for my eyes have seen your salvation" (with the internal ellipsis).
- **Severity:** Minor
