# Genesis Data Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every person and Genesis-native relationship in `scripts/seed-genesis.ts` against the actual Genesis text (ESV, fetched live), producing a findings document, then correct the live database to match.

**Architecture:** This is a research-and-correction project, not a code-feature project. Tasks 1-4 each audit one narrative section of Genesis independently (parallel-safe — they don't depend on each other) and each produces its own findings section. Task 5 consolidates all four into one document and does a final cross-section coherence pass (catching issues that only show up when sections are viewed together, like a chain that starts in one section's people and is expected to continue into the next). Task 6 writes and runs a one-off correction script against the live Turso database. Task 7 re-verifies the live data post-correction.

**Tech Stack:** TypeScript, `tsx`, `@libsql/client` (Turso) for the correction script — same pattern as the existing seed scripts. WebFetch/WebSearch for source-text verification. No test framework (none exists in this project).

## Global Constraints

- **Source of truth:** ESV (English Standard Version), fetched live via WebFetch/WebSearch for every claim checked. Do not rely on training-data memory for genealogical facts or verse content — this project already shipped one bug caused by exactly that (see `docs/superpowers/specs/2026-07-09-genesis-data-audit-design.md`, Context section).
- **In scope:** every person in `scripts/seed-genesis.ts`, and every relationship where **both** people originate in Genesis. Scripture refs (`insertRef` calls) are lower priority — spot-check for correct book/chapter/verse, not exhaustive verification.
- **Out of scope:** relationships crossing into people added by other books' seed scripts (deferred to that book's future audit); any book other than Genesis; the tree-rendering work (already shipped separately).
- **Findings categories** (use exactly these labels): `Incorrect`, `Missing`, `Unsupported`, `Structural gap`. Each finding needs: category, verse citation(s), current DB state, proposed correction, severity (`Critical`/`Important`/`Minor`).
- **Priority:** genealogical chain completeness (no gaps in `parent_of` chains) is the highest-value finding category, since a broken chain is what caused the original reported bug (Enoch/Lamech rendering as disconnected nodes in Adam's Family).
- **Nothing gets written to the live database until Task 6** — Tasks 1-5 are pure research/documentation, producing markdown only.

---

### Task 1: Audit Primeval History & Post-Flood (Genesis 1-10)

**Files:**
- Read: `scripts/seed-genesis.ts` lines 74-153 (people: Adam, Eve, Cain, Abel, Seth, Enoch son of Cain, Enosh, Enoch son of Jared, Lamech son of Methuselah, Noah, Shem, Ham, Japheth, Cush, Nimrod — read this range directly from the file for exact current field values, do not rely on this list alone)
- Read: `scripts/seed-genesis.ts` lines 368-491 (relationships — search this range for any relationship where person A or B is one of the people from lines 74-153)
- Read: `scripts/seed-genesis.ts` lines 493-691 (scripture refs — spot-check refs for the same people)
- Create: `docs/superpowers/specs/2026-07-09-genesis-audit-section-1-primeval.md`

**Interfaces:**
- Produces: a findings markdown file other tasks don't depend on programmatically, but Task 5 reads it to consolidate.

- [ ] **Step 1: Enumerate**

Read `scripts/seed-genesis.ts` lines 74-153 in full. List every person (`key`, `name`, `alsoKnownAs`, `gender`, `description`, `tags`). Then search lines 368-491 for every relationship involving any of these people (by their `key`), and lines 493-691 for their scripture refs.

- [ ] **Step 2: Fetch source text**

Use WebFetch/WebSearch to retrieve the ESV text of Genesis 1:26-31, 2, 3, 4 (Cain/Abel/Seth/Cain's line), 5 (Seth's line to Noah), and 6:1-9:29 (Noah, the flood, his sons), and 10 (the Table of Nations, for Cush/Nimrod). Do not answer from memory — fetch and read the actual text.

- [ ] **Step 3: Cross-reference and trace chains**

For each person: verify name, alternate names, gender, and that the description doesn't contradict the text. For each relationship: verify it's textually supported and correctly typed (`parent_of` vs. `spouse_of` vs. `sibling_of`, etc.). Specifically trace: Adam→Seth→Enosh→Kenan→Mahalalel→Jared→Enoch→Methuselah→Lamech→Noah (Gen 5's full chain) and Cain→Enoch→Irad→Mehujael→Methushael→Lamech→(Jabal/Jubal/Tubal-cain/Naamah) (Gen 4:17-22's full chain) end-to-end in the current DB data — note every name in each chain that exists in the DB versus is missing, since a missing intermediate name breaks the chain even if the two endpoints you already have are each individually correct. This is exactly the class of bug that motivated this audit.

- [ ] **Step 4: Write findings**

Create `docs/superpowers/specs/2026-07-09-genesis-audit-section-1-primeval.md` with one entry per finding, formatted:

```markdown
## Finding N: <short description>
- **Category:** Incorrect | Missing | Unsupported | Structural gap
- **Verse(s):** <citation>
- **Current DB state:** <what's there now — key, field, or relationship>
- **Proposed correction:** <exact new value or exact new/removed relationship>
- **Severity:** Critical | Important | Minor
```

If a person/relationship/ref has no issues, do not write a finding for it — only write findings for actual discrepancies. At the top of the file, add a one-line summary: `Reviewed: <N> people, <M> relationships, <K> refs. <F> findings.`

- [ ] **Step 5: Triple-check**

Re-verify every finding in the file against the actual fetched text once more (not from memory of Step 3 — re-check the citation). Then do a second full read-through of the findings list checking for contradictions (e.g., two findings that can't both be true, or a "Missing" finding for a chain link that a later finding also claims is "Unsupported").

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-07-09-genesis-audit-section-1-primeval.md
git commit -m "$(cat <<'EOF'
docs: add Genesis audit findings — primeval history & post-flood

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Audit Shem→Abraham Line & Terah's Family (Genesis 11-24)

**Files:**
- Read: `scripts/seed-genesis.ts` lines 155-225 (people: Arpachshad, Shelah, Eber, Peleg, Reu, Serug, Nahor son of Serug, Nahor son of Terah, Terah, Haran, Abraham, Sarah, Hagar, Ishmael, Lot — read this range directly for exact current field values)
- Read: `scripts/seed-genesis.ts` lines 368-491 (relationships — search for entries involving people from lines 155-225)
- Read: `scripts/seed-genesis.ts` lines 493-691 (scripture refs — spot-check for the same people)
- Create: `docs/superpowers/specs/2026-07-09-genesis-audit-section-2-shem-abraham.md`

**Interfaces:**
- Produces: a findings markdown file; Task 5 reads it to consolidate.

- [ ] **Step 1: Enumerate**

Read `scripts/seed-genesis.ts` lines 155-225 in full. List every person, then search lines 368-491 and 493-691 for their relationships and refs.

- [ ] **Step 2: Fetch source text**

Fetch the ESV text of Genesis 11:10-32 (Shem's line to Abraham/Nahor/Haran), 12 (Abraham's call), 16 (Hagar/Ishmael), 17 (covenant, renaming), 19 (Lot), 20-21 (Abimelech, Isaac's birth), 22 (Isaac's binding), 23 (Sarah's death), 24 (Isaac's marriage — for context on Rebekah's introduction, even though Rebekah herself is audited in Task 3).

- [ ] **Step 3: Cross-reference and trace chains**

Trace Shem→Arpachshad→Shelah→Eber→Peleg→Reu→Serug→Nahor→Terah (Gen 11:10-26) end-to-end, noting any missing intermediate names. Verify Terah's three sons (Abram, Nahor, Haran) and Haran's children (Lot, Milcah, Iscah — check whether Milcah/Iscah are in the DB at all). Verify the two distinct "Nahor"s in the DB (son of Serug vs. son of Terah/Abraham's brother) are each correctly distinguished — this is a known `akaHint` disambiguation case from earlier work this session (`lib/families.ts`), confirm the underlying person records themselves (not just the resolver) are correctly described.

- [ ] **Step 4: Write findings**

Same format as Task 1 Step 4. Create `docs/superpowers/specs/2026-07-09-genesis-audit-section-2-shem-abraham.md`.

- [ ] **Step 5: Triple-check**

Same process as Task 1 Step 5.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-07-09-genesis-audit-section-2-shem-abraham.md
git commit -m "$(cat <<'EOF'
docs: add Genesis audit findings — Shem-to-Abraham line & Terah's family

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Audit Isaac, Jacob, and Judah's Families (Genesis 25-38)

**Files:**
- Read: `scripts/seed-genesis.ts` lines 227-346 (people: Isaac, Rebekah, Esau, Jacob, Laban [if present in this range — confirm exact key names by reading the file], Leah, Rachel, Bilhah, Zilpah, Reuben through Benjamin (12 sons) and Dinah, Tamar, Er, Onan, Shelah son of Judah, Perez — read this range directly for exact current field values)
- Read: `scripts/seed-genesis.ts` lines 368-491 (relationships — search for entries involving people from lines 227-346)
- Read: `scripts/seed-genesis.ts` lines 493-691 (scripture refs — spot-check for the same people)
- Create: `docs/superpowers/specs/2026-07-09-genesis-audit-section-3-isaac-jacob-judah.md`

**Interfaces:**
- Produces: a findings markdown file; Task 5 reads it to consolidate.

- [ ] **Step 1: Enumerate**

Read `scripts/seed-genesis.ts` lines 227-346 in full. List every person, then search lines 368-491 and 493-691 for their relationships and refs.

- [ ] **Step 2: Fetch source text**

Fetch the ESV text of Genesis 25 (Isaac's family, Esau/Jacob birth), 26-28 (blessing, Jacob's flight), 29-31 (Jacob's marriages to Leah/Rachel, Laban, the 12 sons' births in 29:31-30:24 plus Benjamin in 35:16-18), 34 (Dinah), 35 (Bilhah/Zilpah's status, Rachel's death, the full list of the 12 sons), 36 (Esau's line — for confirming what's deliberately NOT audited in this DB if absent), 38 (Judah, Tamar, Er, Onan, Shelah, Perez, Zerah).

- [ ] **Step 3: Cross-reference and trace chains**

Verify Leah's sons (Reuben, Simeon, Levi, Judah, Issachar, Zebulun), Rachel's sons (Joseph, Benjamin), Bilhah's sons (Dan, Naphtali), and Zilpah's sons (Gad, Asher) are each attributed to the correct mother per Gen 29:31-30:24 and 35:16-18 — check the DB's `parent_of` relationships for each son name against the mother the text actually assigns, not just that *a* mother relationship exists. Verify Dinah (Gen 34:1, daughter of Leah per 30:21) is correctly attributed. Check whether Zerah (Tamar's other twin, Gen 38:30) exists in the DB alongside Perez — if not, that's a `Missing` finding.

- [ ] **Step 4: Write findings**

Same format as Task 1 Step 4. Create `docs/superpowers/specs/2026-07-09-genesis-audit-section-3-isaac-jacob-judah.md`.

- [ ] **Step 5: Triple-check**

Same process as Task 1 Step 5.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-07-09-genesis-audit-section-3-isaac-jacob-judah.md
git commit -m "$(cat <<'EOF'
docs: add Genesis audit findings — Isaac, Jacob, and Judah's families

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Audit Joseph in Egypt (Genesis 39-50)

**Files:**
- Read: `scripts/seed-genesis.ts` lines 348-366 (people: Potiphar, Asenath, Manasseh, Ephraim — read this range directly for exact current field values)
- Read: `scripts/seed-genesis.ts` lines 368-491 (relationships — search for entries involving people from lines 348-366, and also Joseph's own relationships to his father Jacob and his 11 brothers, which are defined elsewhere in the file since Joseph himself is a "twelve sons" entry from Task 3's range — cross-check with Task 3's findings for consistency once both are done, in Task 5)
- Read: `scripts/seed-genesis.ts` lines 493-691 (scripture refs — spot-check for the same people)
- Create: `docs/superpowers/specs/2026-07-09-genesis-audit-section-4-joseph.md`

**Interfaces:**
- Produces: a findings markdown file; Task 5 reads it to consolidate.

- [ ] **Step 1: Enumerate**

Read `scripts/seed-genesis.ts` lines 348-366 in full. List every person, then search lines 368-491 and 493-691 for their relationships and refs.

- [ ] **Step 2: Fetch source text**

Fetch the ESV text of Genesis 37 (Joseph sold), 39-41 (Potiphar, Egypt, rise to power, Asenath given as wife by Pharaoh via Potiphera priest of On), 46 (Jacob's household enumerated, including Manasseh and Ephraim born to Joseph), 48 (Jacob blesses Manasseh and Ephraim), 50 (Joseph's death).

- [ ] **Step 3: Cross-reference**

Verify Potiphar's role is correctly described (Gen 39:1 — Pharaoh's officer, captain of the guard) and is not confused with Potiphera, priest of On, who is Asenath's father (Gen 41:45) — these are two distinct named individuals in the text; confirm the DB has this distinction correct (or flag it as `Incorrect` if the DB's single "Potiphar" entry conflates them). Verify Manasseh and Ephraim's birth order (Manasseh firstborn per Gen 41:51-52, confirmed by the blessing-crossing story in Gen 48:13-20 where Jacob deliberately reverses the expected order) matches the DB.

- [ ] **Step 4: Write findings**

Same format as Task 1 Step 4. Create `docs/superpowers/specs/2026-07-09-genesis-audit-section-4-joseph.md`.

- [ ] **Step 5: Triple-check**

Same process as Task 1 Step 5.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-07-09-genesis-audit-section-4-joseph.md
git commit -m "$(cat <<'EOF'
docs: add Genesis audit findings — Joseph in Egypt

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Consolidate Findings & Cross-Section Coherence Pass

**Files:**
- Read: `docs/superpowers/specs/2026-07-09-genesis-audit-section-1-primeval.md`
- Read: `docs/superpowers/specs/2026-07-09-genesis-audit-section-2-shem-abraham.md`
- Read: `docs/superpowers/specs/2026-07-09-genesis-audit-section-3-isaac-jacob-judah.md`
- Read: `docs/superpowers/specs/2026-07-09-genesis-audit-section-4-joseph.md`
- Create: `docs/superpowers/specs/2026-07-09-genesis-data-audit-findings.md`

**Interfaces:**
- Consumes: the four section findings files from Tasks 1-4 (all four must be complete before this task starts).
- Produces: `docs/superpowers/specs/2026-07-09-genesis-data-audit-findings.md` — the single consolidated findings document Task 6 reads to write the correction script.

- [ ] **Step 1: Merge**

Read all four section findings files. Combine every finding into one document, `docs/superpowers/specs/2026-07-09-genesis-data-audit-findings.md`, organized by category (`Structural gap` findings first, since those are highest-value per the plan's Global Constraints, then `Incorrect`, then `Missing`, then `Unsupported`), each retaining its original severity and citation. Preserve each finding's content exactly as written in its source section file — this step is reorganization, not re-research.

- [ ] **Step 2: Cross-section coherence check**

Read through the combined list specifically looking for issues that only appear when sections are viewed together: does a chain-completeness finding from Task 1 (e.g. antediluvian gap) turn out to already be explained by a person that Task 2 documented as existing under a different key or spelling? Does a `Missing` person proposed in one section duplicate a person already flagged as existing in another section under a slightly different name? Does Task 3's Joseph-related findings and Task 4's Joseph findings agree with each other on Joseph's own core relationships? Note and resolve every such cross-section conflict directly in the consolidated document (do not leave contradictory findings both in the list).

- [ ] **Step 3: Final triple-check pass**

Do one complete read-through of the consolidated document. For every `Critical` and `Important` finding, re-verify its citation is accurate by re-fetching the relevant verse one more time (do not skip this even though it was already checked twice in the source section — this is the plan's explicit "triple check" requirement and this is the final checkpoint before the correction script gets written from this document).

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-07-09-genesis-data-audit-findings.md
git commit -m "$(cat <<'EOF'
docs: consolidate Genesis data audit findings

Merges the four section-level audit passes into one findings
document, resolves cross-section conflicts, and does a final
citation re-check on every Critical/Important finding.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Write and Run the Correction Script

**Files:**
- Read: `docs/superpowers/specs/2026-07-09-genesis-data-audit-findings.md` (Task 5's output — the exact set of corrections to implement)
- Read: `scripts/seed-genesis.ts` (for the exact DB access pattern: `@libsql/client`, `.env.local` credentials, `id()` helper, connection setup — copy this pattern, don't invent a new one)
- Create: `scripts/fix-genesis-audit.ts`

**Interfaces:** None — this is a standalone script, not imported by application code.

- [ ] **Step 1: Write the correction script**

Create `scripts/fix-genesis-audit.ts` following the exact DB-connection pattern used in `scripts/seed-genesis.ts` (same imports, same `.env.local` loading, same `createClient` setup). For each finding in the consolidated findings document:
- `Incorrect` (wrong person field): `UPDATE people SET <field> = ? WHERE id = ?` (look up the person's current `id` by name/key first, same as the seed scripts already do).
- `Incorrect` (wrong relationship type or wrong people): `DELETE FROM relationships WHERE id = ?` followed by `INSERT` with corrected values, or a direct `UPDATE relationships SET type = ? WHERE id = ?` if only the type is wrong.
- `Missing` (approved-for-addition person/relationship): `INSERT` following the exact pattern `insertPerson`/`insertRel` already use in the seed scripts (including `INSERT OR IGNORE` semantics is fine here too, since these are genuinely new rows).
- `Unsupported` (approved-for-removal): `DELETE FROM relationships WHERE id = ?` (or `DELETE FROM people WHERE id = ?` only if the finding explicitly recommends removing the person entirely, not just a mislabeled relationship).

Every SQL statement in the script must have a comment directly above it citing which finding (by its heading from the findings document) it implements — this makes the script auditable against the findings document line-for-line.

- [ ] **Step 2: Dry-run check**

Before executing any mutation, add a `--dry-run` CLI flag (checked via `process.argv.includes("--dry-run")`) that logs every SQL statement and its parameters to the console instead of executing them. Run:

```bash
npx tsx scripts/fix-genesis-audit.ts --dry-run
```

Read the full output and confirm every logged statement matches a finding in the consolidated document — no statement should exist that doesn't trace back to a specific finding, and no `Critical`/`Important` finding should be missing a corresponding statement.

- [ ] **Step 3: Run the correction script for real**

This step mutates the live database. Run:

```bash
npx tsx scripts/fix-genesis-audit.ts
```

Capture and report the full output (row counts affected per statement, any errors).

- [ ] **Step 4: Commit**

```bash
git add scripts/fix-genesis-audit.ts
git commit -m "$(cat <<'EOF'
fix: apply Genesis data audit corrections to live database

Implements every finding from docs/superpowers/specs/2026-07-09-genesis-data-audit-findings.md
against the live Turso database — see that document for the full
citation and rationale behind each correction.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Post-Correction Verification

**Files:** None modified — this is a verification-only task.

**Interfaces:** None.

- [ ] **Step 1: Re-pull live data**

Start the dev server, log in with the passcode from `.env.local` (`ADMIN_PASSCODE`), and fetch `/api/people` and `/api/relationships` with the authenticated session cookie (same technique used earlier this session to validate `lib/families.ts` against live data: `curl -c cookies.txt -X POST -H "Content-Type: application/json" -d '{"passcode":"<passcode>"}' http://localhost:<port>/api/auth/login` then `curl -b cookies.txt http://localhost:<port>/api/people` and `.../api/relationships`).

- [ ] **Step 2: Verify chain completeness**

Using the freshly-pulled data, write a small throwaway `tsx` script that, for each of the Genesis-sourced curated families in `lib/families.ts` (`adam_family`, `noah_family`, `abraham_family`, `isaac_family`, `jacob_family`, `joseph_family`), calls `resolveFamilyMembers` and then a call to `buildForest` (imported from `components/FamilyTree.tsx`) to confirm every member resolves into a single connected tree per family with no unexplained singleton components — specifically confirm Enoch and Lamech are no longer disconnected in `adam_family`'s forest (either because the connecting chain now exists in the DB, or because they were removed from `lib/families.ts`'s member list as a deliberate scope decision — if the latter, note that this is a `lib/families.ts` roster change, not a data-correctness one, and is out of scope for this plan; flag it for a human decision rather than silently editing the roster file).

- [ ] **Step 3: Report results**

Delete the throwaway verification script. Write a short summary (to be included in this task's report, not a new file) of: how many findings were corrected, whether the chain-completeness check passed for each of the 6 Genesis-sourced families, and any residual concerns.

## Self-Review Notes

- **Spec coverage:** enumeration + cross-referencing + findings (Tasks 1-4), consolidation + coherence (Task 5), correction mechanism with dry-run safety (Task 6), post-correction verification (Task 7) — every section of the design spec has a task.
- **Placeholder scan:** no TBDs. Tasks 1-4 point to exact line ranges rather than inlining the seed script's full current content, which is appropriate here (the implementer must read the live file fresh, not work from a stale copy pasted into the plan) — not a placeholder in the sense the rule prohibits.
- **Type consistency:** N/A — this plan produces documentation and a standalone script, not a shared codebase interface. `fix-genesis-audit.ts` (Task 6) is standalone and not imported elsewhere.
- **Decomposition rationale:** Tasks 1-4 are independent (no shared state, each reads the same source file but writes to its own output file) and safe to parallelize if desired, though the plan's default execution is sequential per the controlling skill's "never dispatch multiple implementers in parallel" rule.
