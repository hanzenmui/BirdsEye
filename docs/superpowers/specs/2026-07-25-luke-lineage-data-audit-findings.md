Reviewed: 38 people, 40 relationships, 41 refs. 2 findings.

## Finding 1: Both Luke-genealogy "Matthias" people are misspelled — ESV renders "Mattathias"
- **Category:** Incorrect
- **Verse(s):** Luke 3:25-26
- **Current DB state:** ESV Luke 3:25 reads "the son of Mattathias, the son of Amos..." and 3:26 reads "...the son of Maath, the son of Mattathias, the son of Semein..." — but the DB spells both figures "Matthias" throughout:
  - `matthias_luke_upper`: `name` = "Matthias", `alsoKnownAs` = "Matthias son of Semein, in Luke's genealogy", description = "Son of Semein and father of Maath in Luke's genealogy of Jesus (Luke 3:26). Different from the apostle Matthias chosen in Acts 1; known only from this genealogical record."
  - `matthias_luke_lower`: `name` = "Matthias", `alsoKnownAs` = "Matthias son of Amos, in Luke's genealogy lower", description = "Son of Amos and father of Joseph in Luke's genealogy of Jesus (Luke 3:25). Known only from this genealogical record."
  - `semein`'s description: "...father of Matthias in Luke's genealogy of Jesus (Luke 3:26)."
  - `maath`'s description: "Son of Matthias and father of Naggai..."
  - `amos_luke`'s description: "...father of Matthias in Luke's genealogy of Jesus (Luke 3:25)."
  - `joseph_luke_lower`'s description: "Son of Matthias and father of Jannai..."
  - The scripture_refs note for `matthias_luke_upper`: "Matthias son of Semein in Luke's genealogy"
  - The scripture_refs note for `matthias_luke_lower`: "Matthias son of Amos in Luke's genealogy"
- **Proposed correction:** Change "Matthias" to "Mattathias" in every location listed above — both person records' `name` and `alsoKnownAs` fields, all four cross-referencing descriptions, and both scripture_refs notes. On `matthias_luke_upper`'s description, also reword the apostle-disambiguation clause since the names now visibly differ: "Not the same name as the apostle Matthias chosen in Acts 1, despite the similar spelling."
- **Severity:** Important

## Finding 2: Neri's description and the Neri→Shealtiel relationship both misquote Matthew's wording for Shealtiel's father
- **Category:** Incorrect
- **Verse(s):** Matthew 1:12
- **Current DB state:** `neri`'s description reads "...Luke says Shealtiel is son of Neri, while Matthew says son of Jehoiachin — a longstanding theological discrepancy..." and the `insertRelLocalToName("neri", "parent_of", "Shealtiel", ...)` relationship note reads "...Matthew says son of Jehoiachin (Matt 1:12)..." — but Matthew 1:12 (ESV) reads "Jechoniah was the father of Shealtiel," not "Jehoiachin."
- **Proposed correction:** Change "Jehoiachin" to "Jechoniah" in both the `neri` description and the relationship note, matching Matthew's actual (ESV) wording. (Jehoiachin and Jechoniah refer to the same historical king — 2 Kings uses "Jehoiachin," Matthew's Greek text is traditionally rendered "Jechoniah" — so this is a wording-fidelity fix, not a substantive/theological correction to the discrepancy claim itself, which remains accurate.)
- **Severity:** Minor
