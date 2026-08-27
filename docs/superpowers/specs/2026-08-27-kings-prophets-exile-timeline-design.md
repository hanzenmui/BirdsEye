# Kings, Prophets & Exile Timeline — Design

**Date:** 2026-08-27
**Status:** Approved (pending final review)

## Context

The Family Tree view shows *who's related to whom*. This adds a second, complementary lens: an interactive timeline showing *who lived when*, *which king reigned during which prophet's ministry*, and *when a prophecy came true relative to when it was spoken*.

**Phase 1 scope** (confirmed with user, chosen because it's the best-documented, most cross-referenced stretch of the Old Testament): the Judges → the united monarchy (Saul/David/Solomon) → the kingdom split → both kingdoms' full king lists → the fall of Samaria and Jerusalem → the exile → the return and Nehemiah's wall. Roughly 1400s BC through 445 BC. The rest of the Bible (Genesis–Judges' start, and the entire New Testament) is explicitly out of scope for this spec — a deliberate first slice to prove the pattern before expanding, same reasoning as the original Family Tree category-picker spec.

## Confirmed interaction design

Validated live with the user via the brainstorming visual-companion tool (mockups in `.superpowers/brainstorm/`, not committed) before any real code was written:

1. **Checkbox book filter**, multi-select, union (OR) logic, grouped into categories (Kings & History / Major Prophets / Minor Prophets) rather than one long flat list, plus an "All" toggle. Checking Jeremiah alone shows only what's tagged to the book of Jeremiah; checking Jeremiah + Isaiah shows the union of both. This reuses the exact `scripture_refs.book` tagging that already powers `BooksSection` and `FamilyTree`'s existing single-select book filter — same data, just multi-select instead of one-at-a-time.
2. **Stacked horizontal lanes**, proportionally scaled to actual years (a 41-year reign is visibly ~5x wider than a 2-year reign) — not a schematic/equal-width layout. Lanes, top to bottom: **Judges** (multi-row — they overlap; see Chronology sources), **United monarchy** (Saul/David/Solomon, single row, ending at the 931 BC split), **Judah kings** and **Israel kings** (both single-row, starting at the split), **Events** (point markers, multi-row via collision-stacking), and **Prophets** (multi-row; each a bar spanning active ministry, not full lifespan).
3. **Click a prophet's bar** → a dashed line draws from the prophecy to the event(s) it foretold, plus a plain-language banner (not just a bare cross-reference) explaining the connection, e.g. *"Jeremiah foretold a 70-year exile starting c. 605 BC (Jer 25:11–12). Fulfilled when Jerusalem fell in 586 BC and, later, exiles returned in 538 BC (Ezra 1:1–4)."*
4. **Disputed dates are shown, not resolved.** Where real scholarly disagreement exists (Obadiah's date, Joel's date, Habakkuk's date, the individual judges' spans, and early-vs-late Exodus dating with everything downstream of it), the timeline uses one dating as its primary placement but attaches a footnote giving the alternative and the reasoning — the same way a study Bible footnotes a textual variant. Never silently picks one and hides the debate.
5. **Visual language matches the existing app** — Birdseye's real palette (terracotta family for Judah, teal/plum family for Israel, rose/purple for prophets), not a new theme. Segment labels measure their own rendered width and hide (falling back to a hover tooltip) rather than getting cut off mid-word; event markers that fall close together in time detect the collision and stack onto a second row rather than overlapping.

## Chronology sources

- **Kings of Israel and Judah:** Thiele's chronology (*The Mysterious Numbers of the Hebrew Kings*) — the standard reconstruction used by most study Bibles, reconciling the co-regency/synchronism cross-references between Kings and Chronicles. 931 BC split, Israel falls 722 BC, Judah falls 586 BC.
- **Major events** (independently attested outside the Bible, not just internally — Assyrian/Babylonian/Persian records agree with these): fall of Samaria 722 BC, Sennacherib's failed siege of Jerusalem 701 BC, fall of Jerusalem/Temple 586 BC, fall of Babylon to Cyrus the night of Oct 5/6 539 BC, Cyrus's decree 538 BC, Nehemiah's wall completed 445 BC (52-day build).
- **Prophets** (approximate active-ministry windows): Isaiah c. 740–680, Hosea c. 760–710, Amos c. 760–750, Micah c. 740–700, Jeremiah c. 627–580, Zephaniah c. 630–627 (early in Josiah's reign), Nahum between 663 and 612 BC (bracketed by real events: he refers to Thebes' fall in 663 as already past, and predicts Nineveh's fall in 612 as still future), Ezekiel 593–570 (in exile), Daniel 605–530 (in exile), Haggai 520 BC (a ministry of only ~4 months), Zechariah c. 520–518 (temple work concluding 516/515), Malachi c. 450–430.
- **United monarchy:** Saul c. 1047–1010 BC, David c. 1010–970 BC, Solomon c. 970–931 BC — flowing directly into the 931 BC split that opens the Kings chronology above. Worth noting for description text (not for placement): while these dates are the standard framework, some archaeologists dispute how extensive Solomon's kingdom actually was, considering the biblical portrayal of its opulence exaggerated. That's a scope-of-empire debate, not a dating one, so it doesn't affect where he sits on the timeline.
- **Judges: overlapping, not sequential — this is a data-model finding, not just a dating one.** The judges did *not* rule one-after-another in a clean line; multiple judged concurrently in different regions, and the biblical "and the land had rest 40 years" figures don't sum into a single sequential chain. Competing scholarly reconstructions overlap heavily and disagree with each other (one places Othniel→Deborah at 1350–1144, Gideon→Jair at 1191–1096, Jephthah→Abdon at 1118–1070, and Samson at 1118–1078 — note how freely those ranges overlap). **Design implication:** the judges lane cannot be a single row of sequential segments the way the king lanes are. It needs the same multi-row collision-stacking already designed for the events lane, and each judge needs a `date_uncertainty_note`. Individual judges' spans are the single least certain data in this whole phase and must be presented as such.
- **Genuinely disputed, to be footnoted rather than resolved:**
  - *Obadiah and Joel* — neither book is internally dated at all. Proposals span from the 9th century BC all the way to the 2nd century BC. These get the widest uncertainty notes of anything here.
  - *Habakkuk* — sources split between c. 630 BC (before Babylon was a major power) and c. 608–598 BC (as the invasion loomed). Primary placement: the later window, since his central subject is the Chaldean threat; earlier view footnoted.
  - *The Exodus date*, which underlies all Judges-period dating — early date ~1446 BC vs. late date ~1250 BC. There's a manuscript variant behind it: the Masoretic Text reads "480 years" in 1 Kings 6:1 where the Septuagint reads "440." This design builds on the early date (matches most study Bibles, internally consistent with the Kings chronology), with the late date and its reasoning footnoted.

Sources consulted during design (full citation list in chat history): Wikipedia's Kings of Israel and Judah summary (Thiele chronology) and united-monarchy article, multiple prophet-chronology reference charts, Britannica / enduringword / thetorah.com on the fall of Samaria and Babylon, bible.ca and academia.edu chronologies of Judges, biblicaltraining.org and biblestudytools.com on the 7th-century minor prophets, and academic discussion of the 1 Kings 6:1 dating debate.

**Confidence tiering.** Not all of the above is equally solid, and the app should not flatten that. Roughly: (1) *firm* — the divided-kingdom kings and the major events, externally corroborated by Assyrian/Babylonian/Persian records; (2) *good* — the major prophets and the united monarchy; (3) *genuinely uncertain* — the judges, plus Joel, Obadiah, and Habakkuk. Tier 3 items should look visibly less precise in the UI (see Data model), rather than being drawn with the same crisp edges as a date we actually know.

## Data model

### New nullable columns on `people`

```sql
ALTER TABLE people ADD COLUMN timeline_start_bc INTEGER;
ALTER TABLE people ADD COLUMN timeline_end_bc INTEGER;
ALTER TABLE people ADD COLUMN timeline_track TEXT NOT NULL DEFAULT '';
ALTER TABLE people ADD COLUMN date_uncertainty_note TEXT NOT NULL DEFAULT '';
ALTER TABLE people ADD COLUMN date_confidence TEXT NOT NULL DEFAULT 'firm';
```

- `timeline_start_bc` / `timeline_end_bc` — NULL for the ~490 of 518 existing people not placed on this timeline. For a king, this is their **reign** window, not their lifespan. For a prophet, it's their **active ministry** window. Deliberately *not* reusing the existing `birthYear`/`deathYear` free-text display fields (`"c. 1526 BC"`-style strings shown in every detail panel across the app) — those serve a different purpose and aren't numeric/sortable, and a king's birth/death rarely equals their reign start/end anyway.
- `timeline_track` — one of `judah_king`, `israel_king`, `united_king`, `judge`, `major_prophet`, `minor_prophet` (extensible for future NT phases). Determines which lane a person renders in. Note that `judge` and the two prophet tracks are **multi-row lanes** (their members legitimately overlap in time), while the king tracks are single-row (only one king at a time per kingdom). See the judges bullet under Chronology sources.
- `date_uncertainty_note` — free text for the study-Bible-style footnote described above; empty string when there's no real dispute.
- `date_confidence` — `firm` | `good` | `uncertain`, per the confidence tiering above. Drives rendering: `uncertain` items get soft/gradient bar edges and an italic label rather than the crisp edges used for a date we actually know. This is the difference between the app *looking* authoritative and *being* honest — a judge whose dates swing 200 years between reconstructions must not render identically to Hezekiah's reign, which is externally corroborated. Default `firm` so existing/unspecified rows aren't silently downgraded.

Existing rows are untouched — this is purely additive, following the same `MIGRATIONS` array + try/catch pattern `lib/schema.ts` already uses for `idx_relationships_unique`.

### `scripture_refs` gains a nullable `event_id`

```sql
ALTER TABLE scripture_refs ADD COLUMN event_id TEXT;
```

A ref row belongs to either a person (`person_id`, existing) or an event (new `event_id`) — reusing the same table and the same book-tagging the checkbox filter already reads from, rather than forking a parallel `event_refs` table the filter logic would also need to know about.

### New table `historical_events`

```sql
CREATE TABLE IF NOT EXISTS historical_events (
  id                     TEXT PRIMARY KEY,
  title                  TEXT NOT NULL,
  year_bc                INTEGER NOT NULL,
  era                    TEXT NOT NULL DEFAULT '',   -- "Divided Kingdom", "Exile", "Return", etc.
  description            TEXT NOT NULL DEFAULT '',
  date_uncertainty_note  TEXT NOT NULL DEFAULT '',
  created_at             TEXT NOT NULL
)
```

### New table `prophecy_links`

```sql
CREATE TABLE IF NOT EXISTS prophecy_links (
  id                      TEXT PRIMARY KEY,
  prophet_person_id       TEXT NOT NULL,
  prophecy_book           TEXT NOT NULL,
  prophecy_chapter_start  INTEGER NOT NULL,
  prophecy_verse_start    INTEGER NOT NULL,
  prophecy_chapter_end    INTEGER NOT NULL,
  prophecy_verse_end      INTEGER NOT NULL,
  fulfillment_event_id    TEXT NOT NULL,
  explanation             TEXT NOT NULL DEFAULT '',  -- the plain-language banner text
  created_at              TEXT NOT NULL
)
```

Directly powers the click → dashed-line → banner interaction validated in the mockup. One prophet can have multiple links (e.g. Isaiah predicting both the Assyrian retreat and the Babylonian exile); all applicable lines draw simultaneously when that prophet's bar is clicked.

## UI changes

- New **"Timeline"** sidebar nav item in `Explorer.tsx` (alongside People / By Book / Family Tree / Insights), mounting a new `components/Timeline.tsx`.
- Left panel: the grouped, multi-select book checklist. Main area: the stacked lanes, horizontally pannable (reusing the pan/zoom mechanics already built for `FamilyTree`'s `viewReducer` where they translate cleanly to one dimension — exact reuse-vs-rebuild call to be made during implementation).
- Clicking any king/prophet/event opens the same right-side detail panel pattern already used in `FamilyTree.tsx`/`Explorer.tsx` (description, scripture refs) — now also listing any `prophecy_links` involving that item.
- The 931 BC split: the United monarchy lane simply ends at 931 BC and the Judah/Israel lanes begin there, each lane rendering only within its own date range. **Decision:** no literal lane-forking animation — the two king lanes just start empty before 931. Simpler, and the vertical alignment already makes the split legible. A fork flourish is optional later polish, not a requirement.

## Edge cases

- Timeline-ineligible people (everyone without `timeline_start_bc` set) are invisible to this view only — no behavior change anywhere else in the app.
- A person or event with a `date_uncertainty_note` always renders using its primary dating *and* surfaces the note — never silently picks one side without disclosure.
- Reused patterns (book filtering, detail panel, additive-migration schema changes) mean this feature adds zero risk to the existing People / By Book / Family Tree / Insights sections.

## Testing

Manual verification via dev server + browser automation, consistent with this project's existing approach (no automated test suite configured).

## Next steps

1. ~~Data-gathering pass for the Judges/united-monarchy period~~ — **done**, folded into Chronology sources above. Headline finding: the judges overlap rather than running sequentially, which changed the lane model (see `timeline_track`).
2. Full king/prophet/event/prophecy-link dataset for the whole Phase 1 range, built the same way every other book's data was: researched, then a seed/fix script following the existing `scripts/seed-*.ts` / `scripts/fix-*.ts` conventions.
3. Implementation plan (schema migration, `Timeline.tsx`, nav wiring) via `writing-plans`.
