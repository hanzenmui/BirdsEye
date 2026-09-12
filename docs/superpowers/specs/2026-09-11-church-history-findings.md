# Church History — Researched Dataset

**Date:** 2026-09-11
**Purpose:** the verified content behind `2026-09-11-church-history-design.md`, laid
out so implementation is transcription rather than research.

## Verification status

Externally checked by web search in this pass: the Ephesus 431 / Chalcedon 451
separations, the 1054 excommunications and their 1965 lifting, the 1204 sack of
Constantinople as the effective rupture, the first Anabaptist baptism
(21 Jan 1525, Zollikon near Zürich), Baptist origins (Smyth, Amsterdam 1608/09;
Helwys, England 1611/12), Wesley's Aldersgate (24 May 1738), the Methodist Christmas
Conference (Dec 1784), Azusa Street (1906) and its Holiness roots, and the distinct,
unrelated origins of the two main Churches of God (Anderson 1881, Holiness,
not Pentecostal; Cleveland 1886, oldest American Pentecostal body).

Everything else below is standard reference chronology. Dates carrying real dispute
are marked and carry the note that belongs in `date_uncertainty_note`. Nothing here
should be seeded as `firm` unless this document says so.

Years are written as ordinary AD. **In the database they are negated** (AD 1054 is
`-1054`), per the existing convention.

---

## 1. Periods

Continuing from the existing final period, `apostolic-end` (AD 63–100). All
non-overlapping and contiguous, so nothing appears twice.

| id | Label | Span | `startBc` | `endBc` |
|---|---|---|---|---|
| `persecuted-church` | The Persecuted Church | AD 101–312 | -101 | -312 |
| `imperial-church` | The Church and the Empire | AD 313–450 | -313 | -450 |
| `councils-and-mission` | Councils, Islam & the Mission to Europe | AD 451–1053 | -451 | -1053 |
| `christendom` | Christendom Divided | AD 1054–1516 | -1054 | -1516 |
| `reformation` | The Reformation | AD 1517–1648 | -1517 | -1648 |
| `awakenings` | Pietism & the Awakenings | AD 1649–1799 | -1649 | -1799 |
| `missions` | Missions & Revivals | AD 1800–1899 | -1800 | -1899 |
| `global-church` | The Global Church | AD 1900–present | -1900 | -2030 |

Summaries to write at implementation time; one sentence each, matching the tone of
the existing periods.

`global-church` ends at -2030 rather than the current year so nothing falls off the
end as time passes. Revisit in 2030.

**Verified 2026-09-11** by a throwaway script against the 11 existing periods: all 19
are contiguous, none overlap, every one satisfies `startBc > endBc`, and each probe
year resolves to exactly one period (AD 431 → `imperial-church`, 451 →
`councils-and-mission`, 1054 → `christendom`, 1517 → `reformation`, 1906 and 2026 →
`global-church`).

**One consequence to expect.** People are placed by their *start* year, so the first
generation of church fathers lands in the New Testament chapters, not the church-history
ones: Ignatius (b. c. 35) resolves to `early-church`, and Polycarp (b. c. 69) and
Justin Martyr (b. c. 100) to `apostolic-end`. This is historically right rather than a
bug — Ignatius and Polycarp really were contemporaries of the apostles, and Polycarp is
traditionally John's disciple — but it means the "Persecuted Church" chapter opens with
people born after 101 and the reader meets the earliest fathers a chapter early. If that
reads oddly, the fix is to give the fathers *active ministry* spans instead of lifespans,
which is what the timeline already does for the prophets.

---

## 2. The trunk — how the four great divisions are shaped

**REVISED 2026-09-11 per Hanzen — every major split branches, none straight-descends.**
An earlier version of this document had 431 and 1517 as "straight descent" (one side
treated as the unbroken continuation). Hanzen's explicit instruction rejects that for
*any* split, not only Chalcedon and the Great Schism: *"when the splits happen, don't
keep one church as the true main church... we're not gonna say which one's the
original church in this app."* Corrected trunk:

```
Apostolic Church (30–100)
        │
Early Church (100–431)
        │
   [431 · Council of Ephesus]                          ← BRANCH
        ├──→ Church of the East (431– )
        └──→ The Imperial Church (431–451)
                    │
             [451 · Council of Chalcedon]               ← BRANCH
                    ├──→ Oriental Orthodox (451– )
                    └──→ Chalcedonian Church (451–1054)
                                │
                         [1054 · The Great Schism]       ← BRANCH
                                ├──→ Eastern Orthodox Church (1054– )
                                └──→ Western Church (1054–1517)
                                            │
                                     [1517 · The Reformation] ← BRANCH
                                            ├──→ Roman Catholic Church (1517– )
                                            ├──→ Lutheran (1517– )
                                            ├──→ Reformed (1517– )
                                            ├──→ Anglican (1517– )
                                            └──→ Anabaptist (1517– )
```

Every one of the four councils/events above (431, 451, 1054, 1517) is a `split_from`
edge set where **all children start at the same year and none is the pre-split node
under a new coat of paint.** "Western Church (1054–1517)" and "The Imperial Church
(431–451)" are deliberately neutral, purpose-built node names — not "Roman Catholic
Church" or "Eastern Orthodox Church" pre-dating their actual 1517/451 starting points
— precisely so that neither the Catholic nor the Orthodox nor any Reformation body can
be read as "the one that was already there." **Roman Catholic Church as a named node
starts in 1517, exactly like Lutheran, Reformed, Anglican and Anabaptist do**, holding
the app's line evenly across every branch of the tree, not only the branch someone
happened to ask about.

Note that the 1517 split is downstream of the Western branch of 1054 only — Eastern
Orthodoxy is untouched by the Reformation and simply continues as its own node with
no further branching required in this trunk.

**Oriental Orthodox's five members are a special case worth noting honestly.** Coptic,
Armenian, Ethiopian, Syriac and Malankara were never one single administrative church
that later fragmented into five — they were separate national churches from early on
that share a common Christology and later recognised each other as being in
communion. Modelling them as five `split_from` children of "Oriental Orthodox" dated
to 451 is a simplification for the tree's sake, not a historical claim that one
"Oriental Orthodox Church" existed first and then split five ways; the
`tradition_edges.notes` field for each of these five edges should say so plainly.

---

## 3. Events

Confidence column: F = firm, G = good, U = uncertain.

### The Persecuted Church (101–312)

| Year | Event | C | Note |
|---|---|---|---|
| 107 | Ignatius of Antioch martyred at Rome | U | Dated anywhere from 107 to 140 |
| 155 | Polycarp burned at Smyrna | U | 155, 156 or 167 |
| 165 | Justin Martyr beheaded at Rome | G | c. 165 |
| 180 | Irenaeus writes *Against Heresies* | G | The first sustained case for the canon and apostolic succession |
| 250 | The Decian persecution | F | Empire-wide; forced the question of what to do with those who lapsed |
| 303 | Diocletian's Great Persecution begins | F | The last and worst |
| 312 | Constantine wins at the Milvian Bridge | F | 28 Oct |

### The Church and the Empire (313–450)

| Year | Event | C | Note |
|---|---|---|---|
| 313 | The Edict of Milan | F | Toleration, not establishment |
| 325 | First Council of Nicaea | F | Against Arius; the Son "of one substance with the Father" |
| 367 | Athanasius lists the 27 New Testament books | F | His 39th Festal Letter — the earliest surviving list matching the NT exactly |
| 380 | Christianity made the empire's religion | F | Edict of Thessalonica |
| 381 | First Council of Constantinople | F | Completed the Nicene Creed as it is still recited |
| 397 | Council of Carthage confirms the canon | G | Following Hippo, 393 |
| 405 | Jerome finishes the Latin Vulgate | G | The West's Bible for 1,000 years |
| 410 | Rome sacked by Alaric | F | Prompted Augustine's *City of God* |
| 431 | Council of Ephesus | F | → the Church of the East separates |
| 451 | Council of Chalcedon | F | → the Oriental Orthodox separate |

### Councils, Islam & the Mission to Europe (451–1053)

| Year | Event | C | Note |
|---|---|---|---|
| 476 | The last western emperor deposed | G | A conventional marker, not a clean end |
| 529 | Benedict founds Monte Cassino | G | His Rule shaped western monasticism |
| 563 | Columba founds Iona | F | Base for the mission to Scotland |
| 597 | Augustine of Canterbury lands in Kent | F | Gregory the Great's mission to the English |
| 622 | The Hijra | F | Within a century Islam rules the heartlands of eastern Christianity |
| 726 | The iconoclast controversy begins | G | Ran, on and off, to 843 |
| 787 | Second Council of Nicaea | F | The last council East and West both accept |
| 800 | Charlemagne crowned emperor | F | 25 Dec — a Latin empire, and a fresh grievance for Constantinople |
| 863 | Cyril and Methodius sent to the Slavs | F | Gave Slavonic a written alphabet and liturgy |
| 988 | The baptism of Rus' | G | Vladimir's Kyiv turns east, not west |

### Christendom Divided (1054–1516)

| Year | Event | C | Note |
|---|---|---|---|
| 1054 | The Great Schism | **G** | **Not firm.** Two legates and a patriarch excommunicated each other in July; both sides said in 1965 that this was never meant to divide the churches. Many historians date the real rupture to 1204 |
| 1095 | The First Crusade called at Clermont | F | |
| 1204 | Crusaders sack Constantinople | F | Where reconciliation actually became impossible |
| 1215 | Fourth Lateran Council | F | Annual confession; transubstantiation defined |
| 1274 | Thomas Aquinas dies | F | Leaving the *Summa* unfinished |
| 1378 | The Western Schism begins | F | Rival popes until 1417; at one point three |
| 1382 | Wycliffe's English Bible | G | Condemned; he is dug up and burned in 1428 |
| 1415 | Jan Hus burned at Constance | F | 6 Jul, under a safe conduct → the Hussites |
| 1453 | Constantinople falls to the Ottomans | F | 29 May |
| 1456 | The Gutenberg Bible | G | The press is what makes 1517 spread |

### The Reformation (1517–1648)

| Year | Event | C | Note |
|---|---|---|---|
| 1517 | Luther's Ninety-five Theses | F | 31 Oct — against indulgences, not a founding document |
| 1521 | The Diet of Worms | F | "Here I stand"; Luther outlawed |
| 1525 | The first Anabaptist baptism | F | 21 Jan, Zollikon near Zürich — Grebel, Blaurock, Manz |
| 1530 | The Augsburg Confession | F | Where Lutheranism becomes a confessional body |
| 1534 | The Act of Supremacy | F | Henry VIII head of the Church in England |
| 1536 | Calvin's *Institutes*; Calvin reaches Geneva | F | |
| 1545 | The Council of Trent opens | F | Ran to 1563; defined Catholicism against the Reformation |
| 1555 | The Peace of Augsburg | F | *cuius regio, eius religio* |
| 1563 | The Thirty-nine Articles | F | Anglicanism's doctrinal settlement |
| 1609 | The first Baptist congregation | G | Smyth, Amsterdam, 1608/09; Helwys brings it to England 1611/12 |
| 1611 | The King James Bible | F | |
| 1619 | The Synod of Dort | F | Defined Reformed orthodoxy against Arminius |
| 1646 | The Westminster Confession | F | Still the Presbyterian standard |
| 1648 | The Peace of Westphalia | F | Ends the wars of religion |

### Pietism & the Awakenings (1649–1799)

| Year | Event | C | Note |
|---|---|---|---|
| 1675 | Spener's *Pia Desideria* | F | Pietism — heart religion over confessional correctness |
| 1727 | The Moravian renewal at Herrnhut | F | 13 Aug; a 100-year prayer meeting and the first Protestant mission wave |
| 1738 | Wesley's heart "strangely warmed" | F | 24 May, Aldersgate Street, at a Moravian meeting, hearing Luther's preface to Romans read |
| 1741 | Edwards preaches "Sinners in the Hands of an Angry God" | F | 8 Jul — the Great Awakening at its height |
| 1784 | The Christmas Conference, Baltimore | F | Dec — the Methodist Episcopal Church organised |
| 1792 | Carey and the Baptist Missionary Society | F | The start of the modern missionary movement |

### Missions & Revivals (1800–1899)

| Year | Event | C | Note |
|---|---|---|---|
| 1801 | The Cane Ridge revival | F | Kentucky; the Second Great Awakening and the seed of the Restoration Movement |
| 1807 | Robert Morrison reaches China | F | |
| 1816 | The African Methodist Episcopal Church organised | F | Richard Allen — the first Black denomination in America |
| 1832 | Stone's and Campbell's movements merge | F | → the Restoration Movement |
| 1844 | The Great Disappointment | F | 22 Oct → Adventism |
| 1863 | The Seventh-day Adventist Church organised | F | |
| 1865 | The Salvation Army founded | F | William and Catherine Booth, East London |
| 1867 | The National Camp Meeting Association | F | The Holiness movement organises |
| 1870 | First Vatican Council defines papal infallibility | F | 1869–70 |
| 1881 | Church of God (Anderson, Indiana) | F | D. S. Warner leaves the General Eldership, holding that denominations are themselves divisive |
| 1886 | Church of God (Cleveland, Tennessee) | F | Founded as the Christian Union; becomes Pentecostal after 1906 and is the oldest American Pentecostal body |

### The Global Church (1900–present)

| Year | Event | C | Note |
|---|---|---|---|
| 1901 | Topeka, Kansas | G | Parham's students speak in tongues; the doctrine forms |
| 1906 | The Azusa Street revival | F | William J. Seymour, Los Angeles — Pentecostalism goes worldwide from a former AME building |
| 1910 | The Edinburgh Missionary Conference | F | The start of the modern ecumenical movement |
| 1914 | The Assemblies of God founded | F | Hot Springs, Arkansas |
| 1934 | The Barmen Declaration | F | The Confessing Church against Nazi control of the German church |
| 1948 | The World Council of Churches formed | F | Amsterdam |
| 1949 | Billy Graham's Los Angeles crusade | F | |
| 1962 | The Second Vatican Council opens | F | Ran to 1965; vernacular liturgy, and a new posture toward other Christians |
| 1965 | The anathemas of 1054 lifted | F | 7 Dec, Paul VI and Athenagoras I together. It did not end the schism; the doctrinal differences remain |
| 1967 | Catholic charismatic renewal begins | G | Duquesne University |
| 1974 | The Lausanne Congress | F | Global evangelicalism finds a common voice |
| 1980 | Most Christians now live in the Global South | U | A crossover estimated to fall somewhere in the 1970s–80s; the trend is certain, the year is not |

---

## 4. Traditions

`kind`: C = communion, T = tradition, D = denomination, M = movement.
"–" in End means still existing (`end_year` NULL).

### Trunk

`Western Church` and `The Imperial Church` are neutral placeholder names for the
pre-split node at 1054 and 431 respectively — not "Roman Catholic Church" or
"Eastern Orthodox Church" wearing an earlier costume. See the branching note above.

| Name | Kind | Tier | Start | End | Distinctive |
|---|---|---|---|---|---|
| The Apostolic Church | C | 1 | 30 | 100 | The church of the apostles themselves; no divisions yet to name |
| The Early Church | C | 1 | 100 | 431 | Bishops, canon and creed take shape under persecution, then under an emperor |
| Church of the East | C | 1 | 431 | – | Ancient church of Persia and the Silk Road; reached China by 635. Rejects the label "Nestorian" |
| The Imperial Church | C | 1 | 431 | 451 | The church of the Roman Empire after Persia's church went its own way, still one body East and West |
| Oriental Orthodox | C | 1 | 451 | – | Miaphysite: Christ's divinity and humanity united in one nature without confusion — not the "monophysitism" Chalcedon condemned |
| The Chalcedonian Church | C | 1 | 451 | 1054 | The imperial church East and West, holding Christ in two natures |
| Eastern Orthodox Church | C | 1 | 1054 | – | Conciliar, not papal; the seven councils; theology as worship. ~220 million |
| Western Church | C | 1 | 1054 | 1517 | Latin-rite Christendom under Rome, before the Reformation divided it further |
| Roman Catholic Church | C | 1 | 1517 | – | Universal jurisdiction of the bishop of Rome; seven sacraments; scripture and tradition together. ~1.4 billion |

**Per-child edge years, not one uniform 1517.** The Reformation was not a single
event the way Chalcedon or the Schism were — Lutheran, Anglican, Reformed and
Anabaptist each crystallised at a different moment. Rather than force every
`tradition_edges` row for this split to `year: 1517`, give each its own accurate
year and its own `event_id`, all with `parent_id` = Western Church:

| Child | Edge year | `event_id` → |
|---|---|---|
| Roman Catholic Church | 1517 | Luther's Ninety-five Theses (the conventional marker; Trent, 1545, is the more precise "Catholicism defines itself against the Reformation" moment if a second is wanted) |
| Lutheran | 1530 | The Augsburg Confession |
| Anglican | 1534 | The Act of Supremacy |
| Anabaptist | 1525 | The first Anabaptist baptism |
| Reformed | 1536 | Calvin reaches Geneva / *Institutes* |

All five still render as one visual split in the tree (same parent, contiguous
years), but the dates themselves are each defensible on their own rather than
flattened to a single round number.

### Oriental Orthodox members (tier 2)

Coptic Orthodox (451–), Armenian Apostolic (301 as a national church, Oriental
Orthodox from 451), Ethiopian Orthodox Tewahedo (4th c.–), Syriac Orthodox (451–),
Malankara (India, tradition traced to Thomas).

### Reformation tier 1

| Name | Kind | Start | End | Distinctive |
|---|---|---|---|---|
| Lutheran | T | 1517 | – | Justification by faith alone; scripture alone; Christ truly present in the Supper. Conventionally dated 1517, but a distinct body only from Augsburg 1530 |
| Reformed | T | 1536 | – | God's sovereignty in salvation; covenant; scripture regulating worship as well as doctrine |
| Anglican | T | 1534 | – | Catholic order with Reformed doctrine; the Book of Common Prayer as the carrier of both |
| Anabaptist | T | 1525 | – | Believer's baptism; church separate from state; discipleship and often nonviolence. Persecuted by Catholics and Protestants alike |

### Descending from those (tiers 2–3)

- **From Reformed:** Presbyterian (1560, Knox, Scotland) → PCUSA (1983 merger),
  PCA (1973); Congregational (1582) → UCC (1957); Dutch Reformed / CRC.
- **From Anglican:** Episcopal Church USA (1789); **Methodist** (1784) →
  United Methodist (1968 merger with the Evangelical United Brethren),
  AME (1816), Free Methodist (1860).
- **From Anabaptist:** Mennonite (1536, Menno Simons), Hutterite (1528),
  Amish (1693, Jakob Ammann).
- **From English Separatism, with Anabaptist influence:** Baptist (1609) →
  Southern Baptist (1845), American Baptist, Baptist Union of Great Britain.
- **From Methodist/Wesleyan:** **Holiness movement** (M, 1867) → Church of the
  Nazarene (1908), Salvation Army (1865), Wesleyan Church,
  **Church of God (Anderson, Indiana)** (1881).
- **From Holiness:** **Pentecostalism** (M, 1901/1906) → Assemblies of God (1914),
  **Church of God (Cleveland, Tennessee)** (1886, Pentecostal from 1906),
  Church of God in Christ (1897, Pentecostal from 1907), Foursquare (1923).
- **From Pentecostalism:** Charismatic renewal (M, 1960) — *renewal_within* edges
  back into Anglican, Catholic and others rather than a branch away;
  Vineyard (1982), Calvary Chapel (1965).
- **Pre-Reformation dissent:** Waldensian (1173 — joined the Reformed at the
  Reformation, a nice early example of a `merged_into` edge), Hussite /
  Bohemian Brethren (1415) → Moravian (1457, renewed 1727).
- **Other:** Quaker (1652, George Fox), Restoration Movement (1832) →
  Churches of Christ (1906), Disciples of Christ (1968); Adventist (1863);
  Evangelicalism (M, 1730s–, cross-cutting).

### Non-denominational — the default landing spot, not an afterthought

Per Hanzen: any real church that does not cleanly map onto a named historic body
belongs here, and this should be treated as a first-class tier-2 tradition, not a
footnote.

| Name | Kind | Tier | Start | End | Distinctive |
|---|---|---|---|---|---|
| Non-denominational | M | 2 | 1970 | – | No denominational affiliation or hierarchy above the local congregation; often "community church" or "Bible church" in name. By congregation count, the largest single category of American Protestant churches today |

`start_year: 1970` marks the rise of the "seeker-sensitive" and community-church
movement (Calvary Chapel from 1965, Willow Creek 1975, Saddleback 1980) as the point
non-denominational congregations became a recognisable category rather than
scattered independents. No `split_from` edge into the main tree — its roots are
genuinely diffuse across Evangelicalism, the Restoration Movement's "no creed but
Christ" instinct, and post-Pentecostal independency all at once, so a single parent
edge would misrepresent it. An optional `influenced_by` edge to Evangelicalism is
reasonable; nothing structural.

---

## Cult category (off the descent tree entirely)

Per Hanzen's explicit instruction: these get `kind: 'cult'`, tier 2, and **no
`tradition_edges` row into the historic tree** — not `split_from`, not
`influenced_by`. They surface only in their own dedicated tree-picker category, never
nested under Restoration Movement or any other Christian lineage they might
superficially resemble.

| Name | Kind | Tier | Start | End | Distinctive |
|---|---|---|---|---|---|
| The Church of Jesus Christ of Latter-day Saints (Mormonism) | Cult | 2 | 1830 | – | Founded by Joseph Smith at Fayette, New York, 6 Apr 1830, on the claim of new scripture (the Book of Mormon) and continuing revelation through living prophets. Rejects the Trinity as historic Christianity defines it |
| Jehovah's Witnesses | Cult | 2 | 1931 | – | Grew from Charles Taze Russell's Bible Student movement (Zion's Watch Tower, 1879/1881); took the name "Jehovah's Witnesses" in July 1931 under J. F. Rutherford. Rejects the Trinity, the soul's conscious survival of death, and Christ's bodily resurrection |
| Christian Science | Cult | 2 | 1879 | – | Founded by Mary Baker Eddy, who chartered the Church of Christ, Scientist in Boston in 1879 after publishing *Science and Health* (1875). Teaches that sickness and matter itself are ultimately illusory, and that healing comes through correct understanding rather than medicine |

All three are 19th/20th-century American in origin, and all three are regarded by
the Catholic, Orthodox and Protestant traditions alike as outside historic Christian
orthodoxy — chiefly for denying the Trinity and/or the nature of Christ as defined at
Nicaea and Chalcedon, which is the same doctrinal line this dataset uses to decide
who counts as a branch of the historic tree at all. That is the actual reason for the
separate category: not a value judgement beyond what the historic creeds themselves
already draw as the line.

### Edges worth getting right

- **Methodism has two parents in effect:** Anglican by descent, Moravian by
  influence. Draw Anglican as `split_from` and Moravian as `influenced_by` — this is
  the clearest illustration in the whole dataset of why the two edge classes exist.
- **Church of God (Cleveland)** is `split_from` Holiness (1886) and
  `influenced_by` Pentecostalism (1906). It predates Azusa Street and became
  Pentecostal afterwards, so a single descent edge would misdate it.
- **The two Churches of God are not related.** Anderson is Holiness and explicitly
  anti-denominational; Cleveland is Pentecostal. No edge between them.
- **Waldensians merging into the Reformed** in the 1530s exercises `merged_into`
  before the Reformation-era merges do.

---

## 5. People

For `people`, with the new tracks from the design doc. All dates AD; c. = `good` or
`uncertain` confidence with a note. Ranges are lifespans except where a ministry span
reads better (missionaries, reformers), matching how the timeline already treats
prophets.

**Church fathers:** Ignatius (c. 35–107), Polycarp (c. 69–155), Justin Martyr
(c. 100–165), Irenaeus (c. 130–202), Tertullian (c. 155–220), Origen (c. 185–253),
Athanasius (c. 296–373), Basil the Great (c. 330–379), Gregory of Nazianzus
(c. 329–390), Ambrose (c. 339–397), John Chrysostom (c. 347–407), Jerome
(c. 347–420), **Augustine of Hippo (354–430, firm)**, Leo I (c. 400–461).

**Missionaries & monastics:** Patrick (c. 385–461), Benedict (c. 480–547), Columba
(521–597), Gregory the Great (c. 540–604), Augustine of Canterbury (d. 604),
Boniface (c. 675–754), Cyril (c. 827–869) and Methodius (c. 815–885).

**Medieval theologians:** Anselm (1033–1109), Bernard of Clairvaux (1090–1153),
Francis of Assisi (1181–1226), Thomas Aquinas (1225–1274).

**Pre-Reformation:** John Wycliffe (c. 1328–1384), Jan Hus (c. 1369–1415).

**Reformers:** **Martin Luther (1483–1546)**, Huldrych Zwingli (1484–1531), Thomas
Cranmer (1489–1556), Ignatius of Loyola (1491–1556), William Tyndale (c. 1494–1536),
Menno Simons (c. 1496–1561), **John Calvin (1509–1564)**, John Knox (c. 1514–1572),
Teresa of Ávila (1515–1582).

**Awakenings:** George Fox (1624–1691), John Bunyan (1628–1688), Jonathan Edwards
(1703–1758), **John Wesley (1703–1791)**, Charles Wesley (1707–1788), George
Whitefield (1714–1770).

**Missions century:** William Carey (1761–1834), Charles Finney (1792–1875), William
Booth (1829–1912), Hudson Taylor (1832–1905), Charles Spurgeon (1834–1892), D. L.
Moody (1837–1899), D. S. Warner (1842–1895).

**Modern:** William J. Seymour (1870–1922), Karl Barth (1886–1968), C. S. Lewis
(1898–1963), Dietrich Bonhoeffer (1906–1945), Mother Teresa (1910–1997), Billy
Graham (1918–2018), Martin Luther King Jr. (1929–1968).

~55 people. Every one of them also wants a `tradition_people` row.

---

## 6. Things to be careful about

1. **"Nestorian" and "monophysite" are both contested labels** applied by opponents.
   Use each church's own name and note the dispute. The modern Catholic–Oriental
   Orthodox dialogues largely concluded the Chalcedon quarrel was verbal rather than
   substantive; that belongs in the note.
2. **1054 is a convention, not an event.** Already flagged above; it is the single
   most likely thing to draw an informed objection.
3. **Protestant founding years are mostly symbolic.** Give the conventional year and
   footnote the institutional one (1517 vs 1530; 1534 vs 1559; 1525 vs the Schleitheim
   Confession of 1527).
4. **Adherent counts go stale.** Store them as display strings with the year they
   refer to, or leave the field empty rather than let the app quietly age.
5. **Describe traditions as they describe themselves.** `distinctives` should say what
   a body is for, not what its opponents say it is against. This is the field most
   likely to be read, and the easiest to get subtly wrong.
6. ~~Do not place the Latter-day Saints, Jehovah's Witnesses or Christian Science on
   the descent tree without a decision from you.~~ **Resolved 2026-09-11.** Per
   Hanzen: all three are `kind: 'cult'`, kept off the descent tree entirely (no
   `tradition_edges` row of any kind), and shown only in their own dedicated
   tree-picker category. See "Cult category" above.
7. **No side is "the true main church" at any split, including 1517.** Per Hanzen,
   this overrides an earlier draft that had Rome continuing unbroken through the
   Reformation. See the design doc's editorial rule and the corrected trunk in
   section 2 above — Roman Catholic Church is a 1517-dated node exactly like
   Lutheran, Reformed, Anglican and Anabaptist are, not a pre-existing institution
   that merely acquired some new rivals.
8. **Church of God (Anderson) and Church of God (Cleveland) are seeded as ordinary,
   unrelated tier-3 denominations** — neither is singled out or treated as more
   significant than the other. Per Hanzen, this dataset does not try to trace any
   one person's specific congregation; it aims for general coverage, with
   Non-denominational as the honest default for anything that doesn't fit a named
   historic body.
