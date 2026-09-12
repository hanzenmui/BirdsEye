# Church History on the Timeline & Family Tree — Design

**Date:** 2026-09-11
**Status:** Draft for review — no code written yet
**Roadmap:** items 2 and 3 in `Vault/Apps/BirdsEye.md`, taken together

## Plain-English summary

Today the timeline stops at John on Patmos (AD 95). This extends it to the present
day, and adds a second kind of node to the family tree: not a person, but a
**tradition** — a church, communion or denomination. Traditions branch the same way
families do, so the Great Schism and the Reformation render with the same machinery
that already draws Adam to Jesus.

Three things make this more than "add more rows":

1. **The span triples.** Genesis to now is ~4,200 years. One flat axis stops being
   readable, so the timeline needs a way to look at one act at a time.
2. **A denomination is not a person.** It needs its own table, but it should reuse
   the family-tree renderer rather than get a second one.
3. **Splits are contested.** Who "left" whom is exactly what the parties disagree
   about. The tree has to be built so it does not take a side.

## The editorial rule this whole feature rests on

**A split branches a shared parent into children. It never hangs one body off the
other.**

This matters more than any technical decision here. Catholics and Orthodox both
claim unbroken continuity with the undivided church; so, in their own terms, do
Anglicans, and the Church of the East predates the quarrel entirely. If the tree
draws Eastern Orthodoxy as a *child of* Roman Catholicism, the app has silently
taken Rome's side, and a third of the world's Christians would call it false.

So at every division, the node that existed before the split ends, and two or more
children begin:

```
                    ┌─ Roman Catholic Church (1054– )
Chalcedonian Church ┤
      (451–1054)    └─ Eastern Orthodox Church (1054– )
```

not

```
Roman Catholic Church ── Eastern Orthodox Church
```

**But the rule only applies where the parties are actually symmetric**, and that is
the distinction to hold onto. It covers Chalcedon (451) and the Great Schism (1054),
where neither side can claim to be the body the other left.

It does **not** cover 1517. Rome carried on through the Reformation as the same
institution — same see, same hierarchy, same identity — and the Reformers said
themselves that they were leaving it. So Lutheran, Reformed, Anglican and Anabaptist
are straight children of the Roman Catholic Church, which continues unbroken
alongside them. Branching Rome at 1517, as though the Catholic Church ended that
year, would be as false as hanging Orthodoxy off Rome at 1054.

Nor does it cover 431: the Church of the East was already a distinct church under
Persian rule that declined to follow an imperial council, while the imperial church
carried on. Straight descent.

So: **branch at 451 and 1054, straight descent everywhere else.** The full shape is
drawn out in section 2 of the findings doc.

## Year representation — already solved

Nothing to change. AD years are stored as the negative of BC (`AD 30` is `-30`), so
AD 2026 is `-2026`, and `formatYear` / `formatYearSpan` in `lib/timeline-layout.ts`
already print it correctly. Every comparison, range and row-packing function keeps
working untouched.

One addition needed: **a living tradition has no end year.** `people.timeline_end_bc`
is an int and every person is dead, but the Roman Catholic Church is not. Traditions
need a nullable end, rendered as "1054–present".

## The Act selector — the one significant UI addition

Genesis (2166 BC) to today (AD 2026) is 4,192 years. The horizontal chart already
carries 13 lanes across 1,500 years; church history adds both ~2,000 more years and
another 5–6 lanes. At full span every segment is a sliver and the lane stack is
taller than any screen.

**Add a three-way scope control next to the existing orientation toggle:**

| Act | Span | Lanes shown |
|---|---|---|
| Old Testament | 2166 – 5 BC | judges, kings, prophets |
| New Testament | 5 BC – AD 100 | Jesus, apostles, Rome, Herod, priests |
| Church History | AD 30 – present | traditions, councils, figures |
| Everything | full | all (the current behaviour) |

This is not a new feature so much as a viewport preset: it sets the axis range, hides
lanes that are empty for that act, and picks a sensible default zoom. "Everything"
keeps the continuous creation-to-today view the roadmap asks for, for when you want
to see the whole shape at once.

It also cleanly answers a problem church history creates for the book filter (below),
and it gives the vertical view a way to not be 40 chapters long.

Deliberately overlapping at the seams: the New Testament act runs to AD 100 and
Church History starts at AD 30, because Acts is genuinely both.

### Consequences for the existing zoom

`ZOOM_MAX` is 6, tuned for a 1,500-year span. At 4,200 years, readable segments need
roughly 20–40×. Raise the ceiling and make the default zoom a function of the active
act's span rather than a constant.

## Data model

### Reuse without change

- **`historical_events`** — councils, schisms, edicts, revivals. Already has
  `year_bc`, `era`, `date_confidence`, `date_uncertainty_note`. No migration needed.
  The `era` chip carries the church-history period name.
- **`people`** — Augustine, Luther, Wesley are people. They belong in `people` with
  new `timeline_track` values. `timeline_track` is free text with no CHECK
  constraint, so no migration; only `scripts/verify-timeline.ts`'s recognised-track
  list needs extending.

  **One real snag here.** `people.testament` is `'OT' | 'NT' | 'both'`, NOT NULL,
  defaulting to `'OT'`. Augustine is none of those. Seeding him as `'OT'` would be
  nonsense and would corrupt the People browser's counts, which currently read
  `OT 352 / NT 157`. A fourth value — `'CH'`, labelled "Church history" — needs
  adding to `TESTAMENTS` in `lib/types.ts`, to the filter chips in `Explorer.tsx`,
  and to any place that assumes three. This is small but it is a prerequisite, not
  an afterthought: get it wrong and the 66-book work just audited starts reporting
  wrong totals.
- **`prophecy_links`** — untouched. Church history makes no prophetic claims here.

### New: `traditions`

```sql
CREATE TABLE IF NOT EXISTS traditions (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  also_known_as         TEXT NOT NULL DEFAULT '',
  kind                  TEXT NOT NULL DEFAULT 'denomination',
  tier                  INTEGER NOT NULL DEFAULT 3,
  start_year            INTEGER NOT NULL,          -- negative = AD, same convention
  end_year              INTEGER,                   -- NULL = still exists
  region                TEXT NOT NULL DEFAULT '',
  description           TEXT NOT NULL DEFAULT '',
  distinctives          TEXT NOT NULL DEFAULT '',  -- what actually marks it out
  adherents             TEXT NOT NULL DEFAULT '',  -- display string, e.g. "~1.4 billion"
  date_uncertainty_note TEXT NOT NULL DEFAULT '',
  date_confidence       TEXT NOT NULL DEFAULT 'firm',
  created_at            TEXT NOT NULL
);
```

- `kind`: `communion` | `tradition` | `denomination` | `movement`. A *movement*
  (Holiness, Pentecostalism, Evangelicalism) cuts across denominations rather than
  being one — worth distinguishing so the tree can style it differently, because
  drawing Evangelicalism as a denomination would be wrong.
- `tier`: 1 = the great communions, 2 = traditions/families, 3 = individual
  denominations. Lets the tree collapse by depth, which is how ~50 nodes stay
  readable. Start with tiers 1–2 visible and tier 3 on demand.
- `distinctives` is the field that makes this useful to you rather than trivia —
  the roadmap asks "what's distinct about each", and that is a first-class column,
  not something buried in prose.

### New: `tradition_edges`

```sql
CREATE TABLE IF NOT EXISTS tradition_edges (
  id           TEXT PRIMARY KEY,
  parent_id    TEXT NOT NULL,
  child_id     TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT 'split_from',
  year         INTEGER NOT NULL,
  event_id     TEXT,                  -- the council/schism that caused it
  notes        TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL
);
```

Edge types, split into two classes exactly as the family tree already treats
`parent_of` versus everything else:

**Structural** — these build the tree:
- `split_from` — the ordinary case.
- `merged_into` — convergent. Several parents, one child (United Methodist Church,
  1968). The tree already handles two-parent convergence: that is how Shealtiel and
  Joseph work in the Jesus genealogy.

**Decorative** — coloured overlay lines, not tree structure:
- `influenced_by` — Moravians on Wesley; the Radical Reformation on later Baptists.
  Real and worth drawing, but not descent.
- `renewal_within` — a movement that stayed inside its parent (Franciscans,
  charismatic renewal in the Catholic Church). Drawn as a loop back to the parent
  rather than a branch away from it.

`event_id` is the nice part: the Great Schism *event* and the two edges it produced
are the same fact seen from two directions, so clicking the event can list the
communions it created, and clicking the edge can open the council that caused it.

### New: `tradition_people`

```sql
CREATE TABLE IF NOT EXISTS tradition_people (
  id            TEXT PRIMARY KEY,
  tradition_id  TEXT NOT NULL,
  person_id     TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'key_figure',
  notes         TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL
);
```

`role`: `founder` | `key_figure` | `opponent` | `reformer`. This is what connects the
two halves of the feature — a tradition node can list its founders, and Luther's own
profile can say "Lutheranism (founder)".

## Family tree: widen the renderer, do not fork it

`components/FamilyTree.tsx` is 1,327 lines of layout, zoom/pan, lineage highlighting,
the side name list and the mobile touch handling. None of that should be written
twice.

The tree's core functions — `computeParentMap`, `buildForest`, `buildLayout`,
`findForwardPath` — take `Person[]` and `Relationship[]` but only ever read a handful
of fields: `id`, `name`, `gender` (for the male-preferred parent choice) and
`alsoKnownAs`. So:

**Widen the parameter types to a minimal structural interface. `Person` and
`Relationship` already satisfy it, so no call site changes at all.**

```ts
export interface TreeNode { id: string; name: string; gender?: string; alsoKnownAs?: string }
export interface TreeEdge { personAId: string; type: string; personBId: string }
```

Then design `Tradition` and `TraditionEdge` to conform — map `parent_id`/`child_id`
onto `personAId`/`personBId` with `type: "parent_of"` for the structural edges in the
adapter — and the same renderer draws both. TypeScript's structural typing does the
work; this is a signature change, not a rewrite.

The tree picker (`lib/families.ts` / `TreeCategoryPicker`) gains a new category group
alongside "Families" and "Books": **Traditions**, with entries like "The Great
Schism", "The Reformation", "Protestant families", "Everything from Acts".

### What the male-preferred parent rule becomes

`computeParentMap` prefers a male parent when a node has two, which is right for a
patrilineal genealogy and meaningless for denominations. For traditions the
equivalent tiebreak is **the earlier parent**, or the one whose edge is marked
primary. Add an optional comparator so the caller decides, defaulting to current
behaviour.

## Book filter and church history

Church-history people and traditions have no `scripture_refs`, so under the current
rule (`!allBooksChecked && !books.some(checked)` → hidden) they vanish the moment you
touch a book checkbox. Books are a Bible-only axis and should not silently filter out
the second millennium.

**Fix: the book filter applies only within the Bible acts.** In the Church History
act, hide the filter entirely. In "Everything", exempt rows whose track is a
church-history track rather than excluding them. This is cleaner than inventing fake
scripture references.

## New timeline tracks

Following the existing naming, with the same rulers-versus-messengers split the
vertical view already uses for its two columns:

| Track | Lane | Side | Who |
|---|---|---|---|
| `tradition` | Traditions | — | the communions and denominations themselves (spans) |
| `church_father` | Church fathers | messengers | Ignatius, Athanasius, Augustine, the Cappadocians |
| `theologian` | Theologians | messengers | Aquinas, Anselm, Edwards, Barth |
| `reformer` | Reformers | messengers | Luther, Calvin, Zwingli, Tyndale, Wesley |
| `missionary` | Missionaries | messengers | Patrick, Boniface, Carey, Judson, Taylor, Liddell |
| `church_ruler` | Popes & patriarchs | rulers | Leo I, Gregory I, Photius, and the emperors who called councils |

The `tradition` track is the odd one out: its rows are traditions, not people, so in
the vertical view they are better rendered as a distinct band (like the existing book
bands) than as person cards. In the horizontal view they are simply lanes of spans,
which is exactly what that view is already good at.

## Honesty requirements specific to this era

The `date_confidence` / `date_uncertainty_note` machinery carries these; they are
listed because getting them wrong is what would make the feature embarrassing.

- **1054 was not a clean break.** The mutual excommunications of that July were
  between two legates and a patriarch, not two churches, and both sides said in 1965
  that they were never meant to cause a schism. Many historians treat the 1204 sack
  of Constantinople as the real rupture. Mark 1054 `good`, not `firm`, and say this.
- **"Nestorian" is a label the Church of the East rejects**, and its separation was
  gradual: administrative independence in 424, Ephesus in 431, doctrinal divergence
  later still. Use the church's own name and date the split `uncertain`.
- **Oriental Orthodox are not "monophysite"** in the sense Chalcedon condemned; they
  call themselves miaphysite and modern dialogues have largely agreed the quarrel was
  substantially verbal. Say so.
- **Protestant founding dates are mostly conventional.** 1517 is when Luther objected
  to indulgences, not when a Lutheran church existed; Lutheranism as a distinct body
  is better dated to the Augsburg Confession (1530) or the Peace of Augsburg (1555).
  Give the conventional date and footnote the real one.
- **Denominational self-description beats outside summary** in the `distinctives`
  field. Describe what a body says it is for, not what its critics say it is against.

## Open question for you

**Which Church of God is Oakland Church of God?** The two main American bodies with
that name are unrelated: Anderson, Indiana (1881, D. S. Warner, Holiness, *not*
Pentecostal) and Cleveland, Tennessee (1886, the oldest American Pentecostal
denomination). There are also several smaller ones. Knowing which lets the tree end
on *your* branch, which is the most useful thing this feature could do for you —
being able to trace your own church back to Acts. I have left the leaf unnamed until
you say.

The `DOC` class names in your ministry notes did not settle it — that reads like a
local program name rather than a denominational marker.

## Scope recommendation

~50 tradition nodes, not 200+:

- **Tier 1 (8):** Church of the East, Oriental Orthodox, Eastern Orthodox, Roman
  Catholic, Lutheran, Reformed, Anglican, Anabaptist.
- **Tier 2 (~18):** Coptic/Armenian/Ethiopian/Syriac separately; Presbyterian,
  Congregational, Baptist, Methodist, Holiness, Pentecostal, Restoration,
  Adventist, Quaker, Moravian, Evangelicalism, Non-denominational.
- **Tier 3 (~25):** the specific bodies worth naming, including both Churches of God,
  Assemblies of God, Southern Baptist, United Methodist, PCUSA/PCA, LCMS/ELCA,
  Episcopal, Vineyard, Calvary Chapel.

That is enough to find nearly any church someone actually attends without turning the
tree into a bush.
