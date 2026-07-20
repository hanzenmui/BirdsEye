# 2 Samuel People & Relationships Data Audit — Design

**Date:** 2026-07-20
**Status:** Approved

## Context

Ninth in the per-book audit series (Genesis, Exodus, Numbers, Deuteronomy, Joshua, Judges, Ruth, and 1 Samuel already merged — see their design specs for the established methodology, source, and fix-mechanism decisions, all reused unchanged here). `scripts/seed-2samuel.ts` adds 17 new people continuing directly from 1 Samuel's cast: Saul's surviving line (Ish-bosheth/Esh-baal, Mephibosheth/Merib-baal), David's commanders (Zeruiah and her sons Joab, Abishai, Asahel), the Bathsheba/Uriah/Nathan narrative, David's children (Amnon, Tamar, Absalom), Absalom's revolt cast (Ahithophel, Hushai, Shimei), the priests Zadok, and Obed-edom — 30 relationships, 20 scripture refs.

This book directly extends the David family the 1 Samuel and Ruth audits already verified (David, Saul, Jonathan, Abner all pre-exist; `david_family` in `lib/families.ts` already includes Bathsheba and other names this book introduces relationships for). Two people have the classic "-bosheth"/"-baal" dual naming (Ish-bosheth/Esh-baal, Mephibosheth/Merib-baal — a well-documented scribal convention substituting "bosheth" ('shame') for "baal" in later copies to avoid invoking the pagan god's name), worth confirming the DB states this accurately rather than treating one as merely an alternate spelling.

## Scope

**In scope:**
- All 17 new people: name, alternate names, description, tags, gender.
- All 30 relationships in the file, including the many that reference pre-existing people (Saul, Jonathan, Abner, David, Ahinoam — all from 1 Samuel or earlier books).
- All 20 scripture refs added by this file.

**Out of scope:**
- Re-auditing Saul/Jonathan/Abner/David/Ahinoam's own person records (owned by 1 Samuel or earlier books) — only the relationships this file adds referencing them are in scope.
- Any book other than 2 Samuel.

## Methodology (unchanged from prior books)

1. Enumerate every person/relationship/ref in `scripts/seed-2samuel.ts` (full file — 268 lines, read in one pass).
2. Cross-reference against ESV, fetched live, not recalled from memory: 2 Samuel 2-4 (Ish-bosheth, Abner's defection and death), 6 (Obed-edom, the ark), 7 (Nathan's covenant), 8-9 (Zadok, Mephibosheth restored), 11-12 (Bathsheba, Uriah, Nathan's confrontation), 13 (Amnon, Tamar, Absalom's revenge), 15-18 (Absalom's revolt, Ahithophel, Hushai, Shimei), also 1 Chronicles 2:16 for the "Zeruiah is David's sister" claim, since 2 Samuel itself doesn't directly state this relationship.
3. Prioritize: (a) the Ish-bosheth/Esh-baal and Mephibosheth/Merib-baal dual-naming convention is stated accurately (a genuine scribal substitution, not just an "alternate name"), (b) the "David sibling_of Zeruiah" relationship's actual textual basis — confirm whether this is a 2 Samuel claim or requires the 1 Chronicles cross-reference, and that the file's citation is accurate, (c) the Bathsheba/David/Uriah/Nathan sequence and Solomon's birth-order among Bathsheba's sons, (d) Absalom's physical description (hair weight, "five pounds" — check the ESV's actual unit, shekels) and the revolt's key relationship turns (Ahithophel/Hushai/Shimei), (e) all 20 refs' chapter:verse ranges and note text.
4. Triple-check: verify each finding once when found, then a second full pass before presenting findings.
5. Single audit pass — 17 people is smaller than 1 Samuel (22) and comparable to Joshua (8) or Judges-sized books, so no section split needed.

## Findings report, correction & verification

Identical mechanism to prior books: findings document (`docs/superpowers/specs/2026-07-20-2samuel-data-audit-findings.md`), then `scripts/fix-2samuel-audit.ts` (same dry-run-gated pattern as `fix-1samuel-audit.ts`), controller reviews dry-run before live execution, then live verification via API pull (or direct DB query, given the sandboxed-network limitation observed for some subagents during 1 Samuel's Task 3 — controller can verify directly if a subagent hits that blocker) plus a `buildForest` chain-completeness spot-check on `david_family` in `lib/families.ts`, which already includes Bathsheba and likely other names this book adds relationships for — must be actually run, not assumed clear.

## Out of scope

- Any book other than 2 Samuel.
- Re-auditing Saul/Jonathan/Abner/David/Ahinoam's own person records (owned by their originating books).
