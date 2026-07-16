# Exodus Data Audit — Findings

Reviewed: 25 people, 34 relationships, 48 refs. 3 findings.

Single-pass audit of `scripts/seed-exodus.ts` (per `docs/superpowers/specs/2026-07-15-exodus-data-audit-design.md`),
cross-referenced against the ESV text fetched live (WebFetch and direct `curl` retrieval of
biblegateway.com/ESV pages, both used in this session; no claim below is answered from memory).
Counts were grep-verified directly against the file: `grep -c 'await insertPerson' ` (lines 92-201)
= 25, relationship calls (`insertRel` + `insertRelByName`, lines 207-248) = 34, `insertRef` calls
(lines 254-327) = 48.

The chain Levi → Kohath → Amram → Moses/Aaron/Miriam (Exodus 6:16-20, cross-checked against
Numbers 26:57-59) and the chain Aaron → Nadab/Abihu/Eleazar/Ithamar → (Eleazar →) Phinehas
(Exodus 6:23, 6:25, 28:1, Numbers 3:2-4) were traced end-to-end in the current DB data and found
**complete** — every intermediate person and relationship named in these two chains by the
source text is present in `scripts/seed-exodus.ts` with no missing link. Both DB descriptions and
relationship structure match the fetched ESV text verbatim (Amram "took as his wife Jochebed his
father's sister" — the DB's "aunt" description is correct; Aaron "took as his wife Elisheba, the
daughter of Amminadab and the sister of Nahshon" — the DB's description is correct; Nadab and
Abihu "died... they had no children" per Numbers 3:4 — the DB's "died childless" claim for both is
correct). This is a positive result, not a finding.

The one genuine chain-completeness gap found is in the Bezalel/Hur/Uri line (Finding 1 below) —
a different family line from the two the brief calls out by name, but the same class of bug.

---

## Finding 1: Bezalel is recorded as Hur's direct son, skipping the intermediate generation (Uri) — and Uri has no person record at all

- **Category:** Structural gap
- **Verse(s):** Exodus 31:2 ("Bezalel the son of Uri, son of Hur, of the tribe of Judah" — ESV, confirmed by live fetch); corroborated by 1 Chronicles 2:18-20 ("Hur fathered Uri, and Uri fathered Bezalel" — ESV, confirmed by live fetch)
- **Current DB state:** `bezalel.description` (seed-exodus.ts line 170) itself reads "**Son of Uri**, grandson of Hur, from the tribe of Judah" — correctly naming Uri as the intermediate generation. The relationship inserted, however, is `insertRel("hur", "parent_of", "bezalel", "Bezalel is son of Uri, son of Hur")` (line 241) — a **direct** `hur → parent_of → bezalel` edge whose own `notes` field states the very three-generation chain (Hur → Uri → Bezalel) that the relationship itself skips. No `insertPerson` call anywhere in the file creates a `key: "uri"` record (confirmed via full-file grep: zero matches), and no relationship connects Hur to any Uri, or Uri to Bezalel. The DB's own person description and the DB's own relationship annotation both correctly state the three-generation genealogy in prose, but the actual graph data flattens it to a direct parent-child edge with the middle person entirely absent — exactly the "looks complete at a glance but has a missing intermediate person, breaking tree rendering" pattern this audit series specifically watches for.
- **Proposed correction:** Add a person record for **Uri** (proposed key: `uri`, son of Hur, father of Bezalel, tribe of Judah, per Exodus 31:2 / 1 Chronicles 2:20). Replace the single `hur parent_of bezalel` relationship with two: `hur parent_of uri` and `uri parent_of bezalel`. Update the existing relationship's notes accordingly (or drop the note, since the two-hop chain now states the genealogy structurally instead of only in a text annotation).
- **Notes for collision check:** Proposed key `uri` does not collide with any existing key in `scripts/seed-exodus.ts` (confirmed via `grep -n 'key: "'` against the current file — no `uri` key exists) or in `scripts/seed-genesis.ts`'s 68-person key list (confirmed via the same grep against that file — no `uri` key exists there either; Genesis's key list contains no name beginning with "uri"). No collision found. Note there are other biblical people named Uri/Uriah (e.g., 1 Kings, 2 Samuel) but none are in either seed file's current scope, so no disambiguation suffix (e.g. `uri_hur`) is needed at this time — plain `uri` is safe.
- **Severity:** Important

---

## Finding 2: Hobab's identity as Moses' brother-in-law (rather than father-in-law) follows only one of two textual traditions — Judges 1:16 and Judges 4:11 both call Hobab himself "Moses' father-in-law," while Numbers 10:29 (the DB's apparent source) is genuinely ambiguous between Hobab and Reuel

- **Category:** Unsupported
- **Verse(s):** Numbers 10:29; Judges 1:16; Judges 4:11
- **Current DB state:** `hobab.description` (seed-exodus.ts line 187) reads "**Son of Jethro (Reuel), Moses' brother-in-law**." This reading resolves Numbers 10:29 (ESV, confirmed by live fetch) — "Moses said to Hobab **the son of Reuel** the Midianite, **Moses' father-in-law**" — by taking "Moses' father-in-law" as modifying Reuel (i.e., Reuel is the father-in-law, Hobab is Reuel's son and thus Moses' brother-in-law). This is a defensible, commonly-held reading and is consistent with Exodus 2:18/3:1 identifying Reuel/Jethro as the priest of Midian who gave Moses his daughter. However, two other verses about the same figure read the other way: Judges 1:16 (ESV, confirmed by live fetch) — "the descendants of the Kenite, **Moses' father-in-law**, went up... into the wilderness of Judah... in the Negeb" — and Judges 4:11 (ESV, confirmed by live fetch) — "Heber the Kenite had separated from the Kenites, the descendants of **Hobab the father-in-law of Moses**" — both directly and unambiguously call **Hobab** (not Reuel) "Moses' father-in-law," with no intervening "son of" clause to soften the reading. The DB's relationship `insertRel("jethro", "parent_of", "hobab")` (line 226) and description assert only the brother-in-law reading as settled fact, without acknowledging Judges 1:16/4:11's competing direct identification.
- **Proposed correction:** Soften `hobab.description` to acknowledge the textual tension rather than presenting the brother-in-law reading as the only possibility — e.g., append "(Numbers 10:29 is read here as identifying Reuel, not Hobab, as Moses' father-in-law, making Hobab a brother-in-law; Judges 1:16 and 4:11, however, call Hobab himself 'Moses' father-in-law,' so the exact relationship is debated)." This does not require any relationship-type or person-record change — `jethro parent_of hobab` can be retained as the DB's chosen reading — only a wording softening in the description, parallel to how the Genesis audit's Finding U2 (Eliezer/Genesis 24) handled an analogous inference-presented-as-fact issue.
- **Severity:** Minor

---

## Finding 3: Hur's description says "son of Caleb," but the only "Caleb" person record in the database is Caleb son of Jephunneh (the spy) — a different, much later individual from Hur's actual father, Caleb son of Hezron

- **Category:** Unsupported
- **Verse(s):** 1 Chronicles 2:18-20 ("Caleb the son of **Hezron**... Hur fathered Uri, and Uri fathered Bezalel"); contrast Numbers 13:6/14:6 ("Caleb the son of **Jephunneh**")
- **Current DB state:** `hur.description` (seed-exodus.ts line 174) reads "From the tribe of Judah, **son of Caleb** and Ephrath." The only `key: "caleb"` record in the database (seed-exodus.ts line 182) is described as "Son of **Jephunneh** from the tribe of Judah. One of the twelve spies sent into Canaan" — Caleb son of Jephunneh, a contemporary of Moses and Joshua during the Exodus/conquest. These are two distinct, separately-named "Caleb"s in scripture (1 Chronicles 2:18 names Caleb son of Hezron; Numbers 13:6 names Caleb son of Jephunneh), generations apart — Hur (Bezalel's grandfather, alive during the tabernacle's construction in the wilderness) cannot be the son of a Caleb who was himself an adult contemporary of Moses in that same wilderness generation. Since the database currently has no separate person record for Caleb son of Hezron, Hur's unqualified "son of Caleb" reads as though it refers to the only Caleb on file — the spy — which is chronologically impossible and not what 1 Chronicles 2:18-20 says.
- **Proposed correction:** Clarify `hur.description` to specify "son of Caleb **son of Hezron**" (or similar), explicitly distinguishing him from Caleb son of Jephunneh the spy — following the same "not to be confused with X" disambiguation pattern already used elsewhere in this app's data (e.g. the Genesis audit's Potiphera finding, or this database's existing `enoch_cain`/`enoch_seth` descriptions). This is a wording clarification only; no relationship in the database currently and incorrectly links Hur to the `caleb` (spy) person record, so no relationship change is needed — only the description text.
- **Notes for collision check:** No new person or key is proposed by this finding.
- **Severity:** Minor

---

## Findings Summary Table

| # | Finding | Category | Severity |
|---|---------|----------|----------|
| 1 | Bezalel recorded as Hur's direct son; Uri (the actual intermediate generation, per Ex 31:2 and 1 Chr 2:18-20) is entirely missing as a person record | Structural gap | Important |
| 2 | Hobab described as only "Moses' brother-in-law" without acknowledging Judges 1:16/4:11's competing direct "father-in-law" identification | Unsupported | Minor |
| 3 | Hur's "son of Caleb" description reads as the wrong Caleb (the only one in the DB, son of Jephunneh the spy) instead of the correct Caleb son of Hezron (1 Chr 2:18-20) | Unsupported | Minor |

**Totals:** 0 Critical, 1 Important, 2 Minor. 1 Structural gap, 0 Incorrect, 0 Missing, 2 Unsupported.

---

## Triple-Check Pass (Step 5)

**First re-verification (re-checked each finding individually against fetched text):**
- Finding 1: Re-read `scripts/seed-exodus.ts` lines 169-175 and 241 directly. Re-confirmed via a second live `curl` fetch of biblegateway.com that Exodus 31:2 ESV reads "Bezalel the son of Uri, son of Hur, of the tribe of Judah" and 1 Chronicles 2:18-20 ESV reads "Caleb the son of Hezron... married Ephrath, who bore him Hur. Hur fathered Uri, and Uri fathered Bezalel." Both confirm Uri as the necessary intermediate generation. Re-confirmed via full-file grep that no `key: "uri"` exists anywhere in `seed-exodus.ts`. No discrepancy.
- Finding 2: Re-read `scripts/seed-exodus.ts` line 187 and 226 directly. Re-confirmed via live `curl` fetch that Numbers 10:29 ESV reads "Moses said to Hobab the son of Reuel the Midianite, Moses' father-in-law," and that Judges 1:16 ESV reads "the descendants of the Kenite, Moses' father-in-law... in the Negeb," and Judges 4:11 ESV reads "the descendants of Hobab the father-in-law of Moses." All three citations confirmed accurate on re-check. No discrepancy.

**Second full read-through (checking for contradictions between findings):** Findings 1 and 2 touch entirely disjoint people (Hur/Uri/Bezalel vs. Jethro/Reuel/Hobab) and disjoint relationship edges — no overlap, no contradiction. Finding 1's proposed new person (`uri`) does not appear anywhere in Finding 2, and vice versa. Neither finding assumes a DB state the other finding would change. No unresolved issues.

**Collision check performed within this document (not just reported separately):** Finding 1's proposed key `uri` was checked against both `scripts/seed-exodus.ts`'s own 25 keys and `scripts/seed-genesis.ts`'s 68 keys (both grepped directly) — no collision with either file. Finding 2 proposes no new person or key.
