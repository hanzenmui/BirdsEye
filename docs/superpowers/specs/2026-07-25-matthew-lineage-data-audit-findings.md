Reviewed: 12 people, 14 relationships, 17 refs. 2 findings.

## Finding 1: Ram's description claims Matthew 1:3-4 renders him "Aram," but the ESV renders "Ram"
- **Category:** Incorrect
- **Verse(s):** Matthew 1:3-4
- **Current DB state:** `ram`'s `description` reads "...Listed in the genealogy from Judah to David (Ruth 4:19; 1 Chr 2:9; Matt 1:3-4 as 'Aram')."
- **Proposed correction:** Remove the `"as 'Aram'"` parenthetical, or replace it with an accurate note. The ESV text of Matthew 1:3-4 (fetched live) reads "...and Hezron the father of Ram, and Ram the father of Amminadab..." — "Ram," not "Aram." ("Aram" is the KJV's rendering of a Greek manuscript variant, not this project's stated source of truth.) Corrected text: "...Listed in the genealogy from Judah to David (Ruth 4:19; 1 Chr 2:9; Matt 1:3-4)." The `alsoKnownAs` field's inclusion of "Aram" as an alternate name can remain, since it is a genuine textual variant in other translations — only the specific claim about what Matthew's (ESV) text itself says is wrong.
- **Severity:** Important

## Finding 2: Amminadab's description has an ambiguous pronoun that misreads as making Nahshon Aaron's son
- **Category:** Incorrect
- **Verse(s):** Exodus 6:23, Numbers 1:7
- **Current DB state:** `amminadab`'s `description` reads "...Also the father-in-law of Aaron, whose son Nahshon led Judah in the wilderness."
- **Proposed correction:** Reword to remove the ambiguity, e.g. "...Also the father-in-law of Aaron (Exod 6:23) — Amminadab's own son Nahshon led Judah in the wilderness." As written, "whose" grammatically attaches to the nearest antecedent, "Aaron," making the sentence readable as "Aaron's son Nahshon" — but Nahshon was Amminadab's son (and Aaron's brother-in-law, not son), per Exodus 6:23 and Numbers 1:7.
- **Severity:** Important
